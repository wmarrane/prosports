import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import ParticipanteSelect from '../../components/ParticipanteSelect'
import { eventosService } from '../../services/eventos'
import { modalidadesService } from '../../services/modalidades'
import { inscricoesService } from '../../services/inscricoes'
import type { Inscricao } from '../../types/inscricao'

export default function EventoInscricoes() {
  const { id } = useParams()
  const eventoId = Number(id)
  const queryClient = useQueryClient()

  const [modalidadeId, setModalidadeId] = useState<number | null>(null)
  const [inscreverOpen, setInscreverOpen] = useState(false)
  const [pickedId, setPickedId] = useState<number | null>(null)
  const [erroModal, setErroModal] = useState('')

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

  const { mutate: remover } = useMutation({
    mutationFn: inscricoesService.remover,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inscricoes', eventoId, modalidadeId] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

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
          onClick={() => { if (confirm(`Remover inscrição de "${row.participante.nome}"?`)) remover(row.id) }}
          className="text-[var(--danger)] hover:text-[var(--danger-700)] text-xs"
        >Remover</button>
      ),
      className: 'w-24',
    },
  ]

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="OPERAÇÃO"
        title={evento ? evento.nome : 'Inscrições'}
        sub={evento?.competicao?.nome}
        backTo="/eventos"
      />
      <div className="p-6 space-y-5">
        <div className="flex flex-wrap gap-2">
          {modalidades.length === 0 && (
            <p className="text-sm text-[var(--t3)]">Nenhuma modalidade nesta competição.</p>
          )}
          {modalidades.map(m => {
            const active = m.id === modalidadeId
            return (
              <button
                key={m.id}
                onClick={() => setModalidadeId(m.id)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  active
                    ? 'bg-[var(--brand-500)] text-white border-[var(--brand-500)]'
                    : 'bg-[var(--card-bg-2)] text-[var(--t1)] border-[var(--card-border)] hover:border-[var(--brand-400)]'
                }`}
              >
                {m.nome} ({m.sigla})
              </button>
            )
          })}
        </div>

        {modalidadeId == null ? (
          <p className="text-sm text-[var(--t3)]">Selecione uma modalidade para ver os inscritos.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-medium text-[var(--t2)]">
                {inscricoes.length} {inscricoes.length === 1 ? 'inscrito' : 'inscritos'}
              </h2>
              <button
                onClick={() => { setInscreverOpen(true); setPickedId(null); setErroModal('') }}
                className="btn btn-primary"
              >+ Inscrever</button>
            </div>
            {loadingInscricoes ? (
              <p className="text-sm text-[var(--t3)]">Carregando...</p>
            ) : (
              <DataTable columns={columns} data={inscricoes} keyExtractor={r => r.id} emptyMessage="Nenhum inscrito nesta modalidade." />
            )}
          </div>
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
    </div>
  )
}
