import { useState, useEffect, useMemo } from 'react'
import type { FormEvent } from 'react'
import type { ChaveVersao } from '../../types/modalidade'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { modalidadesService } from '../../services/modalidades'
import { competicoesService } from '../../services/competicoes'
import { tiposModalidadeService } from '../../services/tipos-modalidade'
import { Check, X, Trophy } from '../../lib/icons'
import { Brackets, Group, ListOrdered, FileText, Shapes, Plus } from 'lucide-react'
import type { MensagemInscritos } from '../../lib/mensagens-inscritos'
import ReplicarMensagensModal from '../../components/ReplicarMensagensModal'

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

export default function ModalidadeForm() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const competicaoIdFromQuery = !isEdit ? Number(searchParams.get('competicao_id')) || '' : ''
  const [competicaoId, setCompeticaoId] = useState<number | ''>(competicaoIdFromQuery)
  const [tipoModalidadeId, setTipoModalidadeId] = useState<number | ''>('')
  const [nome, setNome] = useState('')
  const [sigla, setSigla] = useState('')
  const [chaveVersao, setChaveVersao] = useState<ChaveVersao>('V2')
  const [usaMetadeChave, setUsaMetadeChave] = useState(false)
  const [mascararNomeMod, setMascararNomeMod] = useState(false)
  const [mensagens, setMensagens] = useState<MensagemInscritos[]>([])
  const [replicarOpen, setReplicarOpen] = useState(false)
  const [erro, setErro] = useState('')

  const { data: competicoes = [] } = useQuery({
    queryKey: ['competicoes'],
    queryFn: competicoesService.listar,
  })

  const { data: tipos = [] } = useQuery({
    queryKey: ['tipos-modalidade'],
    queryFn: tiposModalidadeService.listar,
  })

  const { data: existing } = useQuery({
    queryKey: ['modalidades', Number(id)],
    queryFn: () => modalidadesService.buscar(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => {
    if (existing) {
      setCompeticaoId(existing.competicao_id)
      setTipoModalidadeId(existing.tipo_modalidade_id)
      setNome(existing.nome)
      setSigla(existing.sigla)
      setChaveVersao(existing.chave_versao ?? 'V1')
      setUsaMetadeChave(existing.usa_metade_chave === true)
      setMascararNomeMod(existing.mascarar_nome === true)
      setMensagens(existing.mensagens_inscritos ?? [])
    }
  }, [existing])

  const tipoSelecionado = useMemo(
    () => tipos.find(t => t.id === tipoModalidadeId) ?? null,
    [tipos, tipoModalidadeId]
  )

  const competicaoSelecionada = useMemo(
    () => competicoes.find(c => c.id === competicaoId) ?? null,
    [competicoes, competicaoId]
  )

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => {
      const payload = {
        nome: nome.trim(),
        sigla: sigla.trim().toUpperCase(),
        competicao_id: Number(competicaoId),
        tipo_modalidade_id: Number(tipoModalidadeId),
        chave_versao: chaveVersao,
        usa_metade_chave: usaMetadeChave,
        mascarar_nome: mascararNomeMod,
        mensagens_inscritos: mensagens
          .filter(m => m.mensagem.trim() !== '')
          .map(m => ({ ...m, mensagem: m.mensagem.trim() })),
      }
      return isEdit
        ? modalidadesService.editar(Number(id), payload)
        : modalidadesService.criar(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modalidades'] })
      queryClient.invalidateQueries({ queryKey: ['competicoes'] })
      navigate('/modalidades')
    },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!competicaoId) return setErro('Selecione uma competição.')
    if (!tipoModalidadeId) return setErro('Selecione um tipo de modalidade.')
    if (!nome.trim()) return setErro('Informe o nome.')
    if (sigla.trim().length < 2) return setErro('Sigla deve ter ao menos 2 caracteres.')
    salvar()
  }

  function addMensagem() {
    setMensagens(prev => [...prev, { min: 1, max: null, mensagem: '', pular_sorteio: false }])
  }
  function updateMensagem(i: number, patch: Partial<MensagemInscritos>) {
    setMensagens(prev => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)))
  }
  function removeMensagem(i: number) {
    setMensagens(prev => prev.filter((_, idx) => idx !== i))
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
        eyebrow="Operação"
        title={isEdit ? 'Editar Modalidade' : 'Nova Modalidade'}
        sub={
          isEdit
            ? 'Atualize a competição vinculada, o tipo de disputa, nome ou sigla.'
            : 'Cadastre uma modalidade. Ela ficará disponível em todos os eventos desta competição.'
        }
        backTo="/modalidades"
      />

      <div className="p-6" style={{ maxWidth: 720 }}>
        <form onSubmit={handleSubmit}>
          {/* Card: Vinculação */}
          <section style={cardStyle}>
            <div className="flex items-center gap-3 mb-5">
              <div
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'var(--grad-brand-deep)', color: '#fff',
                  display: 'grid', placeItems: 'center',
                }}
              >
                <Trophy size={18} />
              </div>
              <div>
                <div className="eyebrow">Vinculação</div>
                <h3 className="sec-title" style={{ fontSize: 17 }}>
                  Competição e tipo
                </h3>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                  Competição <span className="text-[var(--danger)]">*</span>
                </label>
                <select
                  value={competicaoId}
                  onChange={e => setCompeticaoId(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                  disabled={isEdit}
                  className={inputClass}
                  style={isEdit ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
                >
                  <option value="">— Selecione —</option>
                  {competicoes.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
                {competicaoSelecionada && (
                  <p className="text-xs text-[var(--t4)] mt-1.5">
                    {isEdit
                      ? 'A competição de uma modalidade não pode ser alterada após criação.'
                      : `Modalidade fará parte de "${competicaoSelecionada.nome}".`}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                  Tipo de Modalidade <span className="text-[var(--danger)]">*</span>
                </label>
                <select
                  value={tipoModalidadeId}
                  onChange={e => setTipoModalidadeId(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                  className={inputClass}
                >
                  <option value="">— Selecione —</option>
                  {tipos.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.nome} ({TIPO_LABEL[t.tipo]})
                    </option>
                  ))}
                </select>

                {/* Preview do tipo selecionado */}
                {tipoSelecionado && (() => {
                  const Icon = TIPO_ICON[tipoSelecionado.tipo] ?? FileText
                  const grad = TIPO_GRAD[tipoSelecionado.tipo]
                  return (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 12,
                        background: 'var(--card-bg-2)',
                        border: '1px solid var(--card-border)',
                        borderRadius: 'var(--radius-lg)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
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
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>
                          {tipoSelecionado.nome}
                        </div>
                        <div className="text-xs text-[var(--t3)] mt-0.5">
                          Disputa por <b>{TIPO_LABEL[tipoSelecionado.tipo]}</b> — define como o sorteio será feito.
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          </section>

          {/* Card: Identificação */}
          <section style={cardStyle}>
            <div className="flex items-center gap-3 mb-5">
              <div
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  color: '#fff', display: 'grid', placeItems: 'center',
                }}
              >
                <Shapes size={18} />
              </div>
              <div>
                <div className="eyebrow">Identificação</div>
                <h3 className="sec-title" style={{ fontSize: 17 }}>
                  Nome e sigla
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                  Nome <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="Ex.: Futebol de Salão"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                  Sigla <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  value={sigla}
                  onChange={e => setSigla(e.target.value.toUpperCase())}
                  required
                  maxLength={6}
                  className={`${inputClass} font-mono uppercase`}
                  placeholder="Ex.: FUT"
                />
                <p className="text-xs text-[var(--t4)] mt-1.5">2 a 6 caracteres.</p>
              </div>
            </div>

            {tipoSelecionado?.tipo === 'chaves' && (
              <div style={{ marginTop: 16 }}>
                <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                  Versão da chave
                </label>
                <select
                  value={chaveVersao}
                  onChange={e => setChaveVersao(e.target.value as ChaveVersao)}
                  className={inputClass}
                >
                  <option value="V1">V1 — BYE entra na 2ª rodada</option>
                  <option value="V2">V2 — BYE na 1ª rodada (vs BYE)</option>
                </select>
                <p className="text-xs text-[var(--t4)] mt-1.5">
                  Define o desenho do bracket. Trocar a versão de uma modalidade já sorteada
                  só passa a valer após <b>re-sortear</b>.
                </p>
              </div>
            )}

            {tipoSelecionado?.tipo === 'chaves' && (
              <label className="flex items-start gap-2 text-sm text-[var(--t2)]" style={{ marginTop: 16 }}>
                <input
                  type="checkbox"
                  checked={usaMetadeChave}
                  onChange={e => setUsaMetadeChave(e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <span>
                  Usar metade da chave
                  <span className="block text-xs text-[var(--t4)]">
                    A inscrição pode exigir a parte de cima ou de baixo da chave. Quem é cabeça
                    de chave mantém a posição de cabeça e tem a metade ignorada.
                  </span>
                </span>
              </label>
            )}

            <label className="flex items-start gap-2 text-sm text-[var(--t2)]" style={{ marginTop: 16 }}>
              <input
                type="checkbox"
                checked={mascararNomeMod}
                onChange={e => setMascararNomeMod(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>
                Mascarar nome do participante
                <span className="block text-xs text-[var(--t4)]">
                  No Modo Congresso e no site público aparece só o primeiro nome. As telas
                  internas e os relatórios seguem com o nome completo.
                </span>
              </span>
            </label>
          </section>

          {(tipoSelecionado?.tipo === 'grupos' || tipoSelecionado?.tipo === 'chaves') && (
            <section style={cardStyle}>
              <div className="flex items-center gap-3 mb-1">
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #0d9488 0%, #14b88a 100%)', color: '#fff', display: 'grid', placeItems: 'center' }}>
                  <FileText size={18} />
                </div>
                <div>
                  <div className="eyebrow">Modo Congresso</div>
                  <h3 className="sec-title" style={{ fontSize: 17 }}>Mensagens por nº de inscritos</h3>
                </div>
              </div>
              <p className="text-xs text-[var(--t3)] mb-4 ml-12">
                Exibidas na tela "Inscritos" do Modo Congresso quando o nº de inscritos cair na faixa. "Pular sorteio" faz a próxima etapa voltar para a tela de modalidade.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {mensagens.map((m, i) => (
                  <div key={i} style={{ border: '1px solid var(--card-border)', borderRadius: 'var(--radius-lg)', padding: 12, background: 'var(--card-bg-2)' }}>
                    <div className="grid grid-cols-2 gap-3" style={{ marginBottom: 8 }}>
                      <div>
                        <label className="block text-xs font-medium text-[var(--t2)] mb-1">De (mín.)</label>
                        <input type="number" min={1} value={m.min}
                          onChange={e => updateMensagem(i, { min: Math.max(1, Number(e.target.value) || 1) })}
                          className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--t2)] mb-1">Até (vazio = sem limite)</label>
                        <input type="number" min={1} value={m.max ?? ''}
                          onChange={e => updateMensagem(i, { max: e.target.value === '' ? null : Number(e.target.value) })}
                          className={inputClass} />
                      </div>
                    </div>
                    <label className="block text-xs font-medium text-[var(--t2)] mb-1">Mensagem</label>
                    <textarea value={m.mensagem} rows={2}
                      onChange={e => updateMensagem(i, { mensagem: e.target.value })}
                      className={inputClass} style={{ resize: 'vertical' }} />
                    <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
                      <label className="inline-flex items-center gap-2 text-sm text-[var(--t2)]">
                        <input type="checkbox" checked={m.pular_sorteio}
                          onChange={e => updateMensagem(i, { pular_sorteio: e.target.checked })} />
                        Pular sorteio (voltar para modalidade)
                      </label>
                      <button type="button" onClick={() => removeMensagem(i)} className="text-[var(--danger)] text-xs font-semibold">Remover</button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" onClick={addMensagem} className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Plus size={16} /> Adicionar mensagem
                </button>
                {isEdit && (
                  <button type="button" onClick={() => setReplicarOpen(true)} className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    Replicar para outras modalidades…
                  </button>
                )}
              </div>
            </section>
          )}

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
              onClick={() => navigate('/modalidades')}
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
              {isPending ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar modalidade'}
            </button>
          </div>
          {isEdit && tipoSelecionado && (
            <ReplicarMensagensModal
              open={replicarOpen}
              onClose={() => setReplicarOpen(false)}
              tipo={tipoSelecionado.tipo}
              origemId={Number(id)}
              mensagens={mensagens.filter(m => m.mensagem.trim() !== '').map(m => ({ ...m, mensagem: m.mensagem.trim() }))}
            />
          )}
        </form>
      </div>
    </div>
  )
}
