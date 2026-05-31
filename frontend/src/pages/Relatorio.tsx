import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import { eventosService } from '../services/eventos'
import { inscricoesService } from '../services/inscricoes'
import { sorteiosService } from '../services/sorteios'
import { modalidadesService } from '../services/modalidades'
import { STATUS_LABEL, STATUS_COLOR } from '../lib/evento-status'
import type { Evento } from '../types/evento'
import type { Sorteio } from '../types/sorteio'

function escapeCsv(value: string | null | undefined): string {
  const s = value ?? ''
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function buildCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.map(escapeCsv).join(',')]
  for (const row of rows) lines.push(row.map(escapeCsv).join(','))
  return '﻿' + lines.join('\n')
}

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function ordemSuffix(i: number): string {
  if (i === 0) return '1º lugar'
  if (i === 1) return '2º lugar'
  if (i === 2) return '3º lugar'
  return `${i + 1}ª posição`
}

function deriveStatusSorteio(
  participanteId: number,
  tipoModalidade: string | undefined,
  sorteio: Sorteio | undefined,
): string {
  if (tipoModalidade === 'especifico') return 'sem sorteio automático'
  if (!sorteio) return 'não sorteado'
  if (sorteio.tipo === 'grupos') {
    const grupo = sorteio.resultado.grupos.find(g => g.participantes.includes(participanteId))
    return grupo ? `Grupo ${grupo.letra}` : 'não sorteado'
  }
  if (sorteio.tipo === 'chaves') {
    const idx = sorteio.resultado.slots.findIndex(s => s === participanteId)
    if (idx === -1) return 'não sorteado'
    return `Slot ${String(idx + 1).padStart(2, '0')}`
  }
  if (sorteio.tipo === 'ordem_entrada') {
    const idx = sorteio.resultado.ordem.findIndex(id => id === participanteId)
    if (idx === -1) return 'não sorteado'
    return ordemSuffix(idx)
  }
  return 'não sorteado'
}

export default function Relatorio() {
  const [exportando, setExportando] = useState<Set<number>>(new Set())
  const [erro, setErro] = useState('')

  const { data: eventos = [], isLoading: loadingEventos } = useQuery({
    queryKey: ['eventos'],
    queryFn: () => eventosService.listar(),
  })
  const { data: inscricoes = [] } = useQuery({
    queryKey: ['inscricoes'],
    queryFn: () => inscricoesService.listar(),
  })
  const { data: sorteios = [] } = useQuery({
    queryKey: ['sorteios'],
    queryFn: () => sorteiosService.listar(),
  })

  async function exportarCsv(evento: Evento) {
    setExportando(prev => new Set(prev).add(evento.id))
    setErro('')
    try {
      const [eventoInscricoes, eventoSorteios, modalidades] = await Promise.all([
        inscricoesService.listar({ evento_id: evento.id }),
        sorteiosService.listar({ evento_id: evento.id }),
        modalidadesService.listar({ competicao_id: evento.competicao_id }),
      ])
      const modalidadesById = new Map(modalidades.map(m => [m.id, m]))
      const sorteiosByModalidade = new Map(eventoSorteios.map(s => [s.modalidade_id, s]))

      const camposSubtitulo = evento.competicao?.subtitulo_campos ?? []
      const incluiSubtitulo = camposSubtitulo.includes('subtitulo')

      const headers = [
        'modalidade_nome',
        'modalidade_sigla',
        'participante_nome',
        ...(incluiSubtitulo ? ['participante_subtitulo'] : []),
        'participante_municipio',
        'status_sorteio',
      ]
      const rows: string[][] = []
      for (const ins of eventoInscricoes) {
        const m = modalidadesById.get(ins.modalidade_id)
        const sorteio = sorteiosByModalidade.get(ins.modalidade_id)
        const tipo = m?.tipo_modalidade?.tipo
        const status = deriveStatusSorteio(ins.participante_id, tipo, sorteio)
        const municipio = ins.participante.municipio
          ? `${ins.participante.municipio.nome}/${ins.participante.municipio.uf}`
          : ''
        rows.push([
          m?.nome ?? '',
          m?.sigla ?? '',
          ins.participante.nome,
          ...(incluiSubtitulo ? [ins.participante.subtitulo ?? ''] : []),
          municipio,
          status,
        ])
      }
      const csv = buildCsv(headers, rows)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `relatorio-evento-${evento.id}-${slug(evento.nome)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Erro ao exportar CSV.')
    } finally {
      setExportando(prev => {
        const next = new Set(prev)
        next.delete(evento.id)
        return next
      })
    }
  }

  const columns = [
    { header: 'Evento', accessor: (row: Evento) => row.nome },
    { header: 'Competição', accessor: (row: Evento) => row.competicao?.nome ?? '—' },
    {
      header: 'Status',
      accessor: (row: Evento) => (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[row.status]}`}>
          {STATUS_LABEL[row.status]}
        </span>
      ),
      className: 'w-32',
    },
    {
      header: 'Inscrições',
      accessor: (row: Evento) => inscricoes.filter(i => i.evento_id === row.id).length,
      className: 'w-28',
    },
    {
      header: 'Sorteios',
      accessor: (row: Evento) => sorteios.filter(s => s.evento_id === row.id).length,
      className: 'w-24',
    },
    {
      header: 'Ações',
      accessor: (row: Evento) => (
        <button
          onClick={() => exportarCsv(row)}
          disabled={exportando.has(row.id)}
          className="text-xs text-[var(--brand-500)] hover:text-[var(--brand-400)] disabled:opacity-50"
        >
          {exportando.has(row.id) ? 'Exportando...' : 'Exportar CSV'}
        </button>
      ),
      className: 'w-32',
    },
  ]

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="GESTÃO"
        title="Relatório"
        sub="Exporte snapshot completo de cada evento (inscrições + resultados de sorteio) em CSV."
      />
      <div className="p-6 space-y-3">
        {erro && <p className="text-sm text-[var(--danger)]">{erro}</p>}
        {loadingEventos ? (
          <p className="text-sm text-[var(--t3)]">Carregando...</p>
        ) : (
          <DataTable
            columns={columns}
            data={eventos}
            keyExtractor={r => r.id}
            emptyMessage="Nenhum evento cadastrado."
          />
        )}
      </div>
    </div>
  )
}
