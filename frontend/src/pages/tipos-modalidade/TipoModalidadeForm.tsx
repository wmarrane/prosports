import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { tiposModalidadeService } from '../../services/tipos-modalidade'
import { TIPO_DISPUTA_LABEL, TIPO_DISPUTA_VALUES } from '../../lib/tipo-disputa'
import type { TipoDisputa } from '../../types/modalidade'
import { Check, X } from '../../lib/icons'
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

export default function TipoModalidadeForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<TipoDisputa>('grupos')
  const [erro, setErro] = useState('')

  const { data: existing } = useQuery({
    queryKey: ['tipos-modalidade', Number(id)],
    queryFn: () => tiposModalidadeService.buscar(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => {
    if (existing) {
      setNome(existing.nome)
      setTipo(existing.tipo)
    }
  }, [existing])

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => isEdit
      ? tiposModalidadeService.editar(Number(id), { nome, tipo })
      : tiposModalidadeService.criar({ nome, tipo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-modalidade'] })
      navigate('/tipos-modalidade')
    },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  const inputClass =
    'w-full px-3 py-2.5 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] focus:border-transparent'

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!nome.trim()) return setErro('Informe o nome do tipo.')
    salvar()
  }

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="Cadastro"
        title={isEdit ? 'Editar Tipo de Modalidade' : 'Novo Tipo de Modalidade'}
        sub={
          isEdit
            ? 'Atualize o nome ou o tipo de disputa associado.'
            : 'Crie um nome personalizado para um tipo de disputa (ex.: "Futsal Adulto" → Chaves).'
        }
        backTo="/tipos-modalidade"
      />

      <div className="p-6" style={{ maxWidth: 720 }}>
        <form onSubmit={handleSubmit}>
          {/* Card único */}
          <section
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-xl)',
              padding: 24,
              marginBottom: 16,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div className="flex items-center gap-3 mb-5">
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
                <div className="eyebrow">Identificação</div>
                <h3 className="sec-title" style={{ fontSize: 17 }}>
                  Nome e tipo de disputa
                </h3>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                  Nome <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="Ex.: Futsal Adulto"
                  autoFocus
                />
                <p className="text-xs text-[var(--t4)] mt-1.5">
                  Nome amigável. As modalidades cadastradas escolherão esse tipo no dropdown.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--t2)] mb-2">
                  Tipo de disputa <span className="text-[var(--danger)]">*</span>
                </label>
                <p className="text-xs text-[var(--t4)] mb-3">
                  Define como será feito o sorteio para modalidades desse tipo.
                </p>

                {/* Chips visuais de seleção */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {TIPO_DISPUTA_VALUES.map(t => {
                    const Icon = TIPO_ICON[t]
                    const grad = TIPO_GRAD[t]
                    const ativo = t === tipo
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTipo(t)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '12px 14px',
                          background: ativo ? 'var(--brand-50)' : 'var(--card-bg-2)',
                          border: `1.5px solid ${ativo ? 'var(--brand-500)' : 'var(--card-border)'}`,
                          borderRadius: 'var(--radius-lg)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 120ms ease',
                          width: '100%',
                        }}
                      >
                        <span
                          style={{
                            width: 40, height: 40, borderRadius: 11,
                            background: grad, color: '#fff',
                            display: 'grid', placeItems: 'center', flexShrink: 0,
                          }}
                        >
                          <Icon size={20} />
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>
                            {TIPO_DISPUTA_LABEL[t]}
                          </div>
                          <div className="text-xs text-[var(--t3)] mt-0.5">{TIPO_DESC[t]}</div>
                        </div>
                        {ativo && (
                          <span
                            style={{
                              width: 24, height: 24, borderRadius: '50%',
                              background: 'var(--brand-500)', color: '#fff',
                              display: 'grid', placeItems: 'center', flexShrink: 0,
                            }}
                          >
                            <Check size={14} />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>

          {erro && (
            <div
              style={{
                background: 'var(--danger-soft)',
                color: 'var(--danger)',
                border: '1px solid var(--danger)',
                borderRadius: 'var(--radius-lg)',
                padding: '10px 14px',
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              {erro}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              paddingTop: 16,
              borderTop: '1px solid var(--card-border)',
            }}
          >
            <button
              type="button"
              onClick={() => navigate('/tipos-modalidade')}
              className="btn btn-ghost"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <X size={16} /> Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: isPending ? 0.5 : 1 }}
            >
              <Check size={16} />
              {isPending ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar tipo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
