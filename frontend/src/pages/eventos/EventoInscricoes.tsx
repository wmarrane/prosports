import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import ParticipanteSelect from '../../components/ParticipanteSelect'
import ImportInscricoesModal from '../../components/import/ImportInscricoesModal'
import SorteioGrupos from '../../components/sorteio-result/SorteioGrupos'
import SorteioChaves from '../../components/sorteio-result/SorteioChaves'
import SorteioOrdem from '../../components/sorteio-result/SorteioOrdem'
import { eventosService } from '../../services/eventos'
import { modalidadesService } from '../../services/modalidades'
import { inscricoesService } from '../../services/inscricoes'
import { sorteiosService } from '../../services/sorteios'
import type { Inscricao } from '../../types/inscricao'
import type { Participante } from '../../types/participante'

function formatDateBR(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}

export default function EventoInscricoes() {
  const { id } = useParams()
  const eventoId = Number(id)
  const queryClient = useQueryClient()

  const [modalidadeId, setModalidadeId] = useState<number | null>(null)
  const [inscreverOpen, setInscreverOpen] = useState(false)
  const [pickedId, setPickedId] = useState<number | null>(null)
  const [erroModal, setErroModal] = useState('')
  const [erroSorteio, setErroSorteio] = useState('')
  const [importOpen, setImportOpen] = useState(false)

  const { data: evento } = useQuery({
    queryKey: ['eventos', eventoId],
    queryFn: () => eventosService.buscar(eventoId),
  })

  const { data: modalidades = [] } = useQuery({
    queryKey: ['modalidades', evento?.competicao_id],
    queryFn: () => modalidadesService.listar({ competicao_id: evento!.competicao_id }),
    enabled: !!evento,
  })

  const { data: inscricoes = [], isLoading: loadingInscricoes } = useQuery({
    queryKey: ['inscricoes', eventoId, modalidadeId],
    queryFn: () => inscricoesService.listar({ evento_id: eventoId, modalidade_id: modalidadeId! }),
    enabled: modalidadeId != null,
  })

  const { data: sorteios = [] } = useQuery({
    queryKey: ['sorteios', eventoId],
    queryFn: () => sorteiosService.listar({ evento_id: eventoId }),
  })

  const sorteioDaModalidade = modalidadeId != null
    ? sorteios.find(s => s.modalidade_id === modalidadeId) ?? null
    : null

  const modalidadesSorteadasIds = useMemo(
    () => new Set(sorteios.map(s => s.modalidade_id)),
    [sorteios]
  )

  const participantesById = useMemo(() => {
    const m = new Map<number, Participante>()
    for (const i of inscricoes) m.set(i.participante_id, i.participante)
    return m
  }, [inscricoes])

  const modalidadeAtual = modalidades.find(m => m.id === modalidadeId)
  const tipoDaModalidade = modalidadeAtual?.tipo_modalidade?.tipo

  const { mutate: criar, isPending: salvando } = useMutation({
    mutationFn: () => inscricoesService.criar({
      evento_id: eventoId,
      modalidade_id: modalidadeId!,
      participante_id: pickedId!,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inscricoes', eventoId, modalidadeId] })
      setInscreverOpen(false)
      setPickedId(null)
      setErroModal('')
    },
    onError: (err: any) => setErroModal(err?.response?.data?.message ?? 'Erro ao inscrever.'),
  })

  const { mutate: removerInscricao } = useMutation({
    mutationFn: inscricoesService.remover,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inscricoes', eventoId, modalidadeId] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  const { mutate: executarSorteio, isPending: executandoSorteio } = useMutation({
    mutationFn: () => sorteiosService.executar({ evento_id: eventoId, modalidade_id: modalidadeId! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sorteios', eventoId] })
      setErroSorteio('')
    },
    onError: (err: any) => setErroSorteio(err?.response?.data?.message ?? 'Erro ao sortear.'),
  })

  const { mutate: apagarSorteio } = useMutation({
    mutationFn: (sid: number) => sorteiosService.remover(sid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sorteios', eventoId] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao apagar sorteio.'),
  })

  function handleSortear() {
    setErroSorteio('')
    executarSorteio()
  }

  function handleResortear() {
    if (confirm('Re-sortear esta modalidade? Isso vai sobrescrever o resultado atual com uma nova seed.')) {
      setErroSorteio('')
      executarSorteio()
    }
  }

  function handleApagarSorteio(sid: number) {
    if (confirm('Apagar o sorteio? A próxima execução vai gerar um novo do zero.')) {
      apagarSorteio(sid)
    }
  }

  const excludeIds = inscricoes.map(i => i.participante_id)

  const columns = [
    { header: 'Nome', accessor: (row: Inscricao) => row.participante.nome },
    { header: 'Subtítulo', accessor: (row: Inscricao) => row.participante.subtitulo ?? '—' },
    {
      header: 'Município',
      accessor: (row: Inscricao) => row.participante.municipio
        ? `${row.participante.municipio.nome} — ${row.participante.municipio.uf}`
        : '—',
    },
    {
      header: 'Ações',
      accessor: (row: Inscricao) => (
        <button
          onClick={() => { if (confirm(`Remover inscrição de "${row.participante.nome}"?`)) removerInscricao(row.id) }}
          className="text-[var(--danger)] hover:text-[var(--danger-700)] text-xs"
        >Remover</button>
      ),
      className: 'w-24',
    },
  ]

  const totalModalidades = modalidades.length
  const sorteadas = modalidadesSorteadasIds.size
  const pct = totalModalidades > 0 ? Math.round((sorteadas / totalModalidades) * 100) : 0

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="OPERAÇÃO"
        title={evento ? evento.nome : 'Inscrições'}
        sub={evento?.competicao?.nome}
        backTo="/eventos"
      />
      <div className="px-6 pt-4">
        <div className="flex items-center gap-3 text-xs text-[var(--t3)]">
          <span>{sorteadas} de {totalModalidades} modalidades sorteadas</span>
          <div className="flex-1 max-w-xs h-1.5 bg-[var(--card-bg-2)] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--brand-500)] transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      <div className="p-6 space-y-5">
        <div className="flex flex-wrap gap-2">
          {modalidades.length === 0 && (
            <p className="text-sm text-[var(--t3)]">Nenhuma modalidade nesta competição.</p>
          )}
          {modalidades.map(m => {
            const active = m.id === modalidadeId
            const sorteada = modalidadesSorteadasIds.has(m.id)
            return (
              <button
                key={m.id}
                onClick={() => { setModalidadeId(m.id); setErroSorteio('') }}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  active
                    ? 'bg-[var(--brand-500)] text-white border-[var(--brand-500)]'
                    : 'bg-[var(--card-bg-2)] text-[var(--t1)] border-[var(--card-border)] hover:border-[var(--brand-400)]'
                }`}
              >
                {m.nome} ({m.sigla})
                {sorteada && <span className={`ml-1.5 ${active ? 'text-white' : 'text-[var(--success)]'}`}>✓</span>}
              </button>
            )
          })}
        </div>

        {modalidadeId == null ? (
          <p className="text-sm text-[var(--t3)]">Selecione uma modalidade para ver os inscritos.</p>
        ) : (
          <>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-medium text-[var(--t2)]">
                  {inscricoes.length} {inscricoes.length === 1 ? 'inscrito' : 'inscritos'}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setImportOpen(true)}
                    className="px-3 py-2 text-sm text-[var(--t2)] hover:text-[var(--t1)] border border-[var(--card-border)] rounded-lg"
                  >Importar CSV</button>
                  <button
                    onClick={() => { setInscreverOpen(true); setPickedId(null); setErroModal('') }}
                    className="btn btn-primary"
                  >+ Inscrever</button>
                </div>
              </div>
              {loadingInscricoes ? (
                <p className="text-sm text-[var(--t3)]">Carregando...</p>
              ) : (
                <DataTable columns={columns} data={inscricoes} keyExtractor={r => r.id} emptyMessage="Nenhum inscrito nesta modalidade." />
              )}
            </div>

            <div className="border-t border-[var(--card-border)] pt-5 space-y-3">
              <h2 className="text-sm font-medium text-[var(--t2)]">Sorteio</h2>

              {tipoDaModalidade === 'especifico' ? (
                <p className="text-sm text-[var(--t3)]">Esta modalidade não possui sorteio automático.</p>
              ) : sorteioDaModalidade ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <div className="text-xs text-[var(--t3)]">
                      seed: <span className="font-mono">{sorteioDaModalidade.seed}</span> · gerado em {formatDateBR(sorteioDaModalidade.gerado_em)}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleResortear}
                        disabled={executandoSorteio}
                        className="text-xs text-[var(--brand-500)] hover:text-[var(--brand-400)] disabled:opacity-50"
                      >{executandoSorteio ? 'Sorteando...' : 'Re-sortear'}</button>
                      <button
                        onClick={() => handleApagarSorteio(sorteioDaModalidade.id)}
                        className="text-xs text-[var(--danger)] hover:text-[var(--danger-700)]"
                      >Apagar sorteio</button>
                    </div>
                  </div>
                  {sorteioDaModalidade.tipo === 'grupos' && (
                    <SorteioGrupos resultado={sorteioDaModalidade.resultado} participantesById={participantesById} />
                  )}
                  {sorteioDaModalidade.tipo === 'chaves' && (
                    <SorteioChaves resultado={sorteioDaModalidade.resultado} participantesById={participantesById} />
                  )}
                  {sorteioDaModalidade.tipo === 'ordem_entrada' && (
                    <SorteioOrdem resultado={sorteioDaModalidade.resultado} participantesById={participantesById} />
                  )}
                  {erroSorteio && <p className="text-sm text-[var(--danger)]">{erroSorteio}</p>}
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={handleSortear}
                    disabled={inscricoes.length === 0 || executandoSorteio}
                    className="btn btn-primary disabled:opacity-50"
                  >{executandoSorteio ? 'Sorteando...' : 'Sortear esta modalidade'}</button>
                  {inscricoes.length === 0 && (
                    <p className="text-xs text-[var(--t3)]">Adicione participantes antes de sortear.</p>
                  )}
                  {erroSorteio && <p className="text-sm text-[var(--danger)]">{erroSorteio}</p>}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {inscreverOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-20" onClick={() => setInscreverOpen(false)}>
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[var(--t1)] mb-4">Inscrever participante</h3>
            <ParticipanteSelect value={pickedId} onChange={(id) => setPickedId(id)} excludeIds={excludeIds} />
            {erroModal && <p className="text-sm text-[var(--danger)] mt-3">{erroModal}</p>}
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setInscreverOpen(false)} className="px-4 py-2 text-sm text-[var(--t2)] hover:text-[var(--t1)]">Cancelar</button>
              <button
                onClick={() => criar()}
                disabled={!pickedId || salvando}
                className="btn btn-primary disabled:opacity-50"
              >{salvando ? 'Salvando...' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}

      <ImportInscricoesModal
        open={importOpen}
        eventoId={eventoId}
        modalidadeId={modalidadeId ?? 0}
        onClose={() => setImportOpen(false)}
        onImported={() => queryClient.invalidateQueries({ queryKey: ['inscricoes', eventoId, modalidadeId] })}
      />
    </div>
  )
}
