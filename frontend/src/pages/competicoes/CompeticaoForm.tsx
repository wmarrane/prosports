import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { competicoesService } from '../../services/competicoes'
import { UFS } from '../../lib/ufs'
import { Check, X, Trophy } from '../../lib/icons'
import { ChevronUp, ChevronDown } from 'lucide-react'
import type { CampoSubtitulo, ModeloCongresso } from '../../types/competicao'
import { composeSubtituloLine } from '../../lib/compose-subtitulo'

const CAMPOS_LABELS: Record<CampoSubtitulo, string> = {
  subtitulo: 'Subtítulo',
  municipio: 'Município (nome/UF)',
  inspetoria: 'Inspetoria',
  delegacia: 'Delegacia',
}
const CAMPOS_ORDEM: CampoSubtitulo[] = ['subtitulo', 'municipio', 'inspetoria', 'delegacia']
import ModalidadesPanel from './ModalidadesPanel'

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
  const [campos, setCampos] = useState<CampoSubtitulo[]>([])
  const [subMunPorMod, setSubMunPorMod] = useState(false)
  const [modeloCongresso, setModeloCongresso] = useState<ModeloCongresso>('padrao')
  const [considerarAnfitriao, setConsiderarAnfitriao] = useState(false)
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
      setCampos(existing.subtitulo_campos ?? [])
      setSubMunPorMod(existing.subtitulo_municipio_por_modalidade ?? false)
      setModeloCongresso(existing.modelo_congresso ?? 'padrao')
      setConsiderarAnfitriao(existing.considerar_anfitriao ?? false)
    }
  }, [existing])

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => {
      const payload = { nome, estados, subtitulo_campos: campos, considerar_anfitriao: considerarAnfitriao, subtitulo_municipio_por_modalidade: subMunPorMod, modelo_congresso: modeloCongresso }
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

  function toggleCampo(c: CampoSubtitulo) {
    setCampos(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }
  function moverCampo(c: CampoSubtitulo, dir: -1 | 1) {
    setCampos(prev => {
      const i = prev.indexOf(c)
      const j = i + dir
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const arr = [...prev]
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
      return arr
    })
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

  const todosSelecionados = UFS.every(u => estados.includes(u))

  // Conteúdo dos cards à esquerda (Info, Estados, Configurações) — usado tanto em modo
  // single-column (criar) quanto em two-column (editar).
  const leftCards = (
    <>
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
              width: 36, height: 36, borderRadius: 10,
              background: 'var(--grad-brand-deep)', color: '#fff',
              display: 'grid', placeItems: 'center',
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
                          border: ativo ? '1px solid var(--brand-500)' : '1px solid var(--card-border)',
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
          marginBottom: isEdit ? 0 : 16,
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div className="mb-4">
          <div className="eyebrow">Opções</div>
          <h3 className="sec-title" style={{ fontSize: 17 }}>
            Linha de exibição do participante
          </h3>
          <p className="text-xs text-[var(--t3)] mt-1">
            Selecione e ordene os campos que aparecerão ao lado do nome do participante nos sorteios.
          </p>
        </div>

        {/* Checkboxes de seleção */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginBottom: 16 }}>
          {CAMPOS_ORDEM.map(c => {
            const ativo = campos.includes(c)
            return (
              <label key={c} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px',
                background: ativo ? 'var(--brand-50)' : 'var(--card-bg-2)',
                border: `1px solid ${ativo ? 'var(--brand-500)' : 'var(--card-border)'}`,
                borderRadius: 'var(--radius-lg)',
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}>
                <input
                  type="checkbox"
                  checked={ativo}
                  onChange={() => toggleCampo(c)}
                  className="rounded border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--brand-500)] focus:ring-[var(--brand-500)]"
                />
                <span className="text-sm font-medium text-[var(--t1)]">{CAMPOS_LABELS[c]}</span>
              </label>
            )
          })}
        </div>

        {/* Reorder + preview */}
        {campos.length > 0 ? (
          <>
            <div className="eyebrow mb-2">Ordem de exibição</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {campos.map((c, i) => (
                <div key={c} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px',
                  background: 'var(--card-bg-2)',
                  border: '1px solid var(--card-border)',
                  borderRadius: 'var(--radius-md)',
                }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--t4)', minWidth: 20 }}>
                    {i + 1}.
                  </span>
                  <span className="text-sm flex-1 text-[var(--t1)]">{CAMPOS_LABELS[c]}</span>
                  <button
                    type="button"
                    onClick={() => moverCampo(c, -1)}
                    disabled={i === 0}
                    className="p-1 text-[var(--t3)] hover:text-[var(--brand-500)] disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Mover para cima"
                  ><ChevronUp size={16} /></button>
                  <button
                    type="button"
                    onClick={() => moverCampo(c, 1)}
                    disabled={i === campos.length - 1}
                    className="p-1 text-[var(--t3)] hover:text-[var(--brand-500)] disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Mover para baixo"
                  ><ChevronDown size={16} /></button>
                </div>
              ))}
            </div>
            <div style={{
              padding: '10px 14px',
              background: 'var(--brand-50)',
              border: '1px solid var(--brand-500)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
            }}>
              <span className="text-[var(--t3)] mr-2">Preview:</span>
              <b className="text-[var(--brand-700)]">João Silva</b>
              <span className="text-[var(--t2)] ml-2">
                {composeSubtituloLine(
                  {
                    subtitulo: 'Clube XYZ',
                    municipio: { nome: 'Campinas', uf: 'SP' } as any,
                    inspetoria: { nome: 'Inspetoria Sul' } as any,
                    delegacia: { nome: 'Delegacia Centro' } as any,
                  },
                  campos
                )}
              </span>
            </div>
          </>
        ) : (
          <p className="text-xs text-[var(--t4)] italic">
            Nenhuma informação adicional será exibida ao lado do nome.
          </p>
        )}

        <div style={{ marginTop: 16 }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px',
            background: subMunPorMod ? 'var(--brand-50)' : 'var(--card-bg-2)',
            border: `1px solid ${subMunPorMod ? 'var(--brand-500)' : 'var(--card-border)'}`,
            borderRadius: 'var(--radius-lg)',
            cursor: 'pointer',
            transition: 'all 120ms ease',
          }}>
            <input
              type="checkbox"
              checked={subMunPorMod}
              onChange={e => setSubMunPorMod(e.target.checked)}
              className="rounded border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--brand-500)] focus:ring-[var(--brand-500)]"
            />
            <span className="text-sm font-medium text-[var(--t1)]">Subtítulo e município variam por modalidade (competição escolar)</span>
          </label>

          <div style={{ marginTop: 14 }}>
            <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
              Modelo do congresso técnico
            </label>
            <select
              value={modeloCongresso}
              onChange={e => setModeloCongresso(e.target.value as ModeloCongresso)}
              className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--t1)] focus:border-[var(--brand-500)] focus:outline-none"
            >
              <option value="padrao">Padrão — uma aba por modalidade (Jogos Regionais)</option>
              <option value="jeesp">JEESP — uma aba por esporte, com bloco por modalidade</option>
            </select>
            <p className="text-xs text-[var(--t4)] mt-1.5">
              Define o layout do Excel do congresso técnico. O modelo padrão também mostra
              o subtítulo por inscrição quando a competição é escolar.
            </p>
          </div>
        </div>

        <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--card-border)' }}>
          <div className="eyebrow mb-1">Privilégios</div>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px',
            background: considerarAnfitriao ? 'var(--brand-50)' : 'var(--card-bg-2)',
            border: `1px solid ${considerarAnfitriao ? 'var(--brand-500)' : 'var(--card-border)'}`,
            borderRadius: 'var(--radius-lg)',
            cursor: 'pointer',
            transition: 'all 120ms ease',
          }}>
            <input
              type="checkbox"
              checked={considerarAnfitriao}
              onChange={e => setConsiderarAnfitriao(e.target.checked)}
              className="rounded border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--brand-500)] focus:ring-[var(--brand-500)]"
            />
            <div style={{ flex: 1 }}>
              <span className="text-sm font-medium text-[var(--t1)]">Considerar anfitrião do evento</span>
              <div className="text-xs text-[var(--t3)] mt-0.5">
                Quando ligado, o participante marcado como anfitrião no evento ganha privilégio de cabeça nos sorteios: vira cabeça do <b>grupo C</b> (3 grupos) ou <b>grupo D</b> (4+ grupos), e <b>4º cabeça</b> em chaves — só se ainda não estiver entre os 4 primeiros campeões.
              </div>
            </div>
          </label>
        </div>
      </section>
    </>
  )

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="Operação"
        title={isEdit ? 'Editar Competição' : 'Nova Competição'}
        sub={
          isEdit
            ? 'Atualize dados gerais, abrangência, configurações e as modalidades vinculadas.'
            : 'Defina uma competição que servirá como template para os eventos. Após salvar, você poderá adicionar as modalidades.'
        }
        backTo="/competicoes"
      />

      <div className="p-6" style={{ maxWidth: isEdit ? 1400 : 720 }}>
        <form onSubmit={handleSubmit}>
          {isEdit ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)',
                gap: 16,
                alignItems: 'start',
                marginBottom: 16,
              }}
              className="cf-grid"
            >
              <div>{leftCards}</div>
              <div>
                <ModalidadesPanel competicaoId={Number(id)} />
              </div>
            </div>
          ) : (
            leftCards
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

      {/* Responsive: single-column abaixo de 1100px no modo edit */}
      <style>{`
        @media (max-width: 1100px) {
          .cf-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
