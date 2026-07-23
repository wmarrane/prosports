import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import MunicipioSelect from '../../components/MunicipioSelect'
import { participantesService } from '../../services/participantes'
import { inspetoriasService } from '../../services/inspetorias'
import { delegaciasService } from '../../services/delegacias'
import { Check, X } from '../../lib/icons'
import { Users, MapPin } from 'lucide-react'

export default function ParticipanteForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [nome, setNome] = useState('')
  const [subtitulo, setSubtitulo] = useState('')
  const [inspetoriaId, setInspetoriaId] = useState<number | ''>('')
  const [delegaciaId, setDelegaciaId] = useState<number | ''>('')
  const [municipioId, setMunicipioId] = useState<number | null>(null)
  const [erro, setErro] = useState('')

  const { data: inspetorias = [] } = useQuery({
    queryKey: ['inspetorias'],
    queryFn: () => inspetoriasService.listar(),
  })

  const { data: delegacias = [] } = useQuery({
    queryKey: ['delegacias'],
    queryFn: delegaciasService.listar,
  })

  const { data: existing } = useQuery({
    queryKey: ['participantes', Number(id)],
    queryFn: () => participantesService.buscar(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => {
    if (existing) {
      setNome(existing.nome)
      setSubtitulo(existing.subtitulo ?? '')
      setInspetoriaId(existing.inspetoria_id ?? '')
      setDelegaciaId(existing.delegacia_id ?? '')
      setMunicipioId(existing.municipio_id)
    }
  }, [existing])

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => {
      const payload = {
        nome: nome.trim(),
        subtitulo: subtitulo.trim() || null,
        inspetoria_id: inspetoriaId === '' ? null : Number(inspetoriaId),
        delegacia_id: delegaciaId === '' ? null : Number(delegaciaId),
        municipio_id: municipioId!,
      }
      return isEdit
        ? participantesService.editar(Number(id), payload)
        : participantesService.criar(payload as any)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['participantes'] })
      navigate('/participantes')
    },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!nome.trim()) return setErro('Informe o nome.')
    if (!municipioId) return setErro('Selecione um município.')
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
        eyebrow="Cadastro"
        title={isEdit ? 'Editar Participante' : 'Novo Participante'}
        sub={
          isEdit
            ? 'Atualize dados de identificação, vínculo regional e localidade.'
            : 'Cadastre um participante global. Ele poderá ser inscrito em qualquer evento/modalidade.'
        }
        backTo="/participantes"
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
                <h3 className="sec-title" style={{ fontSize: 17 }}>
                  Nome e subtítulo
                </h3>
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
                  Subtítulo <span className="text-[var(--t4)] font-normal text-xs ml-1">(opcional)</span>
                </label>
                <input
                  value={subtitulo}
                  onChange={e => setSubtitulo(e.target.value)}
                  className={inputClass}
                  placeholder="Ex.: Clube Atlético / Equipe Sub-15"
                />
                <p className="text-xs text-[var(--t4)] mt-1.5">
                  Aparece ao lado do nome em competições que tenham essa opção habilitada.
                </p>
              </div>
            </div>
          </section>

          {/* Card: Vínculo regional */}
          <section style={cardStyle}>
            <div className="flex items-center gap-3 mb-5">
              <div
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  color: '#fff', display: 'grid', placeItems: 'center',
                }}
              >
                <MapPin size={18} />
              </div>
              <div>
                <div className="eyebrow">Vínculo</div>
                <h3 className="sec-title" style={{ fontSize: 17 }}>
                  Localidade e regional
                </h3>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                  Município <span className="text-[var(--danger)]">*</span>
                </label>
                <MunicipioSelect value={municipioId} onChange={setMunicipioId} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                    Delegacia <span className="text-[var(--t4)] font-normal text-xs ml-1">(opcional)</span>
                  </label>
                  <select
                    value={delegaciaId}
                    onChange={e => {
                      const nova = e.target.value === '' ? '' : Number(e.target.value)
                      setDelegaciaId(nova)
                      if (inspetoriaId !== '') {
                        const insp = inspetorias.find(i => i.id === inspetoriaId)
                        if (!insp || insp.delegacia_id !== nova) setInspetoriaId('')
                      }
                    }}
                    className={inputClass}
                  >
                    <option value="">— Sem delegacia —</option>
                    {delegacias.map(d => (
                      <option key={d.id} value={d.id}>{d.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                    Inspetoria <span className="text-[var(--t4)] font-normal text-xs ml-1">(opcional)</span>
                  </label>
                  <select
                    value={inspetoriaId}
                    onChange={e => setInspetoriaId(e.target.value === '' ? '' : Number(e.target.value))}
                    disabled={!delegaciaId}
                    className={inputClass}
                    style={{ opacity: !delegaciaId ? 0.5 : 1 }}
                  >
                    <option value="">
                      {!delegaciaId ? '— Selecione a delegacia primeiro —' : '— Sem inspetoria —'}
                    </option>
                    {delegaciaId !== '' && inspetorias
                      .filter(i => i.delegacia_id === delegaciaId)
                      .map(i => (
                        <option key={i.id} value={i.id}>{i.nome}</option>
                      ))}
                  </select>
                  {delegaciaId !== '' && inspetorias.filter(i => i.delegacia_id === delegaciaId).length === 0 && (
                    <p className="text-xs text-[var(--t4)] mt-1">Esta delegacia não possui inspetorias cadastradas.</p>
                  )}
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
              onClick={() => navigate('/participantes')}
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
              {isPending ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar participante'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
