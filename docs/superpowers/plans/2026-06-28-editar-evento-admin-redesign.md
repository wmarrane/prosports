# Editar evento (admin) — redesign do editor — Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar a tela de edição/criação de evento do admin no layout `.evx` de 2 colunas, com pré-visualização ao vivo do card público, resumo, publicação (rádio-cards) e zona de perigo, reusando os campos reais e persistindo ativar/desativar de modalidades.

**Architecture:** CSS novo `.evx-*` (porte do protótipo) + dois componentes apresentacionais novos (`EventoCardPreview`, `ModalidadesDaEdicao`) + reescrita de `EventoForm.tsx` para o grid 2 colunas, mantendo rota e backend. Persistência de modalidades via endpoints de exclusões já existentes.

**Tech Stack:** React 18 + TS + Vite; React Query; Vitest + `renderToStaticMarkup`; tokens `tokens.css`/`prosports-theme.css`.

## Global Constraints

- Host Windows; ler antes de editar; caminhos absolutos.
- Git identity inline: `git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit …`.
- Nunca `git add -A`; commitar só os arquivos nomeados.
- Validar: `cd frontend && npm run build` (tsc -b + vite) sem erros.
- Reusar tokens/classes/componentes existentes; **sem cores novas**. Branch: `feat/editar-evento`.
- Fonte visual: `personaladmin/handoff/design_handoff_editar_evento/` (`editar-evento.css`/`.jsx`). Omitir do handoff: meta de inscritos, override de tipo, reorder, esporte travado, toggles inventados de inscrições (sem backend).
- Tipos→grad/ícone (admin): `chaves→var(--grad-brand)/Brackets`, `grupos→var(--grad-accent)/Group`, `ordem_entrada→var(--grad-violet)/ListOrdered`, `especifico→var(--grad-warn)/FileText`.

---

### Task 1: CSS `.evx-*` + import

**Files:**
- Create: `frontend/src/styles/editar-evento.css`
- Modify: `frontend/src/main.tsx` (adicionar o import)

**Interfaces:** Produces: as classes `.evx-*` usadas pelas Tasks 2–4.

- [ ] **Step 1: Criar o CSS**

Criar `frontend/src/styles/editar-evento.css` com o subconjunto de classes usadas, copiado **verbatim** de `personaladmin/handoff/design_handoff_editar_evento/editar-evento.css` — incluir estes blocos: `.evx-grid`, `.evx-col`, `.evx-aside` (+ media ≤1080px), `.evx-row2` (+ media ≤520px), `.evx-sec-h`, `.evx-select`/`.evx-caret`, `.evx-mod`/`.evx-mod-ic`/`.evx-mod-main`/`.evx-mod-name`/`.evx-mod-sub` (inclui `[data-off="true"]`), `.evx-prev`, `.evx-cover`(+`::after`)/`.evx-cover-top`/`.evx-tiles`/`.evx-gtile`(+`.more`)/`.evx-cbadge`(+`.dot`)/`.evx-cover-loc`, `.evx-prev-body`/`.evx-prev-title`/`.evx-prev-comp`, `.evx-prog`/`.evx-prog-h`/`.evx-prog-lab`/`.evx-prog-n`(+`.full`)/`.evx-bar`(+`> i`), `.evx-prev-foot`(+`.it`), `.evx-prev-flag`(+`.d`), `.evx-stats`/`.evx-stat`(+`.v`,`.v.accent`,`.l`), `.evx-status-opt`(+`[data-on="true"]`,`.sd`,`.st`), `.evx-danger`(+`.di`,`.dx`)/`.evx-btn-danger`, `.evx-note`. **Não** portar `.evx-stepper` nem `.evx-static`/`.evx-static-ic` (recursos fora de escopo). Manter os valores/tokens exatamente como no protótipo (sem cores novas).

- [ ] **Step 2: Importar no `main.tsx`**

Em `frontend/src/main.tsx`, adicionar junto aos outros imports de css (após `congresso-wizard.css`):
```ts
import './styles/editar-evento.css'
```

- [ ] **Step 3: Verificar build**

Run: `cd frontend && npm run build`
Expected: `tsc -b && vite build` sem erros (o CSS é incluído no bundle).

- [ ] **Step 4: Commit**
```bash
git add frontend/src/styles/editar-evento.css frontend/src/main.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(editar-evento): css .evx (layout 2 colunas, preview, status, zona de perigo)"
```

---

### Task 2: `EventoCardPreview.tsx`

**Files:**
- Create: `frontend/src/pages/eventos/EventoCardPreview.tsx`
- Test: `frontend/src/pages/eventos/EventoCardPreview.test.tsx`

**Interfaces:**
- Consumes: `TipoDisputa` (`../../types/modalidade`), `EventoStatus`/`STATUS_LABEL` (`../../lib/evento-status` + `../../types/evento`), ícones lucide.
- Produces: `default EventoCardPreview(props: EventoCardPreviewProps)` (apresentacional puro), consumido pela Task 4.

- [ ] **Step 1: Teste (falha primeiro)**

Criar `frontend/src/pages/eventos/EventoCardPreview.test.tsx`:
```tsx
import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import EventoCardPreview from './EventoCardPreview'

it('preview: tipo dominante deep quando >1 tipo, status, progresso e rodape', () => {
  const html = renderToStaticMarkup(
    <EventoCardPreview nome="Jogos de Teste" competicaoNome="Regionais" cidade="Campinas" dataLabel="18/06/2026"
      status="pronto" tipos={['chaves', 'grupos']} totalModalidades={5} inscritos={84} sorteadas={2} sorteaveis={4} />,
  )
  expect(html).toContain('evx-prev')
  expect(html).toContain('var(--grad-brand-deep)') // >1 tipo
  expect(html).toContain('Pronto p/ sorteio')
  expect(html).toContain('2/4')
  expect(html).toContain('Jogos de Teste')
  expect(html).toContain('84')
})

it('preview: tipo unico usa o gradiente do tipo e oculta progresso quando sorteaveis=0', () => {
  const html = renderToStaticMarkup(
    <EventoCardPreview nome="X" competicaoNome="C" cidade="Y" dataLabel="" status="rascunho"
      tipos={['grupos']} totalModalidades={1} inscritos={0} sorteadas={0} sorteaveis={0} />,
  )
  expect(html).toContain('var(--grad-accent)') // grupos
  expect(html).not.toContain('Andamento dos sorteios')
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/pages/eventos/EventoCardPreview.test.tsx`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

Criar `frontend/src/pages/eventos/EventoCardPreview.tsx`:
```tsx
import type { TipoDisputa } from '../../types/modalidade'
import type { EventoStatus } from '../../types/evento'
import { STATUS_LABEL } from '../../lib/evento-status'
import { Brackets, Group, ListOrdered, FileText, Trophy, Users, List, MapPin } from 'lucide-react'

const TIPO_GRAD: Record<TipoDisputa, string> = {
  chaves: 'var(--grad-brand)', grupos: 'var(--grad-accent)', ordem_entrada: 'var(--grad-violet)', especifico: 'var(--grad-warn)',
}
const TIPO_ICON: Record<TipoDisputa, typeof Brackets> = {
  chaves: Brackets, grupos: Group, ordem_entrada: ListOrdered, especifico: FileText,
}

export interface EventoCardPreviewProps {
  nome: string
  competicaoNome: string
  cidade: string
  dataLabel: string
  status: EventoStatus
  tipos: TipoDisputa[]
  totalModalidades: number
  inscritos: number
  sorteadas: number
  sorteaveis: number
}

export default function EventoCardPreview(p: EventoCardPreviewProps) {
  const dominante = p.tipos.length > 1 ? 'var(--grad-brand-deep)' : p.tipos.length === 1 ? TIPO_GRAD[p.tipos[0]] : 'var(--grad-brand)'
  const pct = p.sorteaveis > 0 ? Math.round((p.sorteadas / p.sorteaveis) * 100) : 0
  const full = p.sorteaveis > 0 && p.sorteadas === p.sorteaveis
  const tiles = p.tipos.slice(0, 2)
  const extra = p.tipos.length - tiles.length
  return (
    <div className="evx-prev">
      <div className="evx-cover" style={{ background: dominante }}>
        <div className="evx-cover-top">
          <div className="evx-tiles">
            {tiles.map((t) => { const Ic = TIPO_ICON[t]; return <div className="evx-gtile" key={t}><Ic size={18} /></div> })}
            {extra > 0 && <div className="evx-gtile more">+{extra}</div>}
          </div>
          <span className="evx-cbadge"><span className="dot" />{STATUS_LABEL[p.status]}</span>
        </div>
        <div className="evx-cover-loc"><MapPin /> {p.cidade || '—'}{p.dataLabel ? ` · ${p.dataLabel}` : ''}</div>
      </div>
      <div className="evx-prev-body">
        <h3 className="evx-prev-title">{p.nome || 'Nome do evento'}</h3>
        <div className="evx-prev-comp"><Trophy /> {p.competicaoNome || '—'}</div>
        {p.sorteaveis > 0 && (
          <div className="evx-prog">
            <div className="evx-prog-h">
              <span className="evx-prog-lab">Andamento dos sorteios</span>
              <span className={`evx-prog-n${full ? ' full' : ''}`}>{p.sorteadas}/{p.sorteaveis}{full ? ' ✓' : ''}</span>
            </div>
            <div className="evx-bar"><i style={{ width: `${Math.max(pct, 3)}%`, background: full ? 'var(--grad-accent)' : dominante }} /></div>
          </div>
        )}
        <div className="evx-prev-foot">
          <span className="it"><Users /> <b>{p.inscritos}</b> inscritos</span>
          <span className="it"><List /> <b>{p.totalModalidades}</b> modalidades</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/pages/eventos/EventoCardPreview.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**
```bash
git add frontend/src/pages/eventos/EventoCardPreview.tsx frontend/src/pages/eventos/EventoCardPreview.test.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(editar-evento): EventoCardPreview (card publico ao vivo)"
```

---

### Task 3: `ModalidadesDaEdicao.tsx`

**Files:**
- Create: `frontend/src/pages/eventos/ModalidadesDaEdicao.tsx`
- Test: `frontend/src/pages/eventos/ModalidadesDaEdicao.test.tsx`

**Interfaces:**
- Consumes: `TipoDisputa`, ícones lucide. Usa as classes `.switch`/`.knob` do tema (toggle via classe `on`).
- Produces: `default ModalidadesDaEdicao(props)` (controlado) + `interface ModEdicaoItem { id: number; nome: string; tipo: TipoDisputa }`. Consumido pela Task 4.

- [ ] **Step 1: Teste (falha primeiro)**

Criar `frontend/src/pages/eventos/ModalidadesDaEdicao.test.tsx`:
```tsx
import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ModalidadesDaEdicao from './ModalidadesDaEdicao'

const mods = [
  { id: 1, nome: 'Judô Masculino', tipo: 'chaves' as const },
  { id: 2, nome: 'Futsal', tipo: 'grupos' as const },
]

it('lista modalidades e marca a desativada (data-off)', () => {
  const html = renderToStaticMarkup(<ModalidadesDaEdicao modalidades={mods} excluidas={new Set([2])} onToggle={() => {}} />)
  expect(html).toContain('Judô Masculino')
  expect(html).toContain('Futsal')
  expect(html).toContain('data-off="true"')   // a modalidade 2 está excluída
  expect(html).toContain('var(--grad-brand)')  // ícone da modalidade 'chaves'
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/pages/eventos/ModalidadesDaEdicao.test.tsx`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

Criar `frontend/src/pages/eventos/ModalidadesDaEdicao.tsx`:
```tsx
import type { TipoDisputa } from '../../types/modalidade'
import { Brackets, Group, ListOrdered, FileText } from 'lucide-react'

const TIPO_GRAD: Record<TipoDisputa, string> = {
  chaves: 'var(--grad-brand)', grupos: 'var(--grad-accent)', ordem_entrada: 'var(--grad-violet)', especifico: 'var(--grad-warn)',
}
const TIPO_ICON: Record<TipoDisputa, typeof Brackets> = {
  chaves: Brackets, grupos: Group, ordem_entrada: ListOrdered, especifico: FileText,
}
const TIPO_LABEL: Record<TipoDisputa, string> = {
  chaves: 'Chaves', grupos: 'Grupos', ordem_entrada: 'Ordem de entrada', especifico: 'Específico',
}

export interface ModEdicaoItem { id: number; nome: string; tipo: TipoDisputa }

export interface ModalidadesDaEdicaoProps {
  modalidades: ModEdicaoItem[]
  excluidas: Set<number>
  onToggle: (id: number) => void
}

export default function ModalidadesDaEdicao({ modalidades, excluidas, onToggle }: ModalidadesDaEdicaoProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {modalidades.map((m) => {
        const off = excluidas.has(m.id)
        const Ic = TIPO_ICON[m.tipo]
        return (
          <div className="evx-mod" data-off={off} key={m.id}>
            <div className="evx-mod-ic" style={{ background: TIPO_GRAD[m.tipo] }}><Ic size={18} /></div>
            <div className="evx-mod-main">
              <div className="evx-mod-name">{m.nome}</div>
              <div className="evx-mod-sub">{TIPO_LABEL[m.tipo]}</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!off}
              aria-label={`${off ? 'Ativar' : 'Desativar'} ${m.nome} nesta edição`}
              className={`switch${off ? '' : ' on'}`}
              onClick={() => onToggle(m.id)}
            >
              <span className="knob" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/pages/eventos/ModalidadesDaEdicao.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/pages/eventos/ModalidadesDaEdicao.tsx frontend/src/pages/eventos/ModalidadesDaEdicao.test.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(editar-evento): ModalidadesDaEdicao (ativar/desativar via switch)"
```

---

### Task 4: Reescrever `EventoForm.tsx` no layout `.evx`

**Files:**
- Modify (reescrita): `frontend/src/pages/eventos/EventoForm.tsx`

**Interfaces:**
- Consumes: `EventoCardPreview` (Task 2), `ModalidadesDaEdicao` + `ModEdicaoItem` (Task 3); `eventosService` (`buscar/criar/editar/remover/getModalidadesExcluidas/setModalidadesExcluidas/progressoSorteio`), `modalidadesService.listar`, `inscricoesService.listar`, `competicoesService.listar`, `usersService.listar`; `ConfirmDialog`, `PageHeader`, `MunicipioSelect`, `ParticipanteSelect`, `AcessoMobileCard`, `EventoBoletins`.

Esta task **reorganiza** o formulário existente no grid `.evx` e adiciona a coluna de apoio. Reaproveitar o JSX dos campos atuais (ler o arquivo atual antes de editar) e o protótipo `editar-evento.jsx` para a estrutura visual. Abaixo, a lógica nova (derivados/estado/save) e a estrutura — completas.

- [ ] **Step 1: Estado e dados (adicionar aos hooks existentes)**

Manter todo o estado atual (`competicaoId, municipioId, nome, dataHora, local, organizador, status, anfitriaoId, comissaoIds, dataInicio, dataFim, logoUrl, erro, erroLogo`). Adicionar:
```tsx
import { useMemo } from 'react'
import ConfirmDialog from '../../components/ConfirmDialog'
import EventoCardPreview from './EventoCardPreview'
import ModalidadesDaEdicao, { type ModEdicaoItem } from './ModalidadesDaEdicao'
import { modalidadesService } from '../../services/modalidades'
import { inscricoesService } from '../../services/inscricoes'
import type { TipoDisputa } from '../../types/modalidade'
```
```tsx
  const [excluidas, setExcluidas] = useState<Set<number>>(new Set())
  const [salvo, setSalvo] = useState(false)
  const [confirmExcluir, setConfirmExcluir] = useState(false)

  // modalidades da competição (todas) para a lista ativar/desativar e o preview
  const { data: modalidadesComp = [] } = useQuery({
    queryKey: ['modalidades', competicaoId],
    queryFn: () => modalidadesService.listar({ competicao_id: Number(competicaoId) }),
    enabled: !!competicaoId,
  })
  // exclusões atuais (edição)
  const { data: excluidasIniciais } = useQuery({
    queryKey: ['modalidades-excluidas', Number(id)],
    queryFn: () => eventosService.getModalidadesExcluidas(Number(id)),
    enabled: isEdit,
  })
  useEffect(() => { if (excluidasIniciais) setExcluidas(new Set(excluidasIniciais)) }, [excluidasIniciais])

  // inscritos distintos (edição) p/ o preview/resumo
  const { data: inscricoesEvento = [] } = useQuery({
    queryKey: ['inscricoes', Number(id)],
    queryFn: () => inscricoesService.listar({ evento_id: Number(id) }),
    enabled: isEdit,
  })
  const { data: progresso } = useQuery({
    queryKey: ['progresso-sorteio', Number(id)],
    queryFn: () => eventosService.progressoSorteio(Number(id)),
    enabled: isEdit,
  })
```

- [ ] **Step 2: Derivados (preview/resumo) + canSave**

```tsx
  const modsAtivos: ModEdicaoItem[] = useMemo(
    () => modalidadesComp
      .filter((m: any) => !excluidas.has(m.id))
      .map((m: any) => ({ id: m.id, nome: m.nome, tipo: m.tipo_modalidade.tipo as TipoDisputa })),
    [modalidadesComp, excluidas],
  )
  const tiposAtivos = useMemo(
    () => [...new Set(modsAtivos.map((m) => m.tipo))] as TipoDisputa[],
    [modsAtivos],
  )
  const inscritosDistintos = useMemo(
    () => new Set(inscricoesEvento.map((i: any) => i.participante_id)).size,
    [inscricoesEvento],
  )
  const cidade = '' /* derivar via MunicipioSelect se expor o nome; senão deixar '' */
  const dataLabel = dataHora ? new Date(dataHora).toLocaleDateString('pt-BR') : ''
  const competicaoNome = competicoes.find((c) => c.id === Number(competicaoId))?.nome ?? ''
  const sorteadas = progresso?.sorteadas ?? 0
  const sorteaveis = progresso?.sorteaveis ?? 0
  const canSave = nome.trim().length > 0 && modsAtivos.length > 0

  function toggleModalidade(mid: number) {
    setExcluidas((prev) => { const n = new Set(prev); if (n.has(mid)) n.delete(mid); else n.add(mid); return n })
    setSalvo(false)
  }
```
(Nota sobre `cidade`: o `MunicipioSelect` controla `municipioId`; se ele não expõe o nome do município selecionado, passar `cidade=""` ao preview — o preview já trata vazio com "—". Se for trivial obter o nome, usar; não inventar query nova só pra isso.)

- [ ] **Step 3: Salvar (evento + exclusões) e excluir**

Substituir a mutation `salvar` para também persistir as exclusões e mostrar "Salvo":
```tsx
  const { mutate: salvar, isPending } = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: nome.trim(),
        data_hora: new Date(dataHora).toISOString(),
        local: local.trim(),
        organizador: organizador.trim() || undefined,
        status,
        competicao_id: Number(competicaoId),
        municipio_id: municipioId!,
        anfitriao_id: anfitriaoId,
        comissao_ids: comissaoIds,
        data_inicio: dataInicio || null,
        data_fim: dataFim || null,
      }
      if (isEdit) {
        await eventosService.editar(Number(id), payload)
        await eventosService.setModalidadesExcluidas(Number(id), [...excluidas])
        return { id: Number(id) }
      }
      const novo: any = await eventosService.criar(payload)
      if (excluidas.size > 0 && novo?.id) await eventosService.setModalidadesExcluidas(novo.id, [...excluidas])
      return novo
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['eventos'] })
      if (isEdit) {
        queryClient.invalidateQueries({ queryKey: ['eventos', Number(id)] })
        setSalvo(true)
      } else if (res?.id) {
        navigate(`/eventos/${res.id}/editar`)
      } else {
        navigate('/eventos')
      }
    },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  const { mutate: excluirEvento, isPending: excluindo } = useMutation({
    mutationFn: () => eventosService.remover(Number(id)),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['eventos'] }); navigate('/eventos') },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao excluir.'),
  })
```
Trocar o `<form onSubmit>`/botão por um submit que valida `canSave` (mantém as validações atuais de competição/município/data).

- [ ] **Step 4: Layout `.evx` (estrutura do JSX)**

Reescrever o corpo (`<div className="p-6">…`) para:
```tsx
      <div className="p-6">
        <form onSubmit={handleSubmit}>
          <div className="evx-grid">
            {/* Coluna esquerda */}
            <div className="evx-col">
              {/* 1. Identificação: Competição (select existente, travado na edição), Nome*, Município, Organização */}
              {/* 2. Congresso · data e local: Data e hora*, Local*, Início/Fim (usar .evx-row2 para pares) */}
              {/* 3. Anfitrião & Comissão Técnica (reusar JSX atual) */}
              {/* 4. Card "Modalidades desta edição": <ModalidadesDaEdicao modalidades={modsTodas} excluidas={excluidas} onToggle={toggleModalidade} /> + .evx-note */}
              {/* (edição) Logo, <AcessoMobileCard/>, conforme hoje */}
            </div>
            {/* Coluna direita (apoio) */}
            <aside className="evx-aside evx-col">
              <section className="card pad">
                <div className="evx-prev-flag"><span className="d" /> Pré-visualização</div>
                <EventoCardPreview nome={nome} competicaoNome={competicaoNome} cidade={cidade}
                  dataLabel={dataLabel} status={status} tipos={tiposAtivos}
                  totalModalidades={modsAtivos.length} inscritos={inscritosDistintos}
                  sorteadas={sorteadas} sorteaveis={sorteaveis} />
              </section>
              <section className="card pad">
                <div className="evx-stats">
                  <div className="evx-stat"><div className="v">{modsAtivos.length}</div><div className="l">Modalidades</div></div>
                  <div className="evx-stat"><div className="v">{inscritosDistintos}</div><div className="l">Inscritos</div></div>
                  <div className="evx-stat"><div className="v">{tiposAtivos.length}</div><div className="l">Tipos de sorteio</div></div>
                  <div className="evx-stat"><div className="v accent">{sorteadas}</div><div className="l">Com sorteio</div></div>
                </div>
              </section>
              <section className="card pad">
                <div className="eyebrow" style={{ marginBottom: 10 }}>Publicação</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {STATUS_VALUES.map((s) => (
                    <button type="button" key={s} className="evx-status-opt" data-on={status === s}
                      onClick={() => { setStatus(s); setSalvo(false) }}>
                      <span className="sd" style={{ background: STATUS_DOT[s] }} />
                      <span className="st"><b>{STATUS_LABEL[s]}</b><span>{STATUS_DESC[s]}</span></span>
                    </button>
                  ))}
                </div>
              </section>
              {isEdit && (
                <section className="card pad">
                  <div className="eyebrow" style={{ marginBottom: 10 }}>Zona de perigo</div>
                  <div className="evx-danger">
                    <div className="di"><X size={18} /></div>
                    <div className="dx"><b>Excluir esta edição</b><p>Remove o evento, inscrições e sorteios vinculados. Não afeta a competição.</p></div>
                    <button type="button" className="btn evx-btn-danger" onClick={() => setConfirmExcluir(true)}>Excluir</button>
                  </div>
                </section>
              )}
            </aside>
          </div>
          {/* erro + action bar (Cancelar / Salvar com badge "Salvo") — manter, com canSave no disabled */}
        </form>
        {isEdit && <EventoBoletins eventoId={Number(id)} eventoNome={nome} />}
      </div>
```
Onde:
- `modsTodas` = todas as modalidades da competição mapeadas para `ModEdicaoItem` (`modalidadesComp.map(m => ({ id, nome, tipo: m.tipo_modalidade.tipo }))`).
- `STATUS_DOT: Record<EventoStatus,string>` = `{ rascunho:'var(--t4)', inscricoes:'var(--info)', pronto:'var(--warn)', sorteado:'var(--success)', parcial:'var(--info)', suspenso:'var(--warn)' }` (definir no topo do arquivo; sem cores novas).
- Botão "Salvar evento": `disabled={isPending || !canSave}`; quando `salvo`, exibir badge "Salvo" (ex.: `<span className="badge b-success">Salvo</span>`) ao lado.
- Manter `PageHeader` (título "Editar Evento"/"Novo Evento") e o `handleSubmit` atual (validações), apenas trocando o gate final para `canSave`.

Adicionar o `ConfirmDialog` no fim do componente:
```tsx
      <ConfirmDialog
        open={confirmExcluir}
        onClose={() => setConfirmExcluir(false)}
        onConfirm={() => { setConfirmExcluir(false); excluirEvento() }}
        eyebrow="Excluir evento"
        title={nome || 'Evento'}
        description="Essa ação não pode ser desfeita. Inscrições e sorteios vinculados serão perdidos."
        confirmLabel="Excluir"
        confirmVariant="danger"
        icon="trash"
      />
```

- [ ] **Step 5: Build + ajustes de tipo**

Run: `cd frontend && npm run build && npx vitest run src/pages/eventos`
Expected: `tsc -b && vite build` sem erros (sem imports/vars não usados — remover o que sobrou do layout antigo, ex.: `STATUS_DESC` permanece em uso nos status-opt; manter); testes da pasta verdes.

- [ ] **Step 6: Commit**
```bash
git add frontend/src/pages/eventos/EventoForm.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(editar-evento): editor .evx 2 colunas (preview, resumo, publicacao, zona de perigo, modalidades)"
```

---

## Verificação final (após as 4 tasks)

- [ ] `cd frontend && npm run build` e `npx vitest run src/pages/eventos` verdes.
- [ ] **Demo (screenshots) antes do merge na develop**: editor em **edição** (2 colunas, preview ao vivo refletindo modalidades/inscritos/sorteios reais, publicação, zona de perigo) e **criação**; e empilhado em ≤1080px. Validar que ativar/desativar modalidade persiste (salvar → reabrir).
- [ ] Após aprovação: merge `feat/editar-evento` → develop (só arquivos esperados, sem `git add -A`), push, monitorar deploy.

## Self-Review (cobertura da spec)
- Layout 2 colunas `.evx` + responsivo: Task 1 (CSS) + Task 4 ✓.
- Preview ao vivo do card público: Task 2 + Task 4 ✓.
- Modalidades ativar/desativar (persiste via exclusões): Task 3 + Task 4 (save) ✓.
- Resumo, Publicação (rádio-cards de status), Zona de perigo: Task 4 ✓.
- Reuso de campos/componentes reais; sem backend novo; omissões do handoff respeitadas ✓.
- Demo antes da develop ✓.
