# Eventos — card redesenhado + hero do detalhe (site público) — Design

**Data:** 2026-06-27
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Redesenhar, no **site público**, dois componentes da área de Eventos, conforme o handoff (`personaladmin/handoff/design_handoff_eventos/`):
1. **Card de evento** (`EventoCard.tsx`) — direção "Capa" (cover colorido pelo tipo de sorteio) + **barra de progresso** dos sorteios. Usado na **home** (IndexPage) e na **listagem** (EventosPage).
2. **Hero do detalhe** (`EventoPage.tsx`) — novo `.ev-hero2` (progresso + painel de ações + faixa de info), mantendo a seção "Boletins & documentos" e as modalidades já existentes.

Escopo aprovado: **só site público** (admin fora). Adaptar campos aos **dados reais** do snapshot (esconder o que não existe). **Menu mobile (hambúrguer) fora de escopo** (lacuna pré-existente do site).

**Fonte pixel-perfect:** `Card-final.html` e `Detalhe-redesign.html` (abrir e reproduzir). Reusar design system: `tokens.css` + `theme-vars.css` (vars no público) + `site.css`. Ícones inline → `lucide-react`.

## Contexto (codebase)

- Site público é **SSG em React** (`frontend/scripts/build-site-publico.tsx` → componentes em `frontend/src/site-publico/`), **não** `generator.mjs` (o README assume generator; aqui mapeia para os componentes React).
- `EventoCard.tsx` (atual): card simples; usado por `pages/IndexPage.tsx` (destaques) e `pages/EventosPage.tsx` (por ano), ambos em `.ev-grid`.
- `EventoPage.tsx`: `<SiteNav/>` + `<main className="evento-page"><header className="evento-header">…</header>{categorias de modalidades}{seção Boletins & documentos}</main>`. O `<header>` é o que será substituído pelo hero.
- Dados por evento (`SnapEvento`): `id, nome, competicao, cidade, local, data, organizador, dataInicio, dataFim, boletins[], modalidades[]`. `SnapModalidade`: `nome, tipo('grupos'|'chaves'|'ordem_entrada'|'especifico'), status('sorteado'|'aguardando'), participantes[]`. Helpers: `esporteBase` (`../lib/esporte`), `categoriaInfo/formatBytes/dataPtBr` (`../../lib/boletim-categorias`).
- Vars de cor já presentes em `theme-vars.css`/`tokens.css` (verificar `--grad-brand`, `--grad-accent`, `--grad-violet`, `--grad-warn`, `--grad-brand-deep`, `--brand-700`, `--accent-700`; adicionar fallback se faltar). `.badge`/`b-*` e `.b-violet/.b-neutral` já portados ao `site.css` em trabalho anterior.

## Mapeamento de dados (derivações por evento)

Helper compartilhado novo `frontend/src/site-publico/lib/evento-stats.ts`:
- `tiposPresentes(evento)` → tipos distintos das modalidades, ordenados por frequência desc (dominante = primeiro). Mapa: `chaves→{grad:'var(--grad-brand)', icon:bracket, label:'Chaves eliminatórias'}`, `grupos→{grad:'var(--grad-accent)', icon:groups, label:'Grupos'}`, `ordem_entrada→{grad:'var(--grad-violet)', icon:order, label:'Ordem de entrada'}`, `especifico→{grad:'var(--grad-warn)', icon:list, label:'Específico'}`.
- `inscritos(evento)` = participantes distintos por id (`new Set(modalidades.flatMap(m=>m.participantes.map(p=>p.id))).size`).
- `totalModalidades(evento)` = `modalidades.length`.
- `categorias(evento)` = `new Set(modalidades.map(m=>esporteBase(m.nome))).size`.
- `sorteaveis(evento)` = modalidades com `tipo !== 'especifico'`.
- `sorteadas(evento)` = `modalidades.filter(m=>m.status==='sorteado').length`.
- Progresso: `N = sorteadas`, `M = sorteaveis.length`. `pct = M>0 ? round(N/M*100) : 0`. `done = M>0 && N===M`. Se `M===0`, ocultar o bloco de progresso.
- Status do evento (card/hero): `done ? 'Sorteado' : 'Pronto p/ sorteio'` (hero: badge `b-accent` "Sorteios em andamento" quando há sorteáveis e não concluído; "Sorteado" quando done).

## 1. Card (`EventoCard.tsx`) — recriar + CSS

Reproduzir `Card-final.html`: `<a className="ev2" href="/evento-{id}.html">` com:
- `.cover` (`style={{ background: dominante.grad }}`): textura via CSS; `.cover-top` com `.c-icons` (até 2 `.c-tile` com ícone lucide do tipo + `.c-more` "+N") e `.c-badge` glass (dot + status); `.c-loc` (pin + `cidade · dataPtBr(data)`, mono).
- `.b`: `.b-title` (nome), `.b-comp` (troféu + competicao), `.prog` (label "Andamento dos sorteios" + `N/M` [classe `done` quando completo, com " ✓"] + `.bar > span` width `max(pct,3)%`, cor `done ? var(--grad-accent) : dominante.grad`) — **ocultar `.prog` se M===0**; `.foot` (users `inscritos` · list `totalModalidades` + "Ver evento →" com seta).
- Ícones lucide: `GitFork`(ou um bracket), `Circle`(grupos — usar 4? simplificar para um ícone representativo), `ListOrdered`, `List`, `Trophy`, `Users`, `MapPin`, `ArrowRight`. (Para o cluster de tipos, usar um ícone por tipo: chaves→`GitFork`, grupos→`Grid2x2`/`Circle`, ordem_entrada→`ListOrdered`, especifico→`List`.)
- CSS `.ev2/.cover/.c-*/.b/.b-title/.b-comp/.prog/.bar/.foot/...` portado para `site.css` (do `Card-final.html`). A `.ev-grid` já existe; ajustar para `repeat(2,1fr)` gap 18px / 1 coluna ≤760px se ainda não estiver.

## 2. Hero do detalhe (`EventoPage.tsx`) — substituir o header + CSS

Substituir `<header className="evento-header">…</header>` por:
- `<section className="ev-hero2">` (blobs b1/b2) → `.container` → `.ev-hero2-inner`:
  - `.breadcrumb`: Início › Eventos › {ano} › {nome}.
  - `.ev-grid2` (2 col, empilha ≤920px):
    - Esquerda: `.ev-badges` (tiles dos tipos presentes `.ev-type-tile` + `.badge b-accent` de status); `<h1 className="ev-h-title">{nome}` (**`color:#fff` explícito** no CSS); `.ev-h-meta` (troféu competicao · calendar data/período · pin local·cidade); `.hero-prog` (label + `N/M` + `.hero-bar>span` width pct% + `.sub` "X% das modalidades já sorteadas · Y aguardando") — ocultar se M===0.
    - Direita: `<aside className="ev-actions">` — `.stat-pair` 2×2: Modalidades (`totalModalidades`), Inscritos (`inscritos`), Categorias (`categorias`), Com sorteio (`sorteadas`); `.divider`; CTAs: `.btn-onhero.solid` **"Baixar boletim oficial"** (download) → último boletim (`boletins` ordenado por `atualizadoEm` desc; `href` do mais recente; **ocultar o botão se não houver boletins**); `.btn-onhero.ghost` **"Compartilhar evento"** → `onClick` com `navigator.share({title, url})` e fallback `navigator.clipboard.writeText(url)` (a página é estática; o handler é um `<script>` inline pequeno OU um botão com `data-` + script no html-shell — ver nota).
- Após o hero, dentro de `.section`: `.info-band` (4 `.info-card`, sobrepõe o hero em desktop, 4→2 col ≤760px): **Período** (calendar; `dataInicio–dataFim` ou `data`), **Sorteios** (clock; `N/M`), **Local** (pin; `local · cidade`), **Organização** (building; `organizador` — ocultar o card se vazio). 
- Mantém a seção "Boletins & documentos" (existente) e as modalidades abaixo, inalteradas.
- **Compartilhar (SSG):** como `EventoPage` é renderizado a estático, o botão "Compartilhar" recebe `data-share-url`/`data-share-title` e um `<script dangerouslySetInnerHTML>` (sem dados interpolados de usuário no script) liga o `click` a `navigator.share`/clipboard — mesmo padrão do filtro de boletins anterior. Sem dependência de backend.
- CSS `.ev-hero2/.ev-grid2/.ev-badges/.ev-type-tile/.ev-h-title/.ev-h-meta/.hero-prog/.hero-bar/.ev-actions/.stat-pair/.btn-onhero/.info-band/.info-card/...` portado para `site.css`. Garantir `--grad-brand-deep` disponível no `theme-vars.css` (adicionar se faltar, com o valor de `prosports-theme.css`).

## Responsivo / mobile
- Card: `.ev-grid` 1 coluna ≤760px; card inteiro clicável (alvo ≥44px).
- Hero: `.ev-grid2` empilha ≤920px; `.info-band` 4→2 col ≤760px (sem sobreposição negativa no mobile); ≤600px reduz paddings/blobs/métricas. Portar as media queries do protótipo.

## Testes / Verificação
- `cd frontend && npm run build && npm run build:site` sem erros.
- Atualizar/adicionar teste de render: `EventoCard` (cover, progresso N/M, badges; oculta progresso quando só especifico) e `EventoPage` hero (título, stat-pair, faixa de info, botão "Baixar boletim oficial" só quando há boletim) via `renderToStaticMarkup`.
- Helper `evento-stats.ts` com teste unitário (tipos por frequência, sorteáveis, progresso, categorias, inscritos).
- Manual (após deploy): home/listagem com novos cards (cores por tipo, progresso, +N em multi-tipo); detalhe com hero novo (progresso, stats, faixa de info, baixar último boletim, compartilhar) em desktop e mobile (~390px).
- Demo (screenshots) antes do merge na develop.

## Fora de escopo
- Aplicar o card no admin.
- Menu hambúrguer mobile do SiteNav (lacuna pré-existente do site).
- Campos editoriais que não existem (datas de inscrição/janela de sorteio): a faixa de info usa Período/Sorteios/Local/Organização.
- Alterar a lista de modalidades e a seção de Boletins (mantidas).

## Restrições globais
- Host Windows; ler antes de editar; caminhos absolutos. Git identity inline (Wagner Marrane <wmarrane@gmail.com>).
- Validar com `npm run build` e `npm run build:site`. Reusar tokens/classes; sem cores novas além das vars do tema (adicionar fallback de var ao `theme-vars.css` se alguma faltar no contexto público).
- Demo antes da develop; promoção a prod só com confirmação do Wagner.
