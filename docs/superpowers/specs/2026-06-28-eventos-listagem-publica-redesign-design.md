# Eventos — redesign da listagem pública (grupo de ano + card calmo) — Design

**Data:** 2026-06-28
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Redesenhar a **página pública de listagem de eventos** (`/eventos.html`, componente `EventosPage.tsx`) conforme `personaladmin/handoff/design_handoff_eventos_listagem/`:
- **Cabeçalho de ano forte** (`.yr-head`): ano grande + resumo (eventos · inscritos) + **filtro de status** (pílulas).
- **Card de listagem calmo** (`.evc`): variante propositalmente diferente do card "Capa" — acento fino por **status**, não cover saturado, com strip de 3 métricas.

Escopo aprovado: **apenas a listagem** (`EventosPage`). A **home** (`IndexPage`, destaques) mantém o card simples atual (`EventoCard`). O **hero do detalhe** e o **menu hambúrguer mobile** ficam fora.

**Fonte pixel-perfect:** `Listagem-redesign.html`. Reusar design system (`tokens.css` + `theme-vars.css` no público + `site.css`). Ícones inline → `lucide-react`.

## Decisões aprovadas

1. **3 estados de status** (nosso snapshot tem `status` por modalidade, então o "Sorteado" é derivável com segurança — o handoff o deixou como futuro):
   - **Sorteado** (100%): acento/tile `var(--grad-accent)`, dot `var(--accent)`, número de Sorteios em verde (`.hl`).
   - **Em andamento** (sorteadas > 0, não 100%): acento/tile `var(--grad-brand)`, dot `var(--info)`.
   - **Aguardando sorteio** (sorteadas === 0): acento/tile `var(--grad-warn)`, dot `var(--warn)`, número de Sorteios esmaecido (`.zero`).
2. **Sem selo de edição** (`68ª EDIÇÃO`): o snapshot não tem campo de edição e o título já traz o ordinal; remover o selo do header do card.
3. **Filtro client-side** escopado por grupo de ano (cada ano tem seu próprio filtro): 4 pílulas **Todos / ● Em andamento / ● Aguardando / ● Sorteado**.

## Contexto (codebase)

- Site público é SSG React (`frontend/scripts/build-site-publico.tsx` → `renderToStaticMarkup` → `dist-site`). Não há runtime React no cliente; interações usam `<script>` inline (mesmo padrão do filtro de boletins e do botão Compartilhar).
- `EventosPage.tsx` hoje: hero + por ano (`.year-group` > `.year-head` com `.yr`/`.yc`) + `.ev-grid` com `EventoCard`.
- `EventoCard.tsx` (card simples) é usado por `IndexPage` (destaques) **e** `EventosPage` — após este trabalho, a listagem passa a usar o novo `EventoCardListagem`; a home continua com `EventoCard`.
- Dados (`SnapEvento`): `id, nome, competicao, cidade, local, data, dataInicio, dataFim, boletins[], modalidades[]`. `SnapModalidade`: `tipo('grupos'|'chaves'|'ordem_entrada'|'especifico'), status('sorteado'|'aguardando'), participantes[]`.
- Helper existente `lib/evento-stats.ts`:
  - `inscritos(e): number` — participantes distintos por id.
  - `totalModalidades(e): number` — `modalidades.length`.
  - `progressoSorteios(e): { sorteadas; sorteaveis; pct; done }` — `sorteadas` = modalidades `status==='sorteado'`; `sorteaveis` = `tipo!=='especifico'`; `done = sorteaveis>0 && sorteadas===sorteaveis`.
  - `dataPtBr` em `../../lib/boletim-categorias` (formato curto pt-BR).

## Derivação de status (por evento)

```
const { sorteadas, done } = progressoSorteios(e)
status =
  done            -> 'sorteado'    // Sorteado
  sorteadas > 0   -> 'andamento'   // Em andamento
  else            -> 'aguardando'  // Aguardando sorteio
```

Mapa visual:
| status | label | acento/tile (grad) | dot | métrica "Sorteios" |
|---|---|---|---|---|
| `sorteado` | Sorteado | `var(--grad-accent)` | `var(--accent)` | `.hl` (verde) |
| `andamento` | Sorteios em andamento | `var(--grad-brand)` | `var(--info)` | normal |
| `aguardando` | Aguardando sorteio | `var(--grad-warn)` | `var(--warn)` | `.zero` (esmaecido) |

## Componente — `EventoCardListagem.tsx` (`.evc`)

Novo arquivo `frontend/src/site-publico/components/EventoCardListagem.tsx`.
- `<a className="evc" href={\`/evento-${e.id}.html\`} data-status={status}>`:
  - `.accent` (height 5px, `background` = grad do status).
  - `.evc-h`: `.evc-tile` (grad do status, ícone `Medal` da lucide). **Sem `.evc-ed`.**
  - `.evc-body`: `.evc-title` (`e.nome`) + `.evc-loc` (`MapPin` + `${e.cidade} · ${dataPtBr(e.data)}`).
  - `.evc-stats`: 3 células — `<b>{totalModalidades(e)}</b>` Modalidades · `<b>{inscritos(e)}</b>` Inscritos · `<b class={sorteadas===0?'zero':done?'hl':''}>{sorteadas}</b>` Sorteios.
  - `.evc-foot`: `.evc-status` (`.d` dot com `background` do status + label) + `.evc-go` ("Ver evento" + `ArrowRight`).
- Ícones lucide: `Medal`, `MapPin`, `ArrowRight`.

## Página — `EventosPage.tsx`

- Manter hero e o agrupamento por ano (desc). Para cada ano:
  - `.yr-head`: `<span className="yr">{ano}</span>` + `<span className="sub"><b>{lista.length}</b> eventos · <b>{inscritosAno}</b> inscritos</span>` + `<span className="spacer" />` + `.yr-filter` com 4 botões:
    - `Todos` (default `.on`, `data-filter="todos"`).
    - `● Em andamento` (`data-filter="andamento"`, dot `var(--info)`).
    - `● Aguardando` (`data-filter="aguardando"`, dot `var(--warn)`).
    - `● Sorteado` (`data-filter="sorteado"`, dot `var(--accent)`).
  - `.ev-grid3` renderizando `<EventoCardListagem>` por evento.
  - O wrapper do grupo recebe `className="year-group"` (mantido).
- `inscritosAno` = soma de `inscritos(e)` dos eventos do ano (mantém o cálculo atual).
- **Script de filtro** (`<script dangerouslySetInnerHTML>`, sem dados de usuário interpolados): para cada `.year-group`, ligar `click` dos `.yr-filter button[data-filter]` para: alternar `.on` entre os botões do grupo e mostrar/ocultar os `.evc[data-status]` daquele grupo (`display`); `data-filter="todos"` mostra todos. Escopado por grupo (um filtro não afeta outro ano).
- O resumo (`eventos · inscritos`) permanece com os **totais do ano** (não recalcula ao filtrar) — alinhado ao protótipo (parede calma, números factuais).

## CSS (`site.css`)

- **Adicionar** (portado de `Listagem-redesign.html`): `.yr-head`, `.yr-head .yr/.sub/.sub b/.spacer`, `.yr-filter`, `.yr-filter button/.on/:hover/.d`, `.ev-grid3` (+ media 940/600), `a.evc`/`:hover`, `.evc .accent`, `.evc-h`, `.evc-tile`, `.evc-body`, `.evc-title`, `.evc-loc`, `.evc-stats` (+ `b`, `b.hl`, `b.zero`, `span`), `.evc-foot`, `.evc-status`/`.d`, `.evc-go` (+ hover da seta).
- **Remover** as classes do cabeçalho antigo da listagem, agora sem uso: `.year-head`, `.yc` (confirmar que só `EventosPage` as usava).
- **Manter**: `.ev-grid` e `.evento-card*` (usados pela home), `.year-group`.
- Vars usadas já presentes no público: `--grad-accent/-brand/-warn`, `--accent`, `--info`, `--warn`, `--accent-700`, `--brand-50/-200/-300/-600`, `--card-bg/-border`, `--hairline`, `--shadow-e1/-e3`, `--font-display/-mono/-sans`, `--duration-*`, `--ease-out`. Sem cores novas.

## Testes / Verificação

- `cd frontend && npm run build:site` sem erros; `npx vitest run src/site-publico` verde.
- **`EventoCardListagem`** (`renderToStaticMarkup`): para os 3 status, asserir `data-status` correto, o grad do acento (`var(--grad-accent)`/`-brand`/`-warn`), o label do status, a classe do número de Sorteios (`hl`/`zero`/normal), as 3 métricas e o `href`.
- **`EventosPage`**: `.yr-head` com ano + resumo; 4 pílulas de filtro (incl. Sorteado); `.ev-grid3`; cada card com `data-status`; presença do `<script>` de filtro.
- **Demo (screenshots) antes do merge na develop**: `/eventos.html` desktop + mobile, mostrando os 3 estados de status, o cabeçalho de ano e o filtro funcionando (com pelo menos um screenshot pós-clique numa pílula). Preferência do Wagner.

## Fora de escopo
- Home (`IndexPage`) e o card simples (mantidos).
- Hero do detalhe do evento (mantido).
- Menu hambúrguer mobile do `SiteNav` (lacuna pré-existente).
- Recalcular o resumo do ano ao filtrar (mantém totais).

## Restrições globais
- Host Windows; ler antes de editar; caminhos absolutos. Git identity inline (`-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`).
- Validar com `npm run build:site`. Reusar tokens/classes; sem cores novas. Nunca `git add -A`.
- Demo antes da develop; promoção a prod só com confirmação do Wagner.
