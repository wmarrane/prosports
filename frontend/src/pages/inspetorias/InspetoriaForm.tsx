import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { inspetoriasService } from '../../services/inspetorias'
import { Check, X } from '../../lib/icons'
import { ShieldCheck } from 'lucide-react'

export default function InspetoriaForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [nome, setNome] = useState('')
  const [erro, setErro] = useState('')

  const { data: existing } = useQuery({
    queryKey: ['inspetorias', Number(id)],
    queryFn: () => inspetoriasService.buscar(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => { if (existing) setNome(existing.nome) }, [existing])

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => isEdit
      ? inspetoriasService.editar(Number(id), { nome: nome.trim() })
      : inspetoriasService.criar({ nome: nome.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspetorias'] })
      navigate('/inspetorias')
    },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!nome.trim()) return setErro('Informe o nome da inspetoria.')
    salvar()
  }

  const inputClass =
    'w-full px-3 py-2.5 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] focus:border-transparent'

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="Cadastro"
        title={isEdit ? 'Editar Inspetoria' : 'Nova Inspetoria'}
        sub={isEdit ? 'Atualize o nome da inspetoria.' : 'Cadastre uma unidade regional de inspeção.'}
        backTo="/inspetorias"
      />

      <div className="p-6" style={{ maxWidth: 540 }}>
        <form onSubmit={handleSubmit}>
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
                <ShieldCheck size={18} />
              </div>
              <div>
                <div className="eyebrow">Identificação</div>
                <h3 className="sec-title" style={{ fontSize: 17 }}>Dados da inspetoria</h3>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                Nome <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                value={nome}
                onChange={e => setNome(e.target.value)}
                required
                className={inputClass}
                placeholder="Ex.: Inspetoria Regional Centro"
                autoFocus
              />
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
              onClick={() => navigate('/inspetorias')}
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
              {isPending ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar inspetoria'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
