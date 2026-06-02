import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { keyAccessService } from '../../services/key-access'
import MobileShell from './MobileShell'
import SorteioGrupos from '../../components/sorteio-result/SorteioGrupos'
import SorteioChaves from '../../components/sorteio-result/SorteioChaves'
import SorteioOrdem from '../../components/sorteio-result/SorteioOrdem'
import CampeaoBadge from '../../components/CampeaoBadge'
import { composeSubtituloLine } from '../../lib/compose-subtitulo'
import type { Participante } from '../../types/participante'

type Tab = 'inscritos' | 'campeoes' | 'sorteio'

export default function MobileModalidade() {
  const { id } = useParams()
  const navigate = useNavigate()
  const modalidadeId = Number(id)
  const [tab, setTab] = useState<Tab>('inscritos')

  const { data: evento } = useQuery({
    queryKey: ['key-access', 'me'],
    queryFn: keyAccessService.me,
    select: r => r.evento,
  })

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['key-access', 'modalidade', modalidadeId],
    queryFn: () => keyAccessService.modalidade(modalidadeId),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  })

  const campos = evento?.competicao?.subtitulo_campos ?? []
  const subtituloLine = (p: any) => composeSubtituloLine(p, campos)

  const participantesById = useMemo(() => {
    const m = new Map<number, Participante>()
    for (const i of data?.inscritos ?? []) m.set(i.participante_id, i.participante as any)
    return m
  }, [data])

  const campeoesByParticipanteId = useMemo(() => {
    const m = new Map<number, number>()
    for (const c of data?.campeoes ?? []) m.set(c.participante_id, c.posicao)
    return m
  }, [data])

  const tipo = data?.modalidade.tipo_modalidade?.tipo
  const sorteioDisponivel = !!data?.sorteio && tipo !== 'especifico'

  return (
    <MobileShell evento={evento ?? null} showBack onBack={() => navigate('/m')} onRefresh={() => refetch()}>
      {isLoading || !data ? (
        <p className="text-sm text-[var(--t3)]">Carregando...</p>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>
              {data.modalidade.nome}
            </h2>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>
              {data.modalidade.sigla}
            </div>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex', gap: 4, padding: 4,
            background: 'var(--card-bg)', border: '1px solid var(--card-border)',
            borderRadius: 'var(--radius-lg)', marginBottom: 12,
          }}>
            {(['inscritos', 'campeoes', 'sorteio'] as Tab[]).map(t => {
              const label = t === 'inscritos' ? 'Inscritos' : t === 'campeoes' ? 'Campeões' : 'Sorteio'
              const ativo = tab === t
              const disabled = t === 'sorteio' && !sorteioDisponivel
              return (
                <button
                  key={t}
                  onClick={() => !disabled && setTab(t)}
                  disabled={disabled}
                  style={{
                    flex: 1, padding: '8px 6px', borderRadius: 'var(--radius-md)',
                    background: ativo ? 'var(--brand-500)' : 'transparent',
                    color: ativo ? '#fff' : disabled ? 'var(--t4)' : 'var(--t2)',
                    border: 'none', fontSize: 12, fontWeight: 600,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Conteúdo */}
          {tab === 'inscritos' && (
            <div style={{
              background: 'var(--card-bg)', border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-lg)', padding: 12,
            }}>
              {data.inscritos.length === 0 ? (
                <p className="text-sm text-[var(--t4)] italic">Nenhum inscrito.</p>
              ) : (
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.inscritos.map((i, idx) => {
                    const pos = campeoesByParticipanteId.get(i.participante_id)
                    const linha = subtituloLine(i.participante)
                    return (
                      <li key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--t4)', fontSize: 11, minWidth: 22 }}>
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: 'var(--t1)' }}>{i.participante.nome}</div>
                          {linha && <div style={{ fontSize: 11, color: 'var(--t3)' }}>{linha}</div>}
                        </div>
                        {pos && <CampeaoBadge posicao={pos} />}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {tab === 'campeoes' && (
            <div style={{
              background: 'var(--card-bg)', border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-lg)', padding: 12,
            }}>
              {data.campeoes.length === 0 ? (
                <p className="text-sm text-[var(--t4)] italic">Nenhum campeão anterior cadastrado.</p>
              ) : (
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.campeoes.map(c => {
                    const linha = subtituloLine(c.participante)
                    return (
                      <li key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <CampeaoBadge posicao={c.posicao} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: 'var(--t1)' }}>{c.participante.nome}</div>
                          {linha && <div style={{ fontSize: 11, color: 'var(--t3)' }}>{linha}</div>}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {tab === 'sorteio' && data.sorteio && (
            <div style={{ overflowX: 'auto' }}>
              {data.sorteio.tipo === 'grupos' && (
                <SorteioGrupos
                  resultado={data.sorteio.resultado as any}
                  participantesById={participantesById}
                  campeoesByParticipanteId={campeoesByParticipanteId}
                  anfitriaoPid={evento?.anfitriao_id ?? null}
                  subtituloLine={subtituloLine}
                />
              )}
              {data.sorteio.tipo === 'chaves' && (
                <SorteioChaves
                  resultado={data.sorteio.resultado as any}
                  participantesById={participantesById}
                  campeoesByParticipanteId={campeoesByParticipanteId}
                  anfitriaoPid={evento?.anfitriao_id ?? null}
                  subtituloLine={subtituloLine}
                />
              )}
              {data.sorteio.tipo === 'ordem_entrada' && (
                <SorteioOrdem
                  resultado={data.sorteio.resultado as any}
                  participantesById={participantesById}
                  anfitriaoPid={evento?.anfitriao_id ?? null}
                  subtituloLine={subtituloLine}
                />
              )}
            </div>
          )}
          {tab === 'sorteio' && !data.sorteio && (
            <div style={{
              background: 'var(--card-bg-2)', border: '1px dashed var(--card-border)',
              borderRadius: 'var(--radius-lg)', padding: 24, textAlign: 'center',
              fontSize: 13, color: 'var(--t3)',
            }}>
              {tipo === 'especifico'
                ? 'Modalidade sem sorteio automático.'
                : 'Sorteio ainda não realizado.'}
            </div>
          )}
        </>
      )}
    </MobileShell>
  )
}
