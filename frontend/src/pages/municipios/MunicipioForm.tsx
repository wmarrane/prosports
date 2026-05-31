import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { municipiosService } from '../../services/municipios'
import { UFS } from '../../lib/ufs'
import { Check, X } from '../../lib/icons'
import { Building2 } from 'lucide-react'

export default function MunicipioForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [codigoIbge, setCodigoIbge] = useState('')
  const [nome, setNome] = useState('')
  const [uf, setUf] = useState('SP')
  const [erro, setErro] = useState('')

  const { data: existing } = useQuery({
    queryKey: ['municipios', Number(id)],
    queryFn: () => municipiosService.buscar(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => {
    if (existing) {
      setCodigoIbge(existing.codigo_ibge)
      setNome(existing.nome)
      setUf(existing.uf)
    }
  }, [existing])

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => {
      const data = { codigo_ibge: codigoIbge, nome, uf }
      return isEdit ? municipiosService.editar(Number(id), data) : municipiosService.criar(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['municipios'] })
      navigate('/municipios')
    },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  const inputClass =
    'w-full px-3 py-2.5 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] focus:border-transparent'

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!/^\d{7}$/.test(codigoIbge)) return setErro('Código IBGE deve ter exatamente 7 dígitos.')
    if (!nome.trim()) return setErro('Informe o nome do município.')
    salvar()
  }

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="Cadastro"
        title={isEdit ? 'Editar Município' : 'Novo Município'}
        sub={
          isEdit
            ? 'Atualize o código IBGE, nome ou UF deste município.'
            : 'Cadastre um município pelo código IBGE oficial. Será referenciado por eventos e participantes.'
        }
        backTo="/municipios"
      />

      <div className="p-6" style={{ maxWidth: 600 }}>
        <form onSubmit={handleSubmit}>
          {/* Card único: dados do município */}
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
                <Building2 size={18} />
              </div>
              <div>
                <div className="eyebrow">Identificação</div>
                <h3 className="sec-title" style={{ fontSize: 17 }}>
                  Dados do município
                </h3>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                  Código IBGE <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  value={codigoIbge}
                  onChange={e => setCodigoIbge(e.target.value.replace(/\D/g, ''))}
                  required
                  pattern="\d{7}"
                  maxLength={7}
                  className={`${inputClass} font-mono`}
                  placeholder="Ex.: 3550308"
                  inputMode="numeric"
                />
                <p className="text-xs text-[var(--t4)] mt-1.5">
                  7 dígitos. Consulte em ibge.gov.br se necessário.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                    Nome <span className="text-[var(--danger)]">*</span>
                  </label>
                  <input
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    required
                    className={inputClass}
                    placeholder="Ex.: São Paulo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                    UF <span className="text-[var(--danger)]">*</span>
                  </label>
                  <select
                    value={uf}
                    onChange={e => setUf(e.target.value)}
                    className={`${inputClass} font-mono font-bold`}
                  >
                    {UFS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
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

          {/* Action bar */}
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
              onClick={() => navigate('/municipios')}
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
              {isPending ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar município'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
