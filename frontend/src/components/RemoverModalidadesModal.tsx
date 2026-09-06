import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Trash2, AlertTriangle } from '../lib/icons'
import { inscricoesService } from '../services/inscricoes'
import { useToast } from './Toast'
import type { Modalidade } from '../types/modalidade'
import type { Sorteio } from '../types/sorteio'

type Props = {
  open: boolean
  onClose: () => void
  eventoId: number
  /** Modalidades da competição do evento, para dar nome ao que veio na inscrição. */
  modalidades: Modalidade[]
  /** Sorteios já realizados no evento: quem estiver aqui não pode ser removido. */
  sorteios: Sorteio[]
}

/**
 * Tira um participante de várias modalidades de uma vez — o caso do dia do
 * congresso, em que a delegação avisa de quais provas desistiu antes do sorteio.
 *
 * Modalidade já sorteada aparece desabilitada com o motivo: apagar a inscrição
 * deixaria a chave apontando para quem saiu. O backend recusa de novo, então
 * uma modalidade sorteada no meio do caminho não passa.
 */
export default function RemoverModalidadesModal({ open, onClose, eventoId, modalidades, sorteios }: Props) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [participanteId, setParticipanteId] = useState<number | null>(null)
  const [sel, setSel] = useState<Set<number>>(new Set())

  // Uma consulta só, ao abrir: dela saem tanto a lista de participantes
  // inscritos no evento quanto as modalidades de cada um.
  const { data: todasInscricoes = [], isLoading } = useQuery({
    queryKey: ['inscricoes', eventoId, 'todas'],
    queryFn: () => inscricoesService.listar({ evento_id: eventoId }),
    enabled: open,
  })

  const participantes = useMemo(() => {
    const m = new Map<number, string>()
    for (const i of todasInscricoes) m.set(i.participante_id, i.participante?.nome ?? `#${i.participante_id}`)
    return [...m.entries()]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
  }, [todasInscricoes])

  const inscricoes = useMemo(
    () => participanteId == null ? [] : todasInscricoes.filter(i => i.participante_id === participanteId),
    [todasInscricoes, participanteId],
  )

  const modalidadeById = useMemo(() => new Map(modalidades.map(m => [m.id, m])), [modalidades])
  const sorteadas = useMemo(() => new Set(sorteios.map(s => s.modalidade_id)), [sorteios])

  const linhas = useMemo(() => {
    return inscricoes
      .map(i => ({
        modalidade_id: i.modalidade_id,
        nome: modalidadeById.get(i.modalidade_id)?.nome ?? `Modalidade ${i.modalidade_id}`,
        sigla: modalidadeById.get(i.modalidade_id)?.sigla ?? '',
        sorteada: sorteadas.has(i.modalidade_id),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
  }, [inscricoes, modalidadeById, sorteadas])

  const disponiveis = useMemo(() => linhas.filter(l => !l.sorteada), [linhas])
  const bloqueadasNaTela = linhas.length - disponiveis.length

  const { mutate: remover, isPending } = useMutation({
    mutationFn: () => inscricoesService.removerBulk({
      evento_id: eventoId,
      participante_id: participanteId!,
      modalidade_ids: [...sel],
    }),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['inscricoes'] })
      queryClient.invalidateQueries({ queryKey: ['inscricoes-counts', eventoId] })
      const base = `${r.removidas} ${r.removidas === 1 ? 'inscrição removida' : 'inscrições removidas'}.`
      if (r.bloqueadas.length > 0) {
        toast.error(`${base} Não removidas (já sorteadas): ${r.bloqueadas.map(b => b.nome).join(', ')}.`)
      } else {
        toast.success(base)
      }
      fechar()
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao remover as inscrições.'),
  })

  function fechar() {
    setParticipanteId(null)
    setSel(new Set())
    onClose()
  }

  function toggle(id: number) {
    setSel(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  function toggleTodas() {
    setSel(prev => prev.size === disponiveis.length ? new Set() : new Set(disponiveis.map(l => l.modalidade_id)))
  }

  if (!open) return null

  return (
    <div onClick={fechar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-xl)', padding: 24, width: 'min(600px, 94vw)', maxHeight: '84vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <h3 className="sec-title" style={{ fontSize: 17 }}>Remover participante de modalidades</h3>
          <button onClick={fechar} className="icon-btn" title="Fechar"><X size={18} /></button>
        </div>
        <p className="text-xs text-[var(--t3)]" style={{ marginBottom: 12 }}>
          Escolha o participante e desmarque as modalidades de que ele desistiu. Modalidades já
          sorteadas não podem ser removidas por aqui — apague o sorteio antes.
        </p>

        <label className="block text-sm font-medium text-[var(--t2)]" style={{ marginBottom: 6 }}>Participante</label>
        <select
          value={participanteId ?? ''}
          onChange={e => { setParticipanteId(e.target.value ? Number(e.target.value) : null); setSel(new Set()) }}
          className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--card-bg-2)] px-3 py-2 text-sm text-[var(--t1)]"
          style={{ marginBottom: 14 }}
        >
          <option value="">Selecione…</option>
          {participantes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>

        {isLoading ? (
          <div className="text-sm text-[var(--t3)]" style={{ padding: '20px 0' }}>Carregando inscrições…</div>
        ) : participanteId == null ? null : linhas.length === 0 ? (
          <div className="text-sm text-[var(--t3)]" style={{ padding: '20px 0' }}>Este participante não está inscrito em nenhuma modalidade deste evento.</div>
        ) : (
          <>
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <label className="inline-flex items-center gap-2 text-sm text-[var(--t2)]">
                <input type="checkbox" checked={sel.size === disponiveis.length && disponiveis.length > 0} onChange={toggleTodas} disabled={disponiveis.length === 0} />
                Selecionar todas ({disponiveis.length})
              </label>
              {bloqueadasNaTela > 0 && (
                <span className="text-xs text-[var(--t4)] inline-flex items-center" style={{ gap: 5 }}>
                  <AlertTriangle size={13} /> {bloqueadasNaTela} já {bloqueadasNaTela === 1 ? 'sorteada' : 'sorteadas'}
                </span>
              )}
            </div>
            <div style={{ overflowY: 'auto', flex: 1, border: '1px solid var(--card-border)', borderRadius: 'var(--radius-md)', padding: 8 }}>
              {linhas.map(l => (
                <label
                  key={l.modalidade_id}
                  className="flex items-center gap-2 text-sm"
                  style={{ padding: '5px 6px', color: l.sorteada ? 'var(--t4)' : 'var(--t1)', cursor: l.sorteada ? 'not-allowed' : 'pointer' }}
                  title={l.sorteada ? 'Já sorteada — apague o sorteio desta modalidade para remover a inscrição.' : undefined}
                >
                  <input type="checkbox" checked={sel.has(l.modalidade_id)} onChange={() => toggle(l.modalidade_id)} disabled={l.sorteada} />
                  {l.nome} <span className="text-[var(--t4)] font-mono" style={{ fontSize: 11 }}>{l.sigla}</span>
                  {l.sorteada && <span className="text-[var(--t4)]" style={{ fontSize: 11, fontStyle: 'italic' }}>· já sorteada</span>}
                </label>
              ))}
            </div>
          </>
        )}

        <div className="flex justify-end" style={{ gap: 10, paddingTop: 16 }}>
          <button onClick={fechar} className="btn btn-ghost" disabled={isPending}><X size={16} /> Cancelar</button>
          <button
            onClick={() => remover()}
            className="btn btn-primary"
            disabled={isPending || sel.size === 0}
            style={{ opacity: (isPending || sel.size === 0) ? 0.5 : 1, background: sel.size > 0 ? 'var(--danger)' : undefined }}
          >
            <Trash2 size={16} /> {isPending ? 'Removendo…' : `Remover (${sel.size})`}
          </button>
        </div>
      </div>
    </div>
  )
}
