import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useToast } from '../../components/Toast'
import { competicoesService } from '../../services/competicoes'
import { Trophy, Users, ChevR, Plus } from '../../lib/icons'

export default function CompeticoesList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [alvo, setAlvo] = useState<{ id: number; nome: string } | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['competicoes'],
    queryFn: competicoesService.listar,
  })

  const { mutateAsync: remover } = useMutation({
    mutationFn: competicoesService.remover,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competicoes'] })
      toast.success('Competição removida.')
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="Operação"
        title="Competições"
        sub="Cada competição define um conjunto de modalidades. Os eventos são edições que herdam essas modalidades."
        actions={
          <button onClick={() => navigate('/competicoes/nova')} className="btn btn-primary">
            <Plus size={16} /> Nova Competição
          </button>
        }
      />

      <div className="p-6">
        {isLoading ? (
          <p className="text-[var(--t3)] text-sm">Carregando...</p>
        ) : data.length === 0 ? (
          <div
            className="text-center text-[var(--t3)] py-16"
            style={{
              background: 'var(--card-bg-2)',
              border: '1px dashed var(--card-border)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <Trophy size={40} className="mx-auto mb-3 text-[var(--t4)]" />
            <p className="text-base mb-1">Nenhuma competição cadastrada.</p>
            <p className="text-sm">Clique em "+ Nova Competição" para começar.</p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: 16,
            }}
          >
            {data.map((c, i) => (
              <div
                key={c.id}
                className="card pad fade-in"
                style={{
                  animationDelay: `${i * 40}ms`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  background: 'var(--card-bg)',
                  border: '1px solid var(--card-border)',
                  borderRadius: 'var(--radius-xl)',
                  padding: 20,
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                {/* Header: icon + nome + counts */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 12, minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 13,
                        background: 'var(--grad-brand-deep)',
                        color: '#fff',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Trophy size={23} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10.5,
                          color: 'var(--t4)',
                          letterSpacing: '0.05em',
                        }}
                      >
                        #{String(c.id).padStart(3, '0')}
                      </div>
                      <h3
                        style={{
                          fontSize: 16,
                          fontWeight: 700,
                          color: 'var(--t1)',
                          lineHeight: 1.2,
                          margin: '2px 0 0',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {c.nome}
                      </h3>
                    </div>
                  </div>
                  {c._count && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        background: 'var(--card-bg-2)',
                        color: 'var(--t3)',
                        border: '1px solid var(--card-border)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c._count.eventos} {c._count.eventos === 1 ? 'evento' : 'eventos'}
                    </span>
                  )}
                </div>

                {/* Estados */}
                {c.estados.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {c.estados
                      .slice()
                      .sort()
                      .map(uf => (
                        <span
                          key={uf}
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--brand-50)',
                            color: 'var(--brand-700)',
                          }}
                        >
                          {uf}
                        </span>
                      ))}
                  </div>
                )}

                {/* Modalidades + subtítulo flag */}
                <div
                  style={{
                    borderTop: '1px solid var(--card-border)',
                    paddingTop: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12.5,
                      color: 'var(--t3)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Users size={14} />
                    {c._count?.modalidades ?? 0} {c._count?.modalidades === 1 ? 'modalidade' : 'modalidades'}
                  </span>
                  {c.subtitulo_campos && c.subtitulo_campos.length > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--t4)', fontStyle: 'italic' }} title={`Campos: ${c.subtitulo_campos.join(' | ')}`}>
                      {c.subtitulo_campos.length === 1 ? '1 campo extra' : `${c.subtitulo_campos.length} campos extras`}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    marginTop: 'auto',
                    paddingTop: 6,
                  }}
                >
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      onClick={() => navigate(`/competicoes/${c.id}/editar`)}
                      className="text-[var(--brand-500)] hover:text-[var(--brand-400)] text-xs font-semibold"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setAlvo({ id: c.id, nome: c.nome })}
                      className="text-[var(--danger)] hover:text-[var(--danger-700)] text-xs font-semibold"
                    >
                      Remover
                    </button>
                  </div>
                  <button
                    onClick={() => navigate(`/eventos?competicao=${c.id}`)}
                    className="btn btn-ghost btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                  >
                    Ver eventos <ChevR size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={alvo !== null}
        onClose={() => setAlvo(null)}
        onConfirm={() => alvo && remover(alvo.id)}
        eyebrow="Remover competição"
        title={alvo?.nome ?? ''}
        description="Essa ação não pode ser desfeita. Eventos vinculados a esta competição podem ser afetados."
        confirmLabel="Remover"
        confirmVariant="danger"
        icon="trash"
      />
    </div>
  )
}
