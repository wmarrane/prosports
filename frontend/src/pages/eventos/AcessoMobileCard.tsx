import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { eventoKeysService } from '../../services/evento-keys'
import type { EventoKey } from '../../types/evento-key'
import { Plus, X, Check } from '../../lib/icons'
import { Key, Smartphone, Copy, QrCode, RotateCcw, Ban, Trash2 } from 'lucide-react'

type Props = { eventoId: number }

function formatRelativo(iso: string | null): string {
  if (!iso) return 'nunca'
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min} min atrás`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h atrás`
  const d = Math.floor(h / 24)
  return `${d}d atrás`
}

export default function AcessoMobileCard({ eventoId }: Props) {
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState('')
  const [qrAlvo, setQrAlvo] = useState<EventoKey | null>(null)
  const [confirmAlvo, setConfirmAlvo] = useState<{ acao: 'revogar' | 'reset' | 'apagar'; key: EventoKey } | null>(null)

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['evento-keys', eventoId],
    queryFn: () => eventoKeysService.listar(eventoId),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['evento-keys', eventoId] })

  const { mutate: criar, isPending: criando } = useMutation({
    mutationFn: () => eventoKeysService.criar(eventoId, email.trim()),
    onSuccess: (nova) => { invalidate(); setEmail(''); setErro(''); setQrAlvo(nova) },
    onError: (e: any) => setErro(e?.response?.data?.message ?? 'Erro ao criar chave.'),
  })

  const { mutate: revogar } = useMutation({
    mutationFn: (id: number) => eventoKeysService.revogar(eventoId, id),
    onSuccess: invalidate,
  })
  const { mutate: resetDevice } = useMutation({
    mutationFn: (id: number) => eventoKeysService.resetDevice(eventoId, id),
    onSuccess: invalidate,
  })
  const { mutate: apagar } = useMutation({
    mutationFn: (id: number) => eventoKeysService.apagar(eventoId, id),
    onSuccess: invalidate,
    onError: (e: any) => alert(e?.response?.data?.message ?? 'Erro ao apagar.'),
  })

  function linkDe(key: EventoKey): string {
    return `${window.location.origin}/e/${key.token}`
  }
  function copiarLink(key: EventoKey) {
    navigator.clipboard.writeText(linkDe(key))
  }

  return (
    <section style={{
      background: 'var(--card-bg)', border: '1px solid var(--card-border)',
      borderRadius: 'var(--radius-xl)', padding: 24, marginBottom: 16,
      boxShadow: 'var(--shadow-card)',
    }}>
      <div className="flex items-center gap-3 mb-5">
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
          color: '#fff', display: 'grid', placeItems: 'center',
        }}>
          <Key size={18} />
        </div>
        <div>
          <div className="eyebrow">Acesso mobile</div>
          <h3 className="sec-title" style={{ fontSize: 17 }}>Chaves de visualização</h3>
        </div>
      </div>

      <p className="text-sm text-[var(--t3)] mb-4">
        Convidados podem visualizar inscritos, campeões e sorteios em tempo real através de um link/QR vinculado a este evento.
      </p>

      {/* Nova chave */}
      <div style={{
        background: 'var(--card-bg-2)', border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-lg)', padding: 14, marginBottom: 16,
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email do convidado"
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--t1)] text-sm"
        />
        <button
          type="button"
          onClick={() => criar()}
          disabled={!email.trim() || criando}
          className="btn btn-primary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: !email.trim() || criando ? 0.5 : 1 }}
        >
          <Plus size={14} /> {criando ? 'Gerando...' : 'Gerar chave'}
        </button>
      </div>
      {erro && (
        <div style={{
          background: 'var(--danger-soft)', color: 'var(--danger)',
          border: '1px solid var(--danger)', borderRadius: 'var(--radius-lg)',
          padding: '8px 12px', fontSize: 13, marginBottom: 12,
        }}>{erro}</div>
      )}

      {/* Lista */}
      <div className="eyebrow mb-2">Emitidas ({keys.length})</div>
      {isLoading ? (
        <p className="text-sm text-[var(--t3)]">Carregando...</p>
      ) : keys.length === 0 ? (
        <p className="text-sm text-[var(--t4)] italic">Nenhuma chave gerada ainda.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {keys.map(k => {
            const revogada = !!k.revogado_em
            const ativada = !!k.device_fp
            const cor = revogada ? 'var(--t4)' : ativada ? 'var(--success)' : 'var(--brand-500)'
            return (
              <div
                key={k.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px',
                  background: 'var(--card-bg-2)',
                  border: `1px solid ${revogada ? 'var(--card-border)' : cor}`,
                  borderRadius: 'var(--radius-lg)',
                  opacity: revogada ? 0.6 : 1,
                }}
              >
                <Smartphone size={18} style={{ color: cor, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="text-sm font-semibold text-[var(--t1)] truncate"
                       style={{ textDecoration: revogada ? 'line-through' : 'none' }}>
                    {k.email}
                  </div>
                  <div className="text-xs text-[var(--t3)] mt-0.5">
                    {revogada
                      ? `Revogada ${formatRelativo(k.revogado_em)}`
                      : ativada
                      ? `${k.device_label} · ${formatRelativo(k.last_seen_at)}`
                      : 'Nunca acessada'}
                  </div>
                </div>
                {!revogada && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => copiarLink(k)} title="Copiar link" className="p-1.5 rounded hover:bg-[var(--card-bg)] text-[var(--t3)]">
                      <Copy size={14} />
                    </button>
                    <button onClick={() => setQrAlvo(k)} title="QR code" className="p-1.5 rounded hover:bg-[var(--card-bg)] text-[var(--t3)]">
                      <QrCode size={14} />
                    </button>
                    {ativada && (
                      <button onClick={() => setConfirmAlvo({ acao: 'reset', key: k })} title="Reset device" className="p-1.5 rounded hover:bg-[var(--card-bg)] text-[var(--brand-500)]">
                        <RotateCcw size={14} />
                      </button>
                    )}
                    {ativada ? (
                      <button onClick={() => setConfirmAlvo({ acao: 'revogar', key: k })} title="Revogar" className="p-1.5 rounded hover:bg-[var(--card-bg)] text-[var(--danger)]">
                        <Ban size={14} />
                      </button>
                    ) : (
                      <button onClick={() => setConfirmAlvo({ acao: 'apagar', key: k })} title="Apagar" className="p-1.5 rounded hover:bg-[var(--card-bg)] text-[var(--danger)]">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal QR */}
      {qrAlvo && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 310 }}
          onClick={() => setQrAlvo(null)}
        >
          <div
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-2xl)', padding: 32, maxWidth: 420, width: '100%', margin: '0 16px', textAlign: 'center' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-2 text-[var(--t1)]">Acesso de {qrAlvo.email}</h3>
            <p className="text-xs text-[var(--t3)] mb-4">Escaneie o QR ou envie o link.</p>
            <div style={{ display: 'inline-block', background: '#fff', padding: 12, borderRadius: 12 }}>
              <QRCodeSVG value={linkDe(qrAlvo)} size={240} />
            </div>
            <div style={{
              marginTop: 16, padding: '8px 12px', background: 'var(--card-bg-2)',
              border: '1px solid var(--card-border)', borderRadius: 'var(--radius-md)',
              fontSize: 12, fontFamily: 'var(--font-mono)', wordBreak: 'break-all',
            }}>{linkDe(qrAlvo)}</div>
            <div className="flex justify-center gap-2 mt-4">
              <button onClick={() => copiarLink(qrAlvo)} className="btn btn-ghost btn-sm">
                <Copy size={14} /> Copiar link
              </button>
              <button onClick={() => setQrAlvo(null)} className="btn btn-primary btn-sm">
                <Check size={14} /> Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmação ações destrutivas */}
      {confirmAlvo && (() => {
        const { acao, key } = confirmAlvo
        const titulos = {
          revogar: { t: 'Revogar chave?', d: `O convidado ${key.email} será deslogado na próxima request. Histórico preservado.`, btn: 'Revogar', danger: true, ico: Ban },
          reset: { t: 'Resetar device?', d: `A chave de ${key.email} poderá ser usada em um novo aparelho.`, btn: 'Resetar', danger: false, ico: RotateCcw },
          apagar: { t: 'Apagar chave?', d: `A chave de ${key.email} será removida permanentemente.`, btn: 'Apagar', danger: true, ico: Trash2 },
        }
        const cfg = titulos[acao]
        const Ico = cfg.ico
        return (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 310 }}
            onClick={() => setConfirmAlvo(null)}
          >
            <div
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-2xl)', padding: 32, maxWidth: 480, width: '100%', margin: '0 16px', textAlign: 'center' }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{
                width: 72, height: 72, margin: '0 auto 16px', borderRadius: '50%',
                background: cfg.danger ? 'var(--danger-soft)' : 'var(--brand-50)',
                color: cfg.danger ? 'var(--danger)' : 'var(--brand-500)',
                display: 'grid', placeItems: 'center',
              }}><Ico size={36} /></div>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}>{cfg.t}</h3>
              <p style={{ fontSize: 15, color: 'var(--t3)', marginBottom: 24 }}>{cfg.d}</p>
              <div className="flex justify-center gap-3">
                <button onClick={() => setConfirmAlvo(null)} className="btn btn-ghost">
                  <X size={16} /> Cancelar
                </button>
                <button
                  onClick={() => {
                    if (acao === 'revogar') revogar(key.id)
                    else if (acao === 'reset') resetDevice(key.id)
                    else apagar(key.id)
                    setConfirmAlvo(null)
                  }}
                  style={{
                    background: cfg.danger ? 'var(--danger)' : 'var(--brand-500)',
                    color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)',
                    padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Ico size={16} /> {cfg.btn}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </section>
  )
}
