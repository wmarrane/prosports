import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useToast } from '../../components/Toast'
import { competicoesService } from '../../services/competicoes'
import {
  sistemasDisputaService,
  type SistemaGrupos,
  type SistemaChaves,
} from '../../services/sistemas-disputa'
import { Plus, X, Check, Copy } from '../../lib/icons'
import { Group as GroupIcon, Brackets } from 'lucide-react'

type Aba = 'grupos' | 'chaves'

export default function SistemasDisputa() {
  const queryClient = useQueryClient()
  const [aba, setAba] = useState<Aba>('grupos')
  const [competicaoId, setCompeticaoId] = useState<number | ''>('')
  const [copiarOpen, setCopiarOpen] = useState(false)

  const { data: competicoes = [] } = useQuery({
    queryKey: ['competicoes'],
    queryFn: () => competicoesService.listar(),
  })

  // Auto-seleciona primeira competição
  if (competicaoId === '' && competicoes.length > 0) {
    setCompeticaoId(competicoes[0].id)
  }

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="Administração"
        title="Sistemas de disputa"
        sub="Regras de composição de grupos e posições de cabeças-de-chave por competição. Cada competição pode ter seu próprio conjunto de regras."
        actions={
          <button
            type="button"
            onClick={() => setCopiarOpen(true)}
            disabled={!competicaoId || competicoes.length < 2}
            className="btn btn-ghost"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: !competicaoId || competicoes.length < 2 ? 0.5 : 1 }}
          >
            <Copy size={16} /> Copiar de outra competição
          </button>
        }
      />

      <div className="p-6 space-y-4">
        {/* Selector de competição + abas */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          background: 'var(--card-bg)', border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-xl)', padding: 16,
        }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t3)' }}>Competição:</label>
          <select
            value={competicaoId}
            onChange={e => setCompeticaoId(e.target.value === '' ? '' : Number(e.target.value))}
            className="px-3 py-2 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm min-w-[260px]"
          >
            <option value="">— Selecione —</option>
            {competicoes.map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, background: 'var(--card-bg-2)', borderRadius: 'var(--radius-lg)', padding: 4 }}>
            {(['grupos', 'chaves'] as const).map(a => {
              const ativa = aba === a
              const Icon = a === 'grupos' ? GroupIcon : Brackets
              return (
                <button
                  key={a}
                  onClick={() => setAba(a)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 'var(--radius-md)',
                    fontSize: 13, fontWeight: 600,
                    background: ativa ? 'var(--brand-500)' : 'transparent',
                    color: ativa ? '#fff' : 'var(--t2)',
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  <Icon size={15} /> {a === 'grupos' ? 'Grupos' : 'Chaves'}
                </button>
              )
            })}
          </div>
        </div>

        {competicaoId && aba === 'grupos' && <GruposTabela competicaoId={competicaoId} />}
        {competicaoId && aba === 'chaves' && <ChavesTabela competicaoId={competicaoId} />}
        {!competicaoId && (
          <div className="text-center text-[var(--t3)] py-12" style={{
            background: 'var(--card-bg-2)', border: '1px dashed var(--card-border)', borderRadius: 'var(--radius-xl)',
          }}>
            Selecione uma competição para gerenciar as regras.
          </div>
        )}
      </div>

      {copiarOpen && competicaoId && (
        <CopiarModal
          destinoId={competicaoId}
          destinoNome={competicoes.find(c => c.id === competicaoId)?.nome ?? ''}
          competicoes={competicoes.filter(c => c.id !== competicaoId).map(c => ({ id: c.id, nome: c.nome }))}
          onClose={() => setCopiarOpen(false)}
          onCopiado={() => {
            queryClient.invalidateQueries({ queryKey: ['sistemas-disputa-grupos', competicaoId] })
            queryClient.invalidateQueries({ queryKey: ['sistemas-disputa-chaves', competicaoId] })
            setCopiarOpen(false)
          }}
        />
      )}
    </div>
  )
}

// ===== Tabela de Grupos =====

const GRUPOS_VAZIO = {
  quantidade_equipes: '',
  quantidade_grupos: '',
  grupos_3_componentes: '',
  grupos_4_componentes: '',
  numero_classificados: '',
}

function GruposTabela({ competicaoId }: { competicaoId: number }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [adicionando, setAdicionando] = useState(false)
  const [novo, setNovo] = useState<Record<string, string>>(GRUPOS_VAZIO)
  const [editando, setEditando] = useState<number | null>(null)
  const [edicao, setEdicao] = useState<Record<string, string>>({})
  const [alvo, setAlvo] = useState<{ id: number; quantidade_equipes: number } | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['sistemas-disputa-grupos', competicaoId],
    queryFn: () => sistemasDisputaService.grupos.listar(competicaoId),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['sistemas-disputa-grupos', competicaoId] })

  const { mutate: criar, isPending: salvandoNovo } = useMutation({
    mutationFn: () => sistemasDisputaService.grupos.criar({
      competicao_id: competicaoId,
      quantidade_equipes: Number(novo.quantidade_equipes),
      quantidade_grupos: Number(novo.quantidade_grupos),
      grupos_3_componentes: Number(novo.grupos_3_componentes),
      grupos_4_componentes: Number(novo.grupos_4_componentes),
      numero_classificados: Number(novo.numero_classificados),
    }),
    onSuccess: () => { invalidate(); setAdicionando(false); setNovo(GRUPOS_VAZIO) },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao criar.'),
  })

  const { mutate: salvar, isPending: salvandoEdit } = useMutation({
    mutationFn: ({ id, dados }: { id: number; dados: Partial<SistemaGrupos> }) =>
      sistemasDisputaService.grupos.editar(id, dados),
    onSuccess: () => { invalidate(); setEditando(null) },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  const { mutateAsync: remover } = useMutation({
    mutationFn: sistemasDisputaService.grupos.remover,
    onSuccess: () => { invalidate(); toast.success('Regra removida.') },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  function iniciarEdicao(r: SistemaGrupos) {
    setEditando(r.id)
    setEdicao({
      quantidade_equipes: String(r.quantidade_equipes),
      quantidade_grupos: String(r.quantidade_grupos),
      grupos_3_componentes: String(r.grupos_3_componentes),
      grupos_4_componentes: String(r.grupos_4_componentes),
      numero_classificados: String(r.numero_classificados),
    })
  }

  const COLS = ['Equipes', 'Grupos', 'Grupos de 3', 'Grupos de 4', 'Classificados', 'Ações']

  return (
    <div style={{
      background: 'var(--card-bg)', border: '1px solid var(--card-border)',
      borderRadius: 'var(--radius-xl)', padding: 16,
    }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="eyebrow">Regras</div>
          <h3 className="text-sm font-bold text-[var(--t1)]">Composição de grupos ({data.length})</h3>
        </div>
        {!adicionando && (
          <button type="button" onClick={() => setAdicionando(true)} className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Adicionar regra
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--t3)]">Carregando...</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                {COLS.map(c => (
                  <th key={c} style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--t3)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {adicionando && (
                <tr style={{ background: 'var(--card-bg-2)' }}>
                  {(['quantidade_equipes', 'quantidade_grupos', 'grupos_3_componentes', 'grupos_4_componentes', 'numero_classificados'] as const).map(campo => (
                    <td key={campo} style={{ padding: '6px 10px' }}>
                      <input
                        type="number"
                        min={0}
                        value={novo[campo]}
                        onChange={e => setNovo(s => ({ ...s, [campo]: e.target.value }))}
                        className="w-full px-2 py-1.5 rounded bg-[var(--card-bg)] border border-[var(--card-border)] text-sm font-mono"
                      />
                    </td>
                  ))}
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                    <button onClick={() => criar()} disabled={salvandoNovo} className="text-[var(--brand-500)] text-xs font-semibold mr-2"><Check size={14} className="inline mr-1" />Salvar</button>
                    <button onClick={() => { setAdicionando(false); setNovo(GRUPOS_VAZIO) }} className="text-[var(--t3)] text-xs font-semibold"><X size={14} className="inline mr-1" />Cancelar</button>
                  </td>
                </tr>
              )}
              {data.length === 0 && !adicionando ? (
                <tr><td colSpan={COLS.length} style={{ textAlign: 'center', padding: 24, color: 'var(--t3)' }}>Nenhuma regra cadastrada para esta competição.</td></tr>
              ) : (
                data.map(r => {
                  const emEdicao = editando === r.id
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                      {(['quantidade_equipes', 'quantidade_grupos', 'grupos_3_componentes', 'grupos_4_componentes', 'numero_classificados'] as const).map(campo => (
                        <td key={campo} style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)' }}>
                          {emEdicao ? (
                            <input
                              type="number" min={0}
                              value={edicao[campo]}
                              onChange={e => setEdicao(s => ({ ...s, [campo]: e.target.value }))}
                              className="w-full px-2 py-1 rounded bg-[var(--card-bg-2)] border border-[var(--card-border)] text-sm font-mono"
                            />
                          ) : r[campo]}
                        </td>
                      ))}
                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                        {emEdicao ? (
                          <>
                            <button onClick={() => salvar({ id: r.id, dados: {
                              quantidade_equipes: Number(edicao.quantidade_equipes),
                              quantidade_grupos: Number(edicao.quantidade_grupos),
                              grupos_3_componentes: Number(edicao.grupos_3_componentes),
                              grupos_4_componentes: Number(edicao.grupos_4_componentes),
                              numero_classificados: Number(edicao.numero_classificados),
                            }})} disabled={salvandoEdit} className="text-[var(--brand-500)] text-xs font-semibold mr-2">Salvar</button>
                            <button onClick={() => setEditando(null)} className="text-[var(--t3)] text-xs font-semibold">Cancelar</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => iniciarEdicao(r)} className="text-[var(--brand-500)] hover:text-[var(--brand-400)] text-xs font-semibold mr-3">Editar</button>
                            <button onClick={() => setAlvo({ id: r.id, quantidade_equipes: r.quantidade_equipes })} className="text-[var(--danger)] hover:text-[var(--danger-700)] text-xs font-semibold">Remover</button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={alvo !== null}
        onClose={() => setAlvo(null)}
        onConfirm={() => alvo && remover(alvo.id)}
        eyebrow="Remover regra (Grupos)"
        title={alvo ? `${alvo.quantidade_equipes} equipes` : ''}
        description="A regra de composição de grupos para essa quantidade será apagada."
        confirmLabel="Remover"
        confirmVariant="danger"
        icon="trash"
      />
    </div>
  )
}

// ===== Tabela de Chaves =====

const CHAVES_VAZIO = {
  numero_inscrito: '',
  posicao_primeiro_cabeca: '',
  posicao_segundo_cabeca: '',
  posicao_terceiro_cabeca: '',
  posicao_quarto_cabeca: '',
}

function ChavesTabela({ competicaoId }: { competicaoId: number }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [adicionando, setAdicionando] = useState(false)
  const [novo, setNovo] = useState<Record<string, string>>(CHAVES_VAZIO)
  const [editando, setEditando] = useState<number | null>(null)
  const [edicao, setEdicao] = useState<Record<string, string>>({})
  const [alvo, setAlvo] = useState<{ id: number; numero_inscrito: number } | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['sistemas-disputa-chaves', competicaoId],
    queryFn: () => sistemasDisputaService.chaves.listar(competicaoId),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['sistemas-disputa-chaves', competicaoId] })

  const { mutate: criar, isPending: salvandoNovo } = useMutation({
    mutationFn: () => sistemasDisputaService.chaves.criar({
      competicao_id: competicaoId,
      numero_inscrito: Number(novo.numero_inscrito),
      posicao_primeiro_cabeca: Number(novo.posicao_primeiro_cabeca),
      posicao_segundo_cabeca: Number(novo.posicao_segundo_cabeca),
      posicao_terceiro_cabeca: Number(novo.posicao_terceiro_cabeca),
      posicao_quarto_cabeca: Number(novo.posicao_quarto_cabeca),
    }),
    onSuccess: () => { invalidate(); setAdicionando(false); setNovo(CHAVES_VAZIO) },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao criar.'),
  })

  const { mutate: salvar, isPending: salvandoEdit } = useMutation({
    mutationFn: ({ id, dados }: { id: number; dados: Partial<SistemaChaves> }) =>
      sistemasDisputaService.chaves.editar(id, dados),
    onSuccess: () => { invalidate(); setEditando(null) },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  const { mutateAsync: remover } = useMutation({
    mutationFn: sistemasDisputaService.chaves.remover,
    onSuccess: () => { invalidate(); toast.success('Regra removida.') },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  function iniciarEdicao(r: SistemaChaves) {
    setEditando(r.id)
    setEdicao({
      numero_inscrito: String(r.numero_inscrito),
      posicao_primeiro_cabeca: String(r.posicao_primeiro_cabeca),
      posicao_segundo_cabeca: String(r.posicao_segundo_cabeca),
      posicao_terceiro_cabeca: String(r.posicao_terceiro_cabeca),
      posicao_quarto_cabeca: String(r.posicao_quarto_cabeca),
    })
  }

  const COLS = ['Inscritos', '1º cabeça', '2º cabeça', '3º cabeça', '4º cabeça', 'Ações']
  const CAMPOS = ['numero_inscrito', 'posicao_primeiro_cabeca', 'posicao_segundo_cabeca', 'posicao_terceiro_cabeca', 'posicao_quarto_cabeca'] as const

  return (
    <div style={{
      background: 'var(--card-bg)', border: '1px solid var(--card-border)',
      borderRadius: 'var(--radius-xl)', padding: 16,
    }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="eyebrow">Regras</div>
          <h3 className="text-sm font-bold text-[var(--t1)]">Posições dos cabeças-de-chave ({data.length})</h3>
        </div>
        {!adicionando && (
          <button type="button" onClick={() => setAdicionando(true)} className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Adicionar regra
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--t3)]">Carregando...</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                {COLS.map(c => (
                  <th key={c} style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--t3)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {adicionando && (
                <tr style={{ background: 'var(--card-bg-2)' }}>
                  {CAMPOS.map(campo => (
                    <td key={campo} style={{ padding: '6px 10px' }}>
                      <input
                        type="number" min={0}
                        value={novo[campo]}
                        onChange={e => setNovo(s => ({ ...s, [campo]: e.target.value }))}
                        className="w-full px-2 py-1.5 rounded bg-[var(--card-bg)] border border-[var(--card-border)] text-sm font-mono"
                      />
                    </td>
                  ))}
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                    <button onClick={() => criar()} disabled={salvandoNovo} className="text-[var(--brand-500)] text-xs font-semibold mr-2"><Check size={14} className="inline mr-1" />Salvar</button>
                    <button onClick={() => { setAdicionando(false); setNovo(CHAVES_VAZIO) }} className="text-[var(--t3)] text-xs font-semibold"><X size={14} className="inline mr-1" />Cancelar</button>
                  </td>
                </tr>
              )}
              {data.length === 0 && !adicionando ? (
                <tr><td colSpan={COLS.length} style={{ textAlign: 'center', padding: 24, color: 'var(--t3)' }}>Nenhuma regra cadastrada para esta competição.</td></tr>
              ) : (
                data.map(r => {
                  const emEdicao = editando === r.id
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                      {CAMPOS.map(campo => (
                        <td key={campo} style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)' }}>
                          {emEdicao ? (
                            <input
                              type="number" min={0}
                              value={edicao[campo]}
                              onChange={e => setEdicao(s => ({ ...s, [campo]: e.target.value }))}
                              className="w-full px-2 py-1 rounded bg-[var(--card-bg-2)] border border-[var(--card-border)] text-sm font-mono"
                            />
                          ) : r[campo]}
                        </td>
                      ))}
                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                        {emEdicao ? (
                          <>
                            <button onClick={() => salvar({ id: r.id, dados: {
                              numero_inscrito: Number(edicao.numero_inscrito),
                              posicao_primeiro_cabeca: Number(edicao.posicao_primeiro_cabeca),
                              posicao_segundo_cabeca: Number(edicao.posicao_segundo_cabeca),
                              posicao_terceiro_cabeca: Number(edicao.posicao_terceiro_cabeca),
                              posicao_quarto_cabeca: Number(edicao.posicao_quarto_cabeca),
                            }})} disabled={salvandoEdit} className="text-[var(--brand-500)] text-xs font-semibold mr-2">Salvar</button>
                            <button onClick={() => setEditando(null)} className="text-[var(--t3)] text-xs font-semibold">Cancelar</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => iniciarEdicao(r)} className="text-[var(--brand-500)] hover:text-[var(--brand-400)] text-xs font-semibold mr-3">Editar</button>
                            <button onClick={() => setAlvo({ id: r.id, numero_inscrito: r.numero_inscrito })} className="text-[var(--danger)] hover:text-[var(--danger-700)] text-xs font-semibold">Remover</button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={alvo !== null}
        onClose={() => setAlvo(null)}
        onConfirm={() => alvo && remover(alvo.id)}
        eyebrow="Remover regra (Chaves)"
        title={alvo ? `${alvo.numero_inscrito} inscritos` : ''}
        description="A regra de posicionamento de cabeças-de-chave para essa quantidade será apagada."
        confirmLabel="Remover"
        confirmVariant="danger"
        icon="trash"
      />
    </div>
  )
}

// ===== Modal Copiar =====

type CopiarProps = {
  destinoId: number
  destinoNome: string
  competicoes: Array<{ id: number; nome: string }>
  onClose: () => void
  onCopiado: () => void
}

function CopiarModal({ destinoId, destinoNome, competicoes, onClose, onCopiado }: CopiarProps) {
  const [origemId, setOrigemId] = useState<number | ''>('')
  const [tipo, setTipo] = useState<'grupos' | 'chaves' | 'ambos'>('ambos')

  const { mutate: copiar, isPending, data: resultado, error } = useMutation({
    mutationFn: () => sistemasDisputaService.copiar({
      origem_id: Number(origemId),
      destino_id: destinoId,
      tipo,
    }),
    onSuccess: () => { setTimeout(onCopiado, 1500) },
  })

  const origemNome = useMemo(() => competicoes.find(c => c.id === origemId)?.nome ?? '', [competicoes, origemId])

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 310 }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--card-bg)', border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-2xl)', padding: 28, maxWidth: 520, width: '100%', margin: '0 16px',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'var(--grad-brand-deep)', color: '#fff',
            display: 'grid', placeItems: 'center',
          }}>
            <Copy size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>
              Copiar sistemas de disputa
            </h3>
            <p style={{ fontSize: 12, color: 'var(--t3)', margin: '2px 0 0' }}>
              Destino: <b style={{ color: 'var(--t1)' }}>{destinoNome}</b>
            </p>
          </div>
        </div>

        {resultado ? (
          <div style={{
            background: 'var(--success-soft, rgba(20,184,138,0.12))',
            border: '1px solid var(--success, #14b88a)',
            color: 'var(--success, #14b88a)',
            borderRadius: 'var(--radius-lg)', padding: '14px 16px', fontSize: 14,
          }}>
            <Check size={16} className="inline mr-2" />
            <b>{resultado.grupos_copiados}</b> regras de grupos e <b>{resultado.chaves_copiadas}</b> regras de chaves copiadas.
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[var(--t3)] block mb-1">Origem (competição a copiar):</label>
                <select
                  value={origemId}
                  onChange={e => setOrigemId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-sm"
                >
                  <option value="">— Selecione —</option>
                  {competicoes.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--t3)] block mb-1">O que copiar:</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['ambos', 'grupos', 'chaves'] as const).map(t => {
                    const ativo = tipo === t
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTipo(t)}
                        style={{
                          padding: '8px 14px', borderRadius: 'var(--radius-pill)',
                          fontSize: 12.5, fontWeight: 600,
                          border: `1px solid ${ativo ? 'var(--brand-500)' : 'var(--card-border)'}`,
                          background: ativo ? 'var(--brand-500)' : 'var(--card-bg-2)',
                          color: ativo ? '#fff' : 'var(--t2)', cursor: 'pointer',
                        }}
                      >
                        {t === 'ambos' ? 'Grupos + Chaves' : t === 'grupos' ? 'Só grupos' : 'Só chaves'}
                      </button>
                    )
                  })}
                </div>
              </div>

              {origemId && (
                <div style={{
                  background: 'var(--danger-soft)', border: '1px solid var(--danger)',
                  color: 'var(--danger)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontSize: 12.5,
                }}>
                  <b>Atenção:</b> as regras atuais de <b>{destinoNome}</b> serão <b>substituídas</b> pelas de <b>{origemNome}</b>.
                </div>
              )}

              {error && (
                <div style={{
                  background: 'var(--danger-soft)', border: '1px solid var(--danger)',
                  color: 'var(--danger)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontSize: 13,
                }}>
                  {(error as any)?.response?.data?.message ?? 'Erro ao copiar.'}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={onClose} className="btn btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <X size={16} /> Cancelar
              </button>
              <button
                type="button"
                onClick={() => copiar()}
                disabled={!origemId || isPending}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: !origemId || isPending ? 0.5 : 1 }}
              >
                <Copy size={16} /> {isPending ? 'Copiando...' : 'Copiar agora'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
