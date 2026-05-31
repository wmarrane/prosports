import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { competicoesService } from '../../services/competicoes'
import { modalidadesService } from '../../services/modalidades'
import { UFS } from '../../lib/ufs'
import { Check, X, Trophy, Plus } from '../../lib/icons'
import { Brackets, Group, ListOrdered, FileText, Shapes } from 'lucide-react'

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

// Agrupamento por região para melhor escaneabilidade
const REGIOES: { titulo: string; ufs: string[] }[] = [
  { titulo: 'Norte', ufs: ['AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO'] },
  { titulo: 'Nordeste', ufs: ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'] },
  { titulo: 'Centro-Oeste', ufs: ['DF', 'GO', 'MS', 'MT'] },
  { titulo: 'Sudeste', ufs: ['ES', 'MG', 'RJ', 'SP'] },
  { titulo: 'Sul', ufs: ['PR', 'RS', 'SC'] },
]

export default function CompeticaoForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [nome, setNome] = useState('')
  const [estados, setEstados] = useState<string[]>([])
  const [adicionarSubtitulo, setAdicionarSubtitulo] = useState(false)
  const [erro, setErro] = useState('')

  const { data: existing } = useQuery({
    queryKey: ['competicoes', Number(id)],
    queryFn: () => competicoesService.buscar(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => {
    if (existing) {
      setNome(existing.nome)
      setEstados(existing.estados)
      setAdicionarSubtitulo(existing.adicionar_subtitulo)
    }
  }, [existing])

  // Modalidades vinculadas (modo edição apenas)
  const { data: modalidades = [], isLoading: loadingMods } = useQuery({
    queryKey: ['modalidades', Number(id)],
    queryFn: () => modalidadesService.listar({ competicao_id: Number(id) }),
    enabled: isEdit,
  })

  const { mutate: removerModalidade } = useMutation({
    mutationFn: (modalidadeId: number) => modalidadesService.remover(modalidadeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modalidades', Number(id)] })
      queryClient.invalidateQueries({ queryKey: ['competicoes'] })
    },
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover modalidade.'),
  })

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => {
      const payload = { nome, estados, adicionar_subtitulo: adicionarSubtitulo }
      return isEdit
        ? competicoesService.editar(Number(id), payload)
        : competicoesService.criar(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competicoes'] })
      navigate('/competicoes')
    },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  function toggleUf(uf: string) {
    setEstados(prev => (prev.includes(uf) ? prev.filter(x => x !== uf) : [...prev, uf]))
  }

  function selecionarRegiao(ufs: string[]) {
    const todosSelecionados = ufs.every(u => estados.includes(u))
    setEstados(prev =>
      todosSelecionados ? prev.filter(x => !ufs.includes(x)) : Array.from(new Set([...prev, ...ufs]))
    )
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (estados.length === 0) {
      setErro('Selecione ao menos uma UF.')
      return
    }
    salvar()
  }

  const inputClass =
    'w-full px-3 py-2.5 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] focus:border-transparent'

  // Verifica se todos os UFs disponíveis foram selecionados (compara com lista oficial)
  const todosSelecionados = UFS.every(u => estados.includes(u))

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="Operação"
        title={isEdit ? 'Editar Competição' : 'Nova Competição'}
        sub={
          isEdit
            ? 'Atualize o nome, abrangência territorial ou configurações de inscrição.'
            : 'Defina uma competição que servirá como template para os eventos a serem realizados.'
        }
        backTo="/competicoes"
      />

      <div className="p-6 max-w-4xl">
        <form onSubmit={handleSubmit}>
          {/* Card: Informações */}
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
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'var(--grad-brand-deep)',
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Trophy size={18} />
              </div>
              <div>
                <div className="eyebrow">Identificação</div>
                <h3 className="sec-title" style={{ fontSize: 17 }}>
                  Informações da competição
                </h3>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">Nome</label>
              <input
                value={nome}
                onChange={e => setNome(e.target.value)}
                required
                placeholder="Ex.: Campeonato Estadual 2026"
                className={inputClass}
                autoFocus
              />
              <p className="text-xs text-[var(--t4)] mt-1.5">
                Nome único — eventos com esse nome herdam as modalidades cadastradas.
              </p>
            </div>
          </section>

          {/* Card: Estados */}
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
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <div>
                <div className="eyebrow">Abrangência</div>
                <h3 className="sec-title" style={{ fontSize: 17 }}>
                  Estados participantes
                </h3>
                <p className="text-xs text-[var(--t4)] mt-1">
                  {estados.length === 0
                    ? 'Selecione ao menos uma UF.'
                    : `${estados.length} ${estados.length === 1 ? 'UF selecionada' : 'UFs selecionadas'}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEstados(todosSelecionados ? [] : [...UFS])}
                className="text-xs text-[var(--brand-500)] hover:text-[var(--brand-400)] font-semibold"
              >
                {todosSelecionados ? 'Limpar tudo' : 'Selecionar Brasil'}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {REGIOES.map(r => {
                const selNaRegiao = r.ufs.filter(u => estados.includes(u)).length
                const todosRegiao = selNaRegiao === r.ufs.length
                return (
                  <div key={r.titulo}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-[var(--t3)] uppercase tracking-wider">
                        {r.titulo}{' '}
                        {selNaRegiao > 0 && (
                          <span className="text-[var(--t4)] font-normal normal-case tracking-normal">
                            ({selNaRegiao}/{r.ufs.length})
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => selecionarRegiao(r.ufs)}
                        className="text-[10px] text-[var(--brand-500)] hover:text-[var(--brand-400)] font-semibold uppercase tracking-wider"
                      >
                        {todosRegiao ? 'Limpar' : 'Toda região'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {r.ufs.map(uf => {
                        const ativo = estados.includes(uf)
                        return (
                          <button
                            key={uf}
                            type="button"
                            onClick={() => toggleUf(uf)}
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 13,
                              fontWeight: 700,
                              padding: '6px 12px',
                              borderRadius: 'var(--radius-md)',
                              border: ativo
                                ? '1px solid var(--brand-500)'
                                : '1px solid var(--card-border)',
                              background: ativo ? 'var(--brand-500)' : 'var(--card-bg-2)',
                              color: ativo ? '#fff' : 'var(--t2)',
                              cursor: 'pointer',
                              transition: 'all 120ms ease',
                              minWidth: 48,
                            }}
                            title={uf}
                          >
                            {uf}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Card: Configurações */}
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
            <div className="mb-4">
              <div className="eyebrow">Opções</div>
              <h3 className="sec-title" style={{ fontSize: 17 }}>
                Configurações
              </h3>
            </div>

            <label
              className="flex items-start gap-3 cursor-pointer"
              style={{
                padding: 14,
                background: adicionarSubtitulo ? 'var(--brand-50)' : 'var(--card-bg-2)',
                border: `1px solid ${adicionarSubtitulo ? 'var(--brand-500)' : 'var(--card-border)'}`,
                borderRadius: 'var(--radius-lg)',
                transition: 'all 120ms ease',
              }}
            >
              <input
                type="checkbox"
                checked={adicionarSubtitulo}
                onChange={e => setAdicionarSubtitulo(e.target.checked)}
                className="rounded border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--brand-500)] focus:ring-[var(--brand-500)] mt-0.5"
              />
              <div>
                <div className="text-sm font-semibold text-[var(--t1)]">
                  Adicionar subtítulo aos participantes
                </div>
                <p className="text-xs text-[var(--t3)] mt-1">
                  Ativado, permite incluir um subtítulo (clube, equipe, sigla) ao lado do nome do
                  participante. Útil quando a competição reúne atletas de várias equipes.
                </p>
              </div>
            </label>
          </section>

          {/* Card: Modalidades (apenas edição) */}
          {isEdit && (
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
                      Modalidades vinculadas
                      <span className="text-[var(--t4)] font-normal text-sm ml-2">
                        ({modalidades.length})
                      </span>
                    </h3>
                  </div>
                </div>
                <Link
                  to={`/modalidades/nova?competicao_id=${id}`}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Plus size={14} /> Adicionar modalidade
                </Link>
              </div>

              {loadingMods ? (
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
                  <p className="text-sm mb-1">Nenhuma modalidade cadastrada nesta competição.</p>
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
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>
                              {m.nome}
                            </span>
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
                          <div className="text-xs text-[var(--t3)] mt-0.5">
                            {TIPO_LABEL[tipo]}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Link
                            to={`/modalidades/${m.id}/editar`}
                            className="text-[var(--brand-500)] hover:text-[var(--brand-400)] text-xs font-semibold"
                          >
                            Editar
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Remover modalidade "${m.nome}"?`)) removerModalidade(m.id)
                            }}
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
              onClick={() => navigate('/competicoes')}
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
              {isPending ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar competição'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
