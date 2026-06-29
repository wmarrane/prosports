# Navegação mobile da página de evento no site público (B2) — Design

**Data:** 2026-06-28
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Sub-projeto **B2** (de dois — B1 = visualizador de chave, já entregue). Resolve a dor "página de detalhe do evento longa demais no celular": eventos multiesportivos têm dezenas de modalidades em vários esportes e hoje tudo empilha num scroll quase infinito. A solução é uma **navegação de esportes fixa** (pills + bottom-sheet) que mostra **um esporte por vez**, com **filtro de situação**.

Baseado em `personaladmin/handoff/design_handoff_evento_mobile/` (`evento-mobile.jsx`/`.css`), porém **apenas o núcleo de navegação** — o restante do protótipo fica fora de escopo (ver "Fora de escopo").

## Decisões aprovadas

- **Só mobile.** O redesign vale abaixo de `@media (max-width:767px)`. **O desktop continua exatamente a página atual** — intocado por construção (todas as regras novas vivem dentro do media query).
- **Escopo enxuto (núcleo do handoff):** navegação de esportes (pills + bottom-sheet) + um esporte por vez + filtro de situação. **Fora:** hero novo / app bar condensável, busca em tela cheia, FAB voltar-ao-topo.
- **Reusar os cards atuais** (`<details class="mod-acc">`, mesmo componente do desktop). Sem segundo estilo de card.
- **Approach A — marcação compartilhada + CSS/JS por media query.** Fonte única de cards; o JS apenas seta atributos `data-*` e o CSS reage só sob o media query. Sem duplicação de HTML.
- **Interatividade via `<script>` inline** (site público é SSG puro, sem React no cliente — mesmo padrão do B1/boletins/compartilhar). Sem dados de usuário interpolados no script.
- **Sem cores novas.** Ponto colorido das pills usa `TIPO_INFO.grad` (tokens existentes). Classes do bloco mobile sempre `.em-*` (seguro contra o CSS global do site).

## Contexto (codebase)

- Site público: SSG React (`renderToStaticMarkup` → HTML estático). **Sem runtime React no cliente**; interações via `<script dangerouslySetInnerHTML>`.
- `frontend/src/site-publico/pages/EventoPage.tsx` já agrupa as modalidades por categoria num `Map` (`cats`), chave = `categoriaDe(m)` = `m.grupo ?? esporteBase(m.nome)`. Renderiza uma `<section class="cat-section">` por chave (com `<h2 class="cat-head">{cat} <span>{n}</span></h2>` e os `<details class="mod-acc">`), além do hero e da seção de boletins.
- `frontend/src/site-publico/lib/evento-stats.ts`: `TIPO_INFO: Record<TipoSorteio,{grad,label}>` (gradientes em tokens), `tipoDominante`, etc.
- `statusLabel(m)` em `EventoPage.tsx` já deriva a situação exibida; o status bruto é `m.status` (`'sorteado'` quando sorteado).
- B1 já portou um subconjunto `.em-*` (overlay do bracket: `em-bracket-ov`, `em-vtog`, `em-rtab`, `em-pane`, `em-round`, `em-bk-*`, etc.). As classes deste B2 (`em-catbar`, `em-pills`, `em-pill`, `em-grid-btn`, `em-sheet`, `em-scrim`, `em-sheet-item`, `seg`) **não colidem** com as do B1.

## Arquitetura — Approach A (contrato `data-*`)

O JS só **seta atributos**; o CSS decide o efeito visual, e **as regras de esconder/mostrar ficam todas dentro de `@media (max-width:767px)`**. Logo o desktop nunca é afetado (os atributos existem mas nenhuma regra fora do media query os usa).

- **Esporte ativo:** cada `.cat-section` recebe `data-sport="<key>"` e `data-on="true|false"`. JS alterna `data-on` (true só na seção ativa) e o espelha na pill correspondente. CSS `@media`: `.cat-section[data-on="false"]{display:none}`. Servidor renderiza a **1ª seção** com `data-on="true"` e as demais `"false"`.
- **Filtro de situação:** `<main>` recebe `data-status-filter="all|aberto|sorteado"` (padrão `"all"`, setado pelo servidor). Cada `.mod-acc` recebe `data-mstatus="sorteado"` quando `m.status==='sorteado'`, senão `"aberto"`. CSS `@media`:
  - `main[data-status-filter="sorteado"] .mod-acc[data-mstatus="aberto"]{display:none}`
  - `main[data-status-filter="aberto"] .mod-acc[data-mstatus="sorteado"]{display:none}`
- **Bottom-sheet:** `.em-sheet` e `.em-scrim` recebem `data-open="true|false"` (padrão `"false"`). JS alterna.

**Degradação sem JS:** mobile mostra o 1º esporte (demais escondidos por CSS) com todos os cards; pills/sheet/filtro ficam visíveis mas inertes. Desktop: todas as seções visíveis (media query desligado).

## Componentes

### `EventoEsportesNav` (`frontend/src/site-publico/components/EventoEsportesNav.tsx`)

Componente apresentacional, renderizado uma vez na `EventoPage`. **Props:** `secoes: { key: string; count: number; tipo: TipoSorteio; sorteadas: number }[]`. Renderiza (escondido no desktop via CSS):

- **`.em-catbar`** (sticky): `.em-pills` com uma `.em-pill` por seção — ponto colorido `style={{background: TIPO_INFO[tipo].grad}}`, nome (`key`), contagem (`count`); atributos `data-sport={key}` e `data-on` (true na primeira). No fim, `.em-grid-btn` (abre o sheet).
- **`.seg`** (régua de filtro): 3 botões com `data-sf="all|aberto|sorteado"` ("Todas" com `data-on="true"`).
- **`.em-scrim`** + **`.em-sheet`** (`data-open="false"`): cabeçalho com título "Esportes" + botão fechar (`data-sheet-close`); `.em-sheet-item` por seção (`data-sport={key}`, ponto colorido, nome, "{count} modalidades", mini-barra `sorteadas/count`).

A montagem de `secoes` acontece na `EventoPage` a partir do `Map cats` já existente (`count = mods.length`, `tipo = tipoDominante da seção`, `sorteadas = mods.filter(status==='sorteado').length`).

### `EventoPage.tsx` (modificação)

- `<main>` recebe `data-status-filter="all"`.
- Cada `<section class="cat-section" data-sport={cat} data-on={i===0 ? 'true':'false'}>`.
- Cada `<details class="mod-acc" data-mstatus={m.status==='sorteado' ? 'sorteado':'aberto'}>`.
- Renderiza `<EventoEsportesNav secoes={...} />` antes do conteúdo das seções (dentro do `container`/`<main>`, posição que o CSS fixa como sticky no mobile).
- Adiciona um `<script dangerouslySetInnerHTML>` de controle da navegação (ver abaixo). Mantém o `<script>` de compartilhar e os overlays/script do B1.

### `<script>` inline (controle da navegação)

Sem dados interpolados; só seletores e `data-*`:
- Clique em `.em-pill[data-sport]` **ou** `.em-sheet-item[data-sport]` → lê `key`; seta `data-on` em todas as `.cat-section` (`===key`) e em todas as `.em-pill` (`===key`); fecha o sheet (`data-open="false"`).
- Clique em `.em-grid-btn` → `data-open="true"` no `.em-sheet` e `.em-scrim`. Clique em `[data-sheet-close]` ou `.em-scrim` → `"false"`.
- Clique em `.seg button[data-sf]` → seta `data-status-filter` no `<main>` e `data-on` no botão clicado (limpando os irmãos).

## CSS (`site.css`)

Bloco novo **inteiro dentro de `@media (max-width:767px)`**, prefixo `.em-*`:
- `.em-catbar` (sticky `top:0`, sob o `SiteNav`; fundo + borda via tokens), `.em-pills` (flex, scroll-x), `.em-pill` / `.em-pill[data-on]`, `.em-grid-btn`.
- `.seg` / `.seg button` / `.seg button[data-on]`.
- `.em-scrim` (fixed, fundo translúcido), `.em-sheet` (fixed bottom, `data-open` controla visibilidade/translate), `.em-sheet-item`, mini-barra.
- Regras de visibilidade do contrato `data-*` (esporte ativo + filtro).
- Manter o `.cat-head` (título do esporte ativo) — serve de cabeçalho da seção visível; só a seção ativa aparece no mobile.

Reuso de tokens; **sem cores novas**. Fora do media query, `.em-catbar`/`.em-sheet`/`.em-scrim` não têm estilo (ou `display:none`), garantindo desktop intacto.

## Testes / Verificação

- `cd frontend && npx vitest run src/site-publico` verde; `npm run build:site` sem erros.
- **`EventoEsportesNav` (unit, `renderToStaticMarkup`)**: uma `.em-pill` por seção com `data-sport` e contagem corretos; 1ª pill `data-on="true"`; régua com 3 botões (`data-sf`); itens do sheet com `data-sport` e mini-barra.
- **`EventoPage` (estender o teste existente)**: `.cat-section` com `data-sport` e a 1ª com `data-on="true"`; `.mod-acc` com `data-mstatus` coerente com `m.status`; `<main data-status-filter="all">`; presença do `EventoEsportesNav` e do `<script>` de navegação; hero e seção de boletins intactos.
- **Demo (screenshots) antes do merge na develop**: **402px** — trocar esporte pelas pills, abrir o sheet e trocar por ele, filtrar Abertas/Sorteado; **1280px** — desktop inalterado (pills/sheet ausentes, todas as seções visíveis). Usar um evento multiesportivo real do snapshot.

## Fora de escopo

- Hero novo / app bar condensável com anel de progresso; busca em tela cheia; FAB voltar-ao-topo.
- Card `.em-mod` do protótipo (reusamos o card atual).
- Versão **desktop** do padrão (handoff cita como passo futuro).
- Visualizador de **grupos** (próximo passo do handoff).
- Tweaks do protótipo (navMode dropdown/list, densidade).

## Restrições globais

- Host Windows; ler antes de editar; caminhos absolutos. Git identity inline (`-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`).
- Validar com `npm run build:site`. Reusar tokens/classes/componentes; sem cores novas; classes do bloco mobile sempre `.em-*`. Nunca `git add -A`.
- Demo antes da develop; promoção a prod só com confirmação do Wagner.
