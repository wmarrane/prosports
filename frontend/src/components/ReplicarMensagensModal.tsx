import { useMemo, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { X, Check } from '../lib/icons'
import { modalidadesService } from '../services/modalidades'
import { agruparAlvosPorCompeticao } from '../lib/replicar-alvos'
import { useToast } from './Toast'
import type { MensagemInscritos } from '../lib/mensagens-inscritos'

type Props = {
  open: boolean
  onClose: () => void
  tipo: string
  origemId: number
  mensagens: MensagemInscritos[]
}

export default function ReplicarMensagensModal({ open, onClose, tipo, origemId, mensagens }: Props) {
  const toast = useToast()
  const [sel, setSel] = useState<Set<number>>(new Set())

  const { data: modalidades = [] } = useQuery({
    queryKey: ['modalidades'],
    queryFn: () => modalidadesService.listar(),
    enabled: open,
  })

  const grupos = useMemo(
    () => agruparAlvosPorCompeticao(modalidades as any, { tipo, excluirId: origemId }),
    [modalidades, tipo, origemId],
  )
  const totalAlvos = useMemo(() => grupos.reduce((n, g) => n + g.itens.length, 0), [grupos])

  const { mutate: replicar, isPending } = useMutation({
    mutationFn: () => modalidadesService.replicarMensagens({ origem_id: origemId, destino_ids: [...sel], mensagens }),
    onSuccess: (r) => {
      toast.success(`Replicado para ${r.replicadas} modalidade${r.replicadas === 1 ? '' : 's'}.`)
      setSel(new Set())
      onClose()
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao replicar.'),
  })

  if (!open) return null

  function toggle(id: number) {
    setSel(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function toggleAll() {
    setSel(prev => {
      if (prev.size === totalAlvos) return new Set()
      const n = new Set<number>()
      for (const g of grupos) for (const it of g.itens) n.add(it.id)
      return n
    })
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-xl)', padding: 24, width: 'min(560px, 94vw)', maxHeight: '84vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <h3 className="sec-title" style={{ fontSize: 17 }}>Replicar mensagens</h3>
          <button onClick={onClose} className="icon-btn" title="Fechar"><X size={18} /></button>
        </div>
        <p className="text-xs text-[var(--t3)]" style={{ marginBottom: 12 }}>
          As mensagens configuradas substituirão as das modalidades selecionadas (mesmo tipo).
        </p>

        {totalAlvos === 0 ? (
          <div className="text-sm text-[var(--t3)]" style={{ padding: '20px 0' }}>Nenhuma outra modalidade do mesmo tipo.</div>
        ) : (
          <>
            <label className="inline-flex items-center gap-2 text-sm text-[var(--t2)]" style={{ marginBottom: 8 }}>
              <input type="checkbox" checked={sel.size === totalAlvos && totalAlvos > 0} onChange={toggleAll} />
              Selecionar todas ({totalAlvos})
            </label>
            <div style={{ overflowY: 'auto', flex: 1, border: '1px solid var(--card-border)', borderRadius: 'var(--radius-md)', padding: 8 }}>
              {grupos.map(g => (
                <div key={g.competicao} style={{ marginBottom: 8 }}>
                  <div className="eyebrow" style={{ marginBottom: 4 }}>{g.competicao}</div>
                  {g.itens.map(it => (
                    <label key={it.id} className="flex items-center gap-2 text-sm text-[var(--t1)]" style={{ padding: '4px 6px' }}>
                      <input type="checkbox" checked={sel.has(it.id)} onChange={() => toggle(it.id)} />
                      {it.nome} <span className="text-[var(--t4)] font-mono" style={{ fontSize: 11 }}>{it.sigla}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

        <div className="flex justify-end" style={{ gap: 10, paddingTop: 16 }}>
          <button onClick={onClose} className="btn btn-ghost" disabled={isPending}><X size={16} /> Cancelar</button>
          <button onClick={() => replicar()} className="btn btn-primary" disabled={isPending || sel.size === 0} style={{ opacity: (isPending || sel.size === 0) ? 0.5 : 1 }}>
            <Check size={16} /> {isPending ? 'Replicando...' : `Replicar (${sel.size})`}
          </button>
        </div>
      </div>
    </div>
  )
}
