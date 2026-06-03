import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useToast } from '../../components/Toast'
import { tiposModalidadeService } from '../../services/tipos-modalidade'
import type { TipoModalidade, TipoDisputa } from '../../types/modalidade'
import { TIPO_DISPUTA_LABEL } from '../../lib/tipo-disputa'
import { Plus } from '../../lib/icons'
import { Brackets, Group, ListOrdered, FileText, Shapes } from 'lucide-react'

const TIPO_ICON: Record<TipoDisputa, typeof Brackets> = {
  chaves: Brackets,
  grupos: Group,
  ordem_entrada: ListOrdered,
  especifico: FileText,
}

const TIPO_GRAD: Record<TipoDisputa, string> = {
  chaves: 'linear-gradient(135deg, #1061d8 0%, #4f8ef7 100%)',
  grupos: 'linear-gradient(135deg, #0d9488 0%, #14b88a 100%)',
  ordem_entrada: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
  especifico: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
}

const TIPO_DESC: Record<TipoDisputa, string> = {
  chaves: 'Eliminação simples em chaveamento. Vencedor avança a cada rodada.',
  grupos: 'Distribuição em grupos com classificação interna por critério.',
  ordem_entrada: 'Apenas ordem de entrada/apresentação dos participantes.',
  especifico: 'Sem sorteio automático — definição manual.',
}

export default function TiposModalidadeList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [alvo, setAlvo] = useState<{ id: number; nome: string } | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['tipos-modalidade'],
    queryFn: tiposModalidadeService.listar,
  })

  const { mutateAsync: remover } = useMutation({
    mutationFn: tiposModalidadeService.remover,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-modalidade'] })
      toast.success('Tipo de modalidade removido.')
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  // Agrupa por tipo de disputa para mostrar mais visual
  const grupos: Array<{ tipo: TipoDisputa; itens: TipoModalidade[] }> = (['chaves', 'grupos', 'ordem_entrada', 'especifico'] as const)
    .map(tipo => ({ tipo, itens: data.filter(t => t.tipo === tipo) }))
    .filter(g => g.itens.length > 0)

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="Cadastro"
        title="Tipos de Modalidade"
        sub="Defina nomes personalizados para cada tipo de disputa (ex.: 'Futsal Adulto' do tipo Chaves). Cada modalidade cadastrada se vincula a um tipo daqui."
        actions={
          <button onClick={() => navigate('/tipos-modalidade/novo')} className="btn btn-primary">
            <Plus size={16} /> Novo Tipo
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
            <Shapes size={40} className="mx-auto mb-3 text-[var(--t4)]" />
            <p className="text-base mb-1">Nenhum tipo de modalidade cadastrado.</p>
            <p className="text-sm">Clique em "+ Novo Tipo" para começar.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {grupos.map(g => {
              const Icon = TIPO_ICON[g.tipo]
              const grad = TIPO_GRAD[g.tipo]
              return (
                <section key={g.tipo}>
                  {/* Header do grupo */}
                  <div className="flex items-center gap-3 mb-3" style={{ paddingBottom: 8, borderBottom: '1px solid var(--card-border)' }}>
                    <span
                      style={{
                        width: 32, height: 32, borderRadius: 9,
                        background: grad, color: '#fff',
                        display: 'grid', placeItems: 'center', flexShrink: 0,
                      }}
                    >
                      <Icon size={16} />
                    </span>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-[var(--t1)]">{TIPO_DISPUTA_LABEL[g.tipo]}</h3>
                      <p className="text-xs text-[var(--t4)] mt-0.5">{TIPO_DESC[g.tipo]}</p>
                    </div>
                    <span className="text-xs text-[var(--t4)] font-mono">
                      {g.itens.length} {g.itens.length === 1 ? 'tipo' : 'tipos'}
                    </span>
                  </div>

                  {/* Cards de tipos */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                      gap: 12,
                    }}
                  >
                    {g.itens.map(t => (
                      <div
                        key={t.id}
                        className="fade-in"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: 14,
                          background: 'var(--card-bg)',
                          border: '1px solid var(--card-border)',
                          borderRadius: 'var(--radius-xl)',
                          boxShadow: 'var(--shadow-card)',
                          cursor: 'pointer',
                          transition: 'border-color 140ms ease',
                        }}
                        onClick={() => navigate(`/tipos-modalidade/${t.id}/editar`)}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand-400)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--card-border)')}
                      >
                        <span
                          style={{
                            width: 42, height: 42, borderRadius: 11,
                            background: grad, color: '#fff',
                            display: 'grid', placeItems: 'center', flexShrink: 0,
                            boxShadow: '0 6px 14px -6px rgba(0,0,0,0.3)',
                          }}
                        >
                          <Icon size={20} />
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>{t.nome}</div>
                          <div className="text-xs text-[var(--t3)] mt-0.5">{TIPO_DISPUTA_LABEL[t.tipo]}</div>
                        </div>
                        <div className="flex gap-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => navigate(`/tipos-modalidade/${t.id}/editar`)}
                            className="text-[var(--brand-500)] hover:text-[var(--brand-400)] text-xs font-semibold"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => setAlvo({ id: t.id, nome: t.nome })}
                            className="text-[var(--danger)] hover:text-[var(--danger-700)] text-xs font-semibold"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={alvo !== null}
        onClose={() => setAlvo(null)}
        onConfirm={() => alvo && remover(alvo.id)}
        eyebrow="Remover tipo de modalidade"
        title={alvo?.nome ?? ''}
        description="Modalidades que usam este tipo precisarão ser reatribuídas."
        confirmLabel="Remover"
        confirmVariant="danger"
        icon="trash"
      />
    </div>
  )
}
