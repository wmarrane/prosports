import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import { eventosService } from '../../services/eventos'
import type { Evento } from '../../types/evento'
import { STATUS_LABEL, STATUS_COLOR } from '../../lib/evento-status'
import { Trophy, Evento as EventoIcon, Cadastro } from '../../lib/icons'

function formatDateBR(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}

export default function EventosList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data = [], isLoading } = useQuery({
    queryKey: ['eventos'],
    queryFn: () => eventosService.listar(),
  })

  const { mutate: remover } = useMutation({
    mutationFn: eventosService.remover,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['eventos'] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  function handleCardClick(id: number) {
    navigate(`/eventos/${id}/editar`)
  }

  function handleRemove(e: React.MouseEvent, ev: Evento) {
    e.stopPropagation()
    if (confirm(`Remover "${ev.nome}"?`)) remover(ev.id)
  }

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="OPERAÇÃO"
        title="Eventos"
        sub="Gerencie edições de competições, datas e locais."
        actionLabel="+ Novo Evento"
        actionTo="/eventos/novo"
      />
      <div className="p-6">
        {isLoading ? (
          <p className="text-sm text-[var(--t3)]">Carregando...</p>
        ) : data.length === 0 ? (
          <div className="text-center py-12 text-sm text-[var(--t3)]">Nenhum evento cadastrado.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {data.map((ev) => (
              <div
                key={ev.id}
                className="card cursor-pointer hover:border-[var(--brand-400)] transition-colors"
                style={{ position: 'relative', padding: 20 }}
                onClick={() => handleCardClick(ev.id)}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, height: 4,
                    background: 'var(--grad-brand)',
                    borderRadius: '12px 12px 0 0',
                  }}
                />
                <div className="flex items-start justify-between mb-2 mt-1">
                  <div className="eyebrow font-mono">#{ev.id} · {ev.municipio.nome} — {ev.municipio.uf}</div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[ev.status]}`}>
                    {STATUS_LABEL[ev.status]}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-[var(--t1)] mt-2" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {ev.nome}
                </h3>
                <div className="mt-2 text-xs text-[var(--brand-500)] flex items-center gap-1.5">
                  <Trophy size={13} /> {ev.competicao.nome}
                </div>
                <div className="mt-1 text-xs text-[var(--t3)] flex items-center gap-1.5">
                  <EventoIcon size={13} /> {formatDateBR(ev.data_hora)} · {ev.local}
                </div>
                {ev.organizador && (
                  <div className="mt-1 text-xs text-[var(--t3)] flex items-center gap-1.5">
                    <Cadastro size={13} /> {ev.organizador}
                  </div>
                )}
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={(e) => handleRemove(e, ev)}
                    className="text-xs text-[var(--danger)] hover:text-[var(--danger-700)]"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
