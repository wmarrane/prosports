import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { modalidadesService } from '../../services/modalidades'
import { tiposModalidadeService } from '../../services/tipos-modalidade'
import { Plus, X, Check } from '../../lib/icons'
import { Brackets, Group, ListOrdered, FileText, Shapes } from 'lucide-react'

type Props = {
  competicaoId: number
}

const TIPO_ICON: Record<string, typeof Brackets> = {
  chaves: Brackets,
  grupos: Group,
  ordem_entrada: ListOrdered,
  especifico: FileText,
}

const TIPO_GRAD: Record<string, string> = {
  chaves: 'linear-gradient(135deg, #1061d8 0%, #4f8ef7 100%)',
  grupos: 'linear-gradient(135deg, #0d9488 0%, #14b88a 100%)',
  ordem_entrada: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
  especifico: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
}

const TIPO_LABEL: Record<string, string> = {
  chaves: 'Chaves',
  grupos: 'Grupos',
  ordem_entrada: 'Ordem de entrada',
  especifico: 'Específico',
}

export default function ModalidadesPanel({ competicaoId }: Props) {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [newNome, setNewNome] = useState('')
  const [newSigla, setNewSigla] = useState('')
  const [newTipoId, setNewTipoId] = useState<number | ''>('')
  const [addErro, setAddErro] = useState('')

  const { data: modalidades = [], isLoading } = useQuery({
    queryKey: ['modalidades', competicaoId],
    queryFn: () => modalidadesService.listar({ competicao_id: competicaoId }),
  })

  const { data: tipos = [] } = useQuery({
    queryKey: ['tipos-modalidade'],
    queryFn: tiposModalidadeService.listar,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['modalidades', competicaoId] })
    queryClient.invalidateQueries({ queryKey: ['modalidades'] })
    queryClient.invalidateQueries({ queryKey: ['competicoes'] })
  }

  const { mutate: criar, isPending: salvandoNew } = useMutation({
    mutationFn: () =>
      modalidadesService.criar({
        nome: newNome.trim(),
        sigla: newSigla.trim().toUpperCase(),
        competicao_id: competicaoId,
        tipo_modalidade_id: Number(newTipoId),
      }),
    onSuccess: () => {
      invalidate()
      setNewNome('')
      setNewSigla('')
      setNewTipoId('')
      setAddOpen(false)
      setAddErro('')
    },
    onError: (err: any) => setAddErro(err?.response?.data?.message ?? 'Erro ao criar modalidade.'),
  })

  const { mutate: remover } = useMutation({
    mutationFn: (modalidadeId: number) => modalidadesService.remover(modalidadeId),
    onSuccess: invalidate,
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover modalidade.'),
  })

  function handleAdd() {
    setAddErro('')
    if (!newNome.trim()) return setAddErro('Informe o nome.')
    if (newSigla.trim().length < 2) return setAddErro('Sigla deve ter ao menos 2 caracteres.')
    if (!newTipoId) return setAddErro('Selecione o tipo de modalidade.')
    criar()
  }

  return (
    <section
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-xl)',
        padding: 24,
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'var(--grad-brand-deep)', color: '#fff',
              display: 'grid', placeItems: 'center',
            }}
          >
            <Shapes size={18} />
          </div>
          <div>
            <div className="eyebrow">Estrutura</div>
            <h3 className="sec-title" style={{ fontSize: 17 }}>
              Modalidades
              <span className="text-[var(--t4)] font-normal text-sm ml-2">({modalidades.length})</span>
            </h3>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setAddOpen(true); setAddErro('') }}
          disabled={addOpen}
          className="btn btn-primary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: addOpen ? 0.5 : 1 }}
        >
          <Plus size={14} /> Adicionar
        </button>
      </div>

      {/* Inline ADD row */}
      {addOpen && (
        <div
          style={{
            display: 'flex', flexDirection: 'column', gap: 10,
            padding: 14,
            background: 'var(--card-bg-2)',
            border: '1px solid var(--brand-500)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              value={newNome}
              onChange={e => setNewNome(e.target.value)}
              placeholder="Nome da modalidade"
              className="flex-1 min-w-[180px] px-3 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
              autoFocus
            />
            <input
              type="text"
              value={newSigla}
              onChange={e => setNewSigla(e.target.value.toUpperCase())}
              placeholder="SIGLA"
              maxLength={10}
              className="w-24 px-3 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--t1)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
            />
            <select
              value={newTipoId}
              onChange={e => setNewTipoId(e.target.value === '' ? '' : Number(e.target.value))}
              className="min-w-[160px] px-3 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
            >
              <option value="">— Tipo —</option>
              {tipos.map(t => (
                <option key={t.id} value={t.id}>{t.nome} ({TIPO_LABEL[t.tipo]})</option>
              ))}
            </select>
          </div>
          {addErro && (
            <div style={{ color: 'var(--danger)', fontSize: 12 }}>{addErro}</div>
          )}
          <div className="flex justify-end gap-8">
            <button
              type="button"
              onClick={() => { setAddOpen(false); setAddErro(''); setNewNome(''); setNewSigla(''); setNewTipoId('') }}
              className="text-xs text-[var(--t3)] hover:text-[var(--t1)] font-semibold"
            >
              <X size={14} className="inline mr-1" /> Cancelar
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={salvandoNew}
              className="text-xs text-[var(--brand-500)] hover:text-[var(--brand-400)] font-semibold"
              style={{ opacity: salvandoNew ? 0.5 : 1 }}
            >
              <Check size={14} className="inline mr-1" />
              {salvandoNew ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        </div>
      )}

      {/* List or empty */}
      {isLoading ? (
        <p className="text-sm text-[var(--t3)]">Carregando modalidades...</p>
      ) : modalidades.length === 0 ? (
        <div
          className="text-center text-[var(--t3)] py-10"
          style={{
            background: 'var(--card-bg-2)',
            border: '1px dashed var(--card-border)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <Shapes size={36} className="mx-auto mb-3 text-[var(--t4)]" />
          <p className="text-sm mb-1">Nenhuma modalidade cadastrada.</p>
          <p className="text-xs text-[var(--t4)]">
            Eventos desta competição não terão modalidades disponíveis até você adicionar.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {modalidades.map(m => {
            const tipo = m.tipo_modalidade?.tipo ?? 'especifico'
            const Icon = TIPO_ICON[tipo] ?? FileText
            const grad = TIPO_GRAD[tipo]
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  background: 'var(--card-bg-2)',
                  border: '1px solid var(--card-border)',
                  borderRadius: 'var(--radius-lg)',
                }}
              >
                <span
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: grad, color: '#fff',
                    display: 'grid', placeItems: 'center', flexShrink: 0,
                  }}
                >
                  <Icon size={18} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>{m.nome}</span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--t3)',
                        background: 'var(--card-bg)',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      {m.sigla}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--t3)] mt-0.5">{TIPO_LABEL[tipo]}</div>
                </div>
                <div className="flex gap-3 flex-shrink-0">
                  <Link
                    to={`/modalidades/${m.id}/editar`}
                    className="text-[var(--brand-500)] hover:text-[var(--brand-400)] text-xs font-semibold"
                  >
                    Editar
                  </Link>
                  <button
                    type="button"
                    onClick={() => { if (confirm(`Remover modalidade "${m.nome}"?`)) remover(m.id) }}
                    className="text-[var(--danger)] hover:text-[var(--danger-700)] text-xs font-semibold"
                  >
                    Remover
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Legenda tipos */}
      <div
        style={{
          display: 'flex',
          gap: 14,
          flexWrap: 'wrap',
          paddingTop: 14,
          marginTop: 14,
          borderTop: '1px solid var(--card-border)',
        }}
      >
        {(['chaves', 'grupos', 'ordem_entrada', 'especifico'] as const).map(t => {
          const Icon = TIPO_ICON[t]
          return (
            <span
              key={t}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11.5,
                color: 'var(--t3)',
              }}
            >
              <span
                style={{
                  width: 18, height: 18, borderRadius: 6,
                  background: TIPO_GRAD[t], color: '#fff',
                  display: 'grid', placeItems: 'center',
                }}
              >
                <Icon size={10} />
              </span>
              {TIPO_LABEL[t]}
            </span>
          )
        })}
      </div>
    </section>
  )
}
