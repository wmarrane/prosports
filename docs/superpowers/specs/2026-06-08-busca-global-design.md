# Busca Global (⌘K) — Design

**Data:** 2026-06-08
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Dar funcionalidade ao campo de busca do Topbar (hoje um placeholder inerte com dica ⌘K): um **command palette** que busca e navega rapidamente pelas entidades principais.

## Escopo (v1)

- Entidades: **Eventos, Modalidades, Competições**.
- Busca **100% client-side** — sem novo endpoint de backend.
- **Fora de escopo (v1):** atletas/participantes (tabela grande, exigiria endpoint de busca no backend) — fica para uma fase 2. Também fora: ações/comandos (ex.: "Novo evento"); só navegação para entidades existentes.

## Disparo e teclado

- Clicar no campo de busca do Topbar **abre** o palette (o input vira um botão que abre o overlay).
- Atalho global **⌘K (mac) / Ctrl+K (win)** abre de qualquer tela autenticada; **Esc** fecha.
- **↑/↓** movem a seleção; **Enter** abre o item selecionado; clique também abre.
- Ao abrir, foco automático no input; ao fechar, limpa a query.

## Dados e filtro

- Reaproveita os serviços já existentes via react-query (cacheados; sem requisição nova obrigatória ao abrir):
  - `eventosService.listar()`
  - `modalidadesService.listar()`
  - `competicoesService.listar()`
- Função pura de filtro `filterEntities(query, { eventos, modalidades, competicoes })`:
  - Normalização **case e acento-insensitive**: `s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()`.
  - Casa por **nome** (todas as entidades). **Modalidade** também casa por **sigla**. Competição e Evento não têm sigla → só por nome.
  - Query vazia → retorna listas vazias (estado "digite para buscar").
  - Limita a **6 itens por grupo**.
  - Retorna estrutura agrupada: `{ eventos: Item[], modalidades: Item[], competicoes: Item[] }`, onde `Item = { id, label, sublabel?, to }`.

## Navegação ao selecionar

- Evento → `/eventos/:id/inscricoes`
- Modalidade → `/modalidades/:id/editar`
- Competição → `/competicoes/:id/editar`

(usando `useNavigate` do react-router; fecha o palette após navegar.)

## Componentes / arquivos

- **Criar** `frontend/src/lib/command-palette.ts` — função pura `filterEntities` + tipos `PaletteItem`/`PaletteResults` + `normalize`. Sem React (testável isolado).
- **Criar** `frontend/src/components/CommandPalette.tsx` — overlay modal (estilo `ConfirmDialog`: `position:fixed; inset:0`, backdrop, card central theme-aware via vars `--card-bg`/`--card-border`/`--t*`). Props: `open`, `onClose`. Faz os `useQuery`, chama `filterEntities`, renderiza grupos, gerencia seleção por teclado e navegação.
- **Modificar** `frontend/src/components/Topbar.tsx` — o `.search` vira botão que abre o palette; monta `<CommandPalette open onClose>`; registra o listener global ⌘K/Ctrl+K (em `useEffect`, removido no cleanup).

## Estados de UI

- **Vazio** (query em branco): dica "Digite para buscar eventos, modalidades, competições…".
- **Sem resultado**: "Nenhum resultado para \"<query>\"".
- Cada grupo só aparece se tiver itens; cabeçalho do grupo com rótulo (Eventos/Modalidades/Competições) e ícone do tipo (reusar ícones já usados: `Brackets/Group/...` ou os de entidade).

## Acessibilidade / detalhes

- Overlay com `role="dialog"`; input com `aria-label="Busca global"`.
- A lista de resultados é "flat" para navegação por teclado (índice global atravessa os grupos); item selecionado com destaque (`var(--brand-50)`/borda).
- Clicar no backdrop fecha.

## Testes

- `frontend/src/lib/command-palette.test.ts` (Vitest, sem testing-library):
  - `normalize` remove acento e caixa (ex.: "São" → "sao").
  - `filterEntities('jud', ...)` casa modalidade "Judô" por nome.
  - casa modalidade por **sigla** (ex.: query "JFL").
  - query vazia → grupos vazios.
  - respeita o **limite de 6** por grupo.
  - monta `to` correto por tipo (inscricoes / modalidades editar / competicoes editar).

## Fora de escopo

- Atletas/participantes (fase 2, com endpoint backend `GET /participantes?q=&limit=`).
- Ações/comandos e histórico de buscas recentes.
- Busca fuzzy/ranking avançado (basta substring normalizada).
