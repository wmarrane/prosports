# Eventos — mover o card "Capa" para o admin + reverter card do site público — Design

**Data:** 2026-06-27
**Status:** Aprovado (aguardando revisão da spec)

## Contexto

A entrega anterior (`2026-06-27-eventos-card-detalhe-redesign-design.md`) aplicou **dois** redesenhos ao **site público**: o card "Capa" (`EventoCard.tsx`, usado na home e na listagem) e o hero do detalhe (`EventoPage.tsx`). Na revisão, o Wagner esclareceu o destino correto:

- **Detalhe-redesign.html** → página pública de cada evento. **Já está correto** (`EventoPage.tsx`), permanece inalterado.
- **Card-final.html** → cards de eventos do **admin (NewProsports)**, não do site público.

Logo, este trabalho **move** o card "Capa" do site público para o admin e **reverte** o card do site público ao desenho anterior (simples).

## Objetivo

1. **Reverter** o card do site público (`EventoCard.tsx` + CSS) ao estado anterior à branch `feat/eventos-redesign`.
2. **Aplicar** o desenho do `Card-final.html` aos cards de evento do admin, em um novo componente `EventoAdminCard.tsx`, consumido por `EventosList.tsx`.
3. **Manter** o hero do detalhe público (`EventoPage.tsx`) e seu CSS (`.ev-hero2`…, breadcrumb) intactos.

**Fonte pixel-perfect do card:** `personaladmin/handoff/design_handoff_eventos/Card-final.html`.

## Decisões de design (aprovadas)

- **Ações do admin:** linha de ações no **rodapé** do card (preserva Inscrições, Publicar/Despublicar, Remover). O card inteiro continua clicável para abrir editar/inscrições.
- **Status no cover:** manter as **cores semânticas** por status (Rascunho/Inscrições/Pronto/Sorteado/Parcial/Suspenso), em pílula legível sobre o cover — não usar a badge glass uniforme.
- **Estrutura:** novo componente `EventoAdminCard.tsx` com **estilos inline** (convenção do admin), recebendo o evento + callbacks por props. `EventosList.tsx` mantém lista/agrupamento/filtros/estado e passa a renderizar o novo card.

## Parte 1 — Reverter o card do site público

Estado-alvo = conteúdo em `6b40e08` (ponto de divergência da branch).

- **`frontend/src/site-publico/components/EventoCard.tsx`** → restaurar versão simples:
  ```tsx
  import type { SnapEvento } from '../snapshot-types'
  import { esporteBase } from '../lib/esporte'

  export default function EventoCard({ evento }: { evento: SnapEvento }) {
    const total = new Set(evento.modalidades.map(m => esporteBase(m.nome))).size
    const inscritos = new Set(evento.modalidades.flatMap(m => m.participantes.map(p => p.id))).size
    const sorteadas = evento.modalidades.filter(m => m.status === 'sorteado').length
    return (
      <a className="evento-card" href={`/evento-${evento.id}.html`}>
        <h3>{evento.nome}</h3>
        <p className="evento-meta">{evento.cidade} · {new Date(evento.data).toLocaleDateString('pt-BR')}</p>
        <div className="evento-counts">
          <span>{total} modalidades</span><span>{inscritos} inscritos</span><span>{sorteadas} sorteadas</span>
        </div>
      </a>
    )
  }
  ```
- **`frontend/src/site-publico/site.css`**:
  - **Remover** as classes do card "Capa": `.ev2`, `.cover`, `.cover-top`, `.c-icons`, `.c-tile`, `.c-more`, `.c-badge`, `.c-loc`, `.b`, `.b-title`, `.b-comp`, `.prog`, `.prog-head`, `.bar`, `.foot` (e suas media queries específicas do card).
  - **Restaurar** `.evento-card`, `.evento-card:hover`, `.evento-card h3`, `.evento-meta`, `.evento-counts`, `.evento-counts span` (conteúdo de `6b40e08`).
  - **Restaurar** `.ev-grid` para `grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 18px;` (remover o override `repeat(2,1fr)` + media query do card).
  - **Manter intactos**: todo o bloco do hero (`.ev-hero2`, `.ev-grid2`, `.ev-badges`, `.ev-type-tile`, `.ev-h-title`, `.ev-h-meta`, `.hero-prog`, `.hero-bar`, `.ev-actions`, `.stat-pair`, `.info-band`, `.info-card`, `.btn-onhero` e o `.breadcrumb` recém-adicionado) e `.badge.b-accent`.
- **`frontend/src/site-publico/EventoCard.test.tsx`** → **remover** (testava a estrutura do card novo; o card antigo não tinha teste).
- **Manter**: `frontend/src/site-publico/lib/evento-stats.ts` (+ `evento-stats.test.ts`) e `EventoPage-hero.test.tsx` — usados pelo hero.

## Parte 2 — Card "Capa" no admin (`EventoAdminCard.tsx`)

Novo arquivo `frontend/src/pages/eventos/EventoAdminCard.tsx`. Estilos inline. Reproduz `Card-final.html`, adaptado aos dados do tipo `Evento` e às ações do admin.

### Dados (derivações a partir de `Evento`)
- **tipos** = tipos de modalidade distintos das modalidades da competição, **ordenados por frequência desc** (dominante = primeiro). Reaproveitar a lógica de `eventoTipos(ev)` já existente, estendida para contar frequência.
  - Mapa tipo → `{ grad, icon, label }`:
    - `chaves` → `var(--grad-brand)` · `Brackets` · "Chaves"
    - `grupos` → `var(--grad-accent)` · `Group` · "Grupos"
    - `ordem_entrada` → `var(--grad-violet)` · `ListOrdered` · "Ordem de entrada"
    - `especifico` → `var(--grad-warn)` · `FileText` · "Específico"
  - Sem tipos → cover com `var(--grad-brand)` e um tile tracejado "sem modalidades" (`FileText`).
- **dominante** = `tipos[0]` (ou fallback se vazio); cover usa `dominante.grad`.
- **status** = `ev.status` → `STATUS_LABEL[ev.status]` + cor via `STATUS_COLOR[ev.status]` (reutilizar `../../lib/evento-status`).
- **local/data** = `ev.municipio.nome/ev.municipio.uf` · `formatDateBR(ev.data_hora)`.
- **título** = `ev.nome`; **competição** = `ev.competicao.nome`.
- **progresso**: `sorteadas = ev._count?.sorteios ?? 0`; `total = ev.competicao?.modalidades?.length ?? 0`; `sorteaveis = ev.modalidades_sorteaveis ?? total`; `pct = sorteaveis>0 ? round(sorteadas/sorteaveis*100) : 0`; `done = sorteaveis>0 && sorteadas===sorteaveis`. Ocultar o bloco se `sorteaveis===0`.
- **metas**: `inscritos = ev.total_participantes ?? 0`; `modalidades = ev.modalidades_distintas ?? total`.

### Estrutura visual (do `Card-final.html`)
- **`.cover`** (`background: dominante.grad`): textura de pontos (`radial-gradient` branco 16%, `background-size:14px`).
  - **cover-top**: cluster `.c-icons` (até 2 `.c-tile` glass com ícone lucide do tipo + `.c-more` "+N") à esquerda; **pílula de status** à direita — usar `STATUS_COLOR[ev.status]` (cores semânticas, legível sobre o cover; aplicar via `className`).
  - **cover-foot**: `MapPin` + `município/UF · data` em mono, `rgba(255,255,255,.92)`.
- **corpo** (branco):
  - **título** (`var(--font-display)`, 18px/800).
  - **competição** (12.5px, `Trophy`).
  - **progresso** (`.prog`): label "Andamento dos sorteios" + `N/M` mono (verde `var(--accent-700)` + " ✓" quando `done`); barra 7px, trilho `var(--card-border)`, preenchimento `max(pct,3)%` cor `done ? var(--grad-accent) : dominante.grad`. Ocultar se `sorteaveis===0`.
  - **metas** (`.foot`, borda-topo `var(--hairline)`): `Users` + `<b>inscritos</b> inscritos` · `FileText/List` + `<b>modalidades</b> modalidades`.
- **linha de ações** (no fim do card, abaixo das metas, separada por borda):
  - **Inscrições** → `navigate('/eventos/{id}/inscricoes')`.
  - **Publicar no site** (quando `!ev.site_publicado_em`; desabilitado se `ev.status !== 'sorteado'`) / **Despublicar** (quando `ev.site_publicado_em`). Mesmos títulos/tooltips e estados de loading de hoje.
  - **Remover** → abre o `ConfirmDialog` (via callback que chama `setAlvo`).
  - Todas com `e.stopPropagation()` para não disparar o clique do card.
- **interação do card**: clique no card (fora dos botões) → `navigate('/eventos/{id}/'+(isAdmin?'editar':'inscricoes'))`. Hover: `translateY(-3px)` + sombra. Suspenso: fundo/borda de aviso (preservar comportamento atual).

### Props do componente
```ts
interface EventoAdminCardProps {
  evento: Evento
  isAdmin: boolean
  publicando: boolean
  despublicando: boolean
  onAbrir: (ev: Evento) => void
  onInscricoes: (ev: Evento) => void
  onPublicar: (id: number) => void
  onDespublicar: (id: number) => void
  onRemover: (ev: Evento) => void
}
```

### Integração em `EventosList.tsx`
- Substituir, dentro de `renderGrupos`, o `<div>` do card inline pelo `<EventoAdminCard … />`, passando os callbacks já existentes (`navigate`, `publicarSite`, `despublicarSite`, `handleRemove`/`setAlvo`) e flags (`isAdmin`, `publicandoSite`, `despublicandoSite`).
- Remover do `EventosList.tsx` o JSX/estilos do card antigo e o helper `Meta` (migram para o novo componente). Manter filtros, agrupamento, colapsáveis, estado vazio, `ConfirmDialog`.
- Manter a grade do grupo: `grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;`.

## Tokens

Todas as vars necessárias já existem no contexto do admin (`tokens.css` + `prosports-theme.css`): `--grad-brand`, `--grad-accent`, `--grad-violet`, `--grad-warn`, `--grad-brand-deep`, `--accent-700`, `--hairline`, `--card-bg`, `--card-border`. **Sem cores novas.**

## Responsivo
- Card público (revertido): grade `auto-fill minmax(330px,1fr)`; 1 coluna natural em telas estreitas.
- Card admin: grade do grupo já é `auto-fill minmax(320px,1fr)` (responsiva). Card inteiro é alvo de toque ≥44px; ações com alvos adequados no mobile.

## Testes / Verificação
- `cd frontend && npm run build` (tsc -b && vite build) e `npm run build:site` sem erros.
- **Site público**: confirmar que o card voltou ao desenho simples (`renderToStaticMarkup` opcional; ou validação visual) e que o hero do detalhe segue intacto. Suite `vitest` do site-público verde após remover `EventoCard.test.tsx`.
- **Admin**: teste de render de `EventoAdminCard` via `renderToStaticMarkup` — cover com tipo dominante, progresso `N/M`, pílula de status, presença dos botões de ação; oculta progresso quando `sorteaveis===0`. Garantir que `npm run build` do admin compila.
- **Demo (screenshots) antes do merge na develop**: listagem do admin (`/eventos`) com os novos cards (cores por tipo, +N multi-tipo, status semântico, ações no rodapé) em desktop e mobile; e a listagem pública (`/eventos.html`) mostrando o card simples restaurado. Conforme preferência do Wagner.

## Fora de escopo
- Alterar o hero do detalhe público (mantido).
- Menu hambúrguer mobile do site público (lacuna pré-existente).
- Mudar regras de publicação/sorteio do admin — apenas reembrulhar as ações no novo card.

## Restrições globais
- Host Windows; ler antes de editar; caminhos absolutos. Git identity inline (`-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`).
- Validar com `npm run build` e `npm run build:site`. Reusar tokens/classes; sem cores novas.
- Nunca `git add -A` (commitar arquivos específicos).
- Demo antes da develop; promoção a prod só com confirmação do Wagner.
