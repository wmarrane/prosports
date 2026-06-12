import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { usersService } from '../../services/users'
import type { Role } from '../../types/auth'
import { Check, X, Key } from '../../lib/icons'
import { Users, ShieldCheck } from 'lucide-react'
import ResetSenhaModal from './ResetSenhaModal'

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'ADMIN', label: 'Admin — acesso total' },
  { value: 'PARTICIPANTE', label: 'Participante — uso operacional' },
  { value: 'VIEWER', label: 'Viewer — apenas leitura' },
  { value: 'COMISSAO_TECNICA', label: 'Comissão Técnica — opera eventos atribuídos' },
]

export default function UsuarioForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('VIEWER')
  const [senha, setSenha] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [erro, setErro] = useState('')
  const [resetOpen, setResetOpen] = useState(false)

  const { data: existing } = useQuery({
    queryKey: ['users', Number(id)],
    queryFn: () => usersService.buscar(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => {
    if (existing) {
      setNome(existing.nome)
      setEmail(existing.email)
      setRole(existing.role)
      setAtivo(existing.ativo)
    }
  }, [existing])

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => {
      if (isEdit) {
        return usersService.editar(Number(id), { nome: nome.trim(), email: email.trim(), role, ativo })
      }
      return usersService.criar({ nome: nome.trim(), email: email.trim(), role, senha })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      navigate('/usuarios')
    },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!nome.trim()) return setErro('Informe o nome.')
    if (!email.trim()) return setErro('Informe o email.')
    if (!isEdit && senha.length < 8) return setErro('A senha inicial deve ter no mínimo 8 caracteres.')
    salvar()
  }

  const inputClass =
    'w-full px-3 py-2.5 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] focus:border-transparent'

  const cardStyle = {
    background: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-xl)',
    padding: 24,
    marginBottom: 16,
    boxShadow: 'var(--shadow-card)',
  } as const

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="Administração"
        title={isEdit ? 'Editar Usuário' : 'Novo Usuário'}
        sub={
          isEdit
            ? 'Atualize identificação, perfil e ativação.'
            : 'Cadastre um novo usuário com perfil e senha inicial.'
        }
        backTo="/usuarios"
      />

      <div className="p-6" style={{ maxWidth: 720 }}>
        <form onSubmit={handleSubmit}>
          {/* Card: Identificação */}
          <section style={cardStyle}>
            <div className="flex items-center gap-3 mb-5">
              <div
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'var(--grad-brand-deep)', color: '#fff',
                  display: 'grid', placeItems: 'center',
                }}
              >
                <Users size={18} />
              </div>
              <div>
                <div className="eyebrow">Identificação</div>
                <h3 className="sec-title" style={{ fontSize: 17 }}>Nome e email</h3>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                  Nome <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="Ex.: João da Silva"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                  Email <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="usuario@empresa.com"
                />
              </div>
            </div>
          </section>

          {/* Card: Acesso */}
          <section style={cardStyle}>
            <div className="flex items-center gap-3 mb-5">
              <div
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  color: '#fff', display: 'grid', placeItems: 'center',
                }}
              >
                <ShieldCheck size={18} />
              </div>
              <div>
                <div className="eyebrow">Acesso</div>
                <h3 className="sec-title" style={{ fontSize: 17 }}>
                  Perfil e {isEdit ? 'ativação' : 'senha inicial'}
                </h3>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                  Perfil <span className="text-[var(--danger)]">*</span>
                </label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as Role)}
                  className={inputClass}
                >
                  {ROLE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {!isEdit ? (
                <div>
                  <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                    Senha inicial <span className="text-[var(--danger)]">*</span>
                    <span className="text-[var(--t4)] font-normal text-xs ml-2">(mín. 8 caracteres)</span>
                  </label>
                  <input
                    type="password"
                    value={senha}
                    onChange={e => setSenha(e.target.value)}
                    required
                    minLength={8}
                    className={inputClass}
                    placeholder="••••••••"
                  />
                </div>
              ) : (
                <>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ativo}
                      onChange={e => setAtivo(e.target.checked)}
                      style={{ width: 18, height: 18, accentColor: 'var(--brand-500)' }}
                    />
                    <span className="text-sm text-[var(--t1)]">
                      Usuário ativo
                      <span className="text-xs text-[var(--t3)] ml-2">
                        (desmarcado, não consegue fazer login)
                      </span>
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setResetOpen(true)}
                    className="btn btn-ghost"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
                  >
                    <Key size={14} /> Resetar senha do usuário
                  </button>
                </>
              )}
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
              onClick={() => navigate('/usuarios')}
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
              {isPending ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar usuário'}
            </button>
          </div>
        </form>
      </div>

      {isEdit && existing && resetOpen && (
        <ResetSenhaModal user={existing} onClose={() => setResetOpen(false)} />
      )}
    </div>
  )
}
