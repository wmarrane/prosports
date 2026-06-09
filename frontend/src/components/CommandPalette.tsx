import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search } from '../lib/icons'
import { eventosService } from '../services/eventos'
import { modalidadesService } from '../services/modalidades'
import { competicoesService } from '../services/competicoes'
import { filterEntities, type PaletteItem } from '../lib/command-palette'

type Props = { open: boolean; onClose: () => void }

const GROUP_LABEL: Record<string, string> = { eventos: 'Eventos', modalidades: 'Modalidades', competicoes: 'Competições' }

export default function CommandPalette({ open, onClose }: Props) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: eventos = [] } = useQuery({ queryKey: ['eventos'], queryFn: () => eventosService.listar(), enabled: open })
  const { data: modalidades = [] } = useQuery({ queryKey: ['modalidades'], queryFn: () => modalidadesService.listar(), enabled: open })
  const { data: competicoes = [] } = useQuery({ queryKey: ['competicoes'], queryFn: () => competicoesService.listar(), enabled: open })

  const results = useMemo(
    () => filterEntities(q, {
      eventos: eventos.map(e => ({ id: e.id, nome: e.nome })),
      modalidades: modalidades.map(m => ({ id: m.id, nome: m.nome, sigla: m.sigla })),
      competicoes: competicoes.map(c => ({ id: c.id, nome: c.nome })),
    }),
    [q, eventos, modalidades, competicoes],
  )

  const flat = useMemo<Array<{ group: keyof typeof results; item: PaletteItem }>>(() => [
    ...results.eventos.map(item => ({ group: 'eventos' as const, item })),
    ...results.modalidades.map(item => ({ group: 'modalidades' as const, item })),
    ...results.competicoes.map(item => ({ group: 'competicoes' as const, item })),
  ], [results])

  useEffect(() => { setSel(0) }, [q])
  useEffect(() => { if (open) { setQ(''); setSel(0); setTimeout(() => inputRef.current?.focus(), 0) } }, [open])

  if (!open) return null

  function go(item: PaletteItem) { onClose(); navigate(item.to) }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, Math.max(flat.length - 1, 0))); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); return }
    if (e.key === 'Enter') { e.preventDefault(); const f = flat[sel]; if (f) go(f.item); return }
  }

  let runningIndex = -1

  return (
    <div
      role="dialog"
      aria-label="Busca global"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 80, paddingTop: '12vh',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        onKeyDown={onKeyDown}
        style={{
          width: 'min(620px, 92vw)', background: 'var(--card-bg)', border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-card)', overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--card-border)' }}>
          <Search size={18} style={{ color: 'var(--t3)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar eventos, modalidades, competições..."
            aria-label="Busca global"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--t1)', fontSize: 15 }}
          />
        </div>

        <div style={{ maxHeight: 420, overflowY: 'auto', padding: 8 }}>
          {q.trim() === '' ? (
            <div style={{ padding: '14px 10px', fontSize: 13, color: 'var(--t3)' }}>Digite para buscar eventos, modalidades, competições…</div>
          ) : flat.length === 0 ? (
            <div style={{ padding: '14px 10px', fontSize: 13, color: 'var(--t3)' }}>Nenhum resultado para "{q}".</div>
          ) : (
            (['eventos', 'modalidades', 'competicoes'] as const).map(group => (
              results[group].length === 0 ? null : (
                <div key={group}>
                  <div style={{ padding: '8px 10px 4px', fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {GROUP_LABEL[group]}
                  </div>
                  {results[group].map(item => {
                    runningIndex += 1
                    const active = runningIndex === sel
                    return (
                      <button
                        key={`${group}-${item.id}`}
                        onClick={() => go(item)}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                          padding: '8px 10px', borderRadius: 'var(--radius-md)', color: 'var(--t1)',
                          background: active ? 'var(--card-bg-2)' : 'transparent',
                        }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{item.label}</span>
                        {item.sublabel && <span style={{ fontSize: 12, color: 'var(--t3)', marginLeft: 8, fontFamily: 'var(--font-mono)' }}>{item.sublabel}</span>}
                      </button>
                    )
                  })}
                </div>
              )
            ))
          )}
        </div>
      </div>
    </div>
  )
}
