import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { modalidadesService } from '../../services/modalidades'
import { eventosService } from '../../services/eventos'
import { sorteiosService } from '../../services/sorteios'
import { inscricoesService } from '../../services/inscricoes'
import { useToast } from '../../components/Toast'
import { X, Check } from 'lucide-react'

type Props = {
  open: boolean
  eventoId: number
  competicaoId: number
  onClose: () => void
}

export default function ModalidadesDoEventoModal({ open, eventoId, competicaoId, onClose }: Props) {
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data: modalidades = [] } = useQuery({
    queryKey: ['modalidades', competicaoId],
    queryFn: () => modalidadesService.listar({ competicao_id: competicaoId }),
    enabled: open,
  })
  const { data: excluidas = [] } = useQuery({
    queryKey: ['modalidades-excluidas', eventoId],
    queryFn: () => eventosService.getModalidadesExcluidas(eventoId),
    enabled: open,
  })
  const { data: counts = {} } = useQuery({
    queryKey: ['inscricoes-counts', eventoId],
    queryFn: () => inscricoesService.counts(eventoId),
    enabled: open,
  })
  const { data: sorteios = [] } = useQuery({
    queryKey: ['sorteios', eventoId],
    queryFn: () => sorteiosService.listar({ evento_id: eventoId }),
    enabled: open,
  })

  // participa = true quando NÃO está em "excluidas"
  const [participa, setParticipa] = useState<Record<number, boolean>>({})
  useEffect(() => {
    if (!open) return
    const excl = new Set(excluidas)
    const map: Record<number, boolean> = {}
    for (const m of modalidades) map[m.id] = !excl.has(m.id)
    setParticipa(map)
  }, [open, modalidades, excluidas])

  const sorteadasIds = new Set(sorteios.map(s => s.modalidade_id))
  function temDados(id: number): boolean {
    return (counts as Record<number, number>)[id] > 0 || sorteadasIds.has(id)
  }

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => {
      const ids = modalidades.filter(m => !participa[m.id]).map(m => m.id)
      return eventosService.setModalidadesExcluidas(eventoId, ids)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modalidades-excluidas', eventoId] })
      queryClient.invalidateQueries({ queryKey: ['evento-modalidades', eventoId] })
      queryClient.invalidateQueries({ queryKey: ['eventos'] })
      toast.success('Modalidades do evento atualizadas.')
      onClose()
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao salvar modalidades.'),
  })

  if (!open) return null

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 320 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-2xl)', padding: 28, maxWidth: 560, width: '100%', margin: '0 16px', maxHeight: '85vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="sec-title mb-2" style={{ fontSize: 'clamp(18px, 2vw, 24px)' }}>Modalidades do evento</h3>
        <p className="text-sm text-[var(--t3)] mb-4">
          Desmarque as modalidades que <b>não</b> participam deste evento. Modalidades com inscritos ou sorteio não podem ser removidas.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {modalidades.map(m => {
            const travada = temDados(m.id)
            const checked = participa[m.id] ?? true
            return (
              <label
                key={m.id}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--card-bg-2)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-lg)', opacity: travada ? 0.7 : 1, cursor: travada ? 'not-allowed' : 'pointer' }}
                title={travada ? 'Possui inscritos/sorteio — apague antes de remover' : ''}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={travada}
                  onChange={e => setParticipa(p => ({ ...p, [m.id]: e.target.checked }))}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--t1)' }}>{m.nome}</div>
                  <div className="text-[var(--t4)]" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{m.sigla}</div>
                </div>
                {travada && <span className="text-[var(--t4)]" style={{ fontSize: 11 }}>tem dados</span>}
              </label>
            )
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button onClick={onClose} className="btn btn-ghost"><X size={16} /> Cancelar</button>
          <button onClick={() => salvar()} disabled={isPending} className="btn btn-primary">
            <Check size={16} /> {isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
