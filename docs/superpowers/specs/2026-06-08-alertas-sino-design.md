# Alertas no ícone Sino (notificações operacionais) — Design

**Data:** 2026-06-08
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Dar funcionalidade ao ícone Sino do Topbar (hoje decorativo, com um pontinho estático): um **popover de alertas operacionais** derivados dos dados existentes (client-side, sem sistema de notificações no backend).

## Escopo

Alertas **client-side**, calculados a partir de endpoints já existentes. Quatro categorias:

1. **Eventos prontos sem sorteio** — `status === 'pronto'`
2. **Eventos com sorteio parcial** — `status === 'parcial'`
3. **Eventos com inscrições abertas** — `status === 'inscricoes'`
4. **Modalidades sem regra** — modalidade (tipo grupos/chaves) com N inscritos sem regra de `sistema_disputas` cadastrada para esse N, em eventos ativos.

**Fora de escopo:** sistema de notificações persistido (backend), lido/não-lido, tempo real, ações no popover além de navegar.

## Componente

- **Criar** `frontend/src/components/NotificationBell.tsx` — substitui o `<button class="icon-btn">` do Sino no `Topbar`. Botão com badge de contagem total + **popover** ancorado abaixo do ícone.
  - Abre ao clicar; fecha ao clicar fora (overlay transparente ou listener de `mousedown` no document) e com **Esc**.
  - Badge mostra o total de alertas; **some quando zero**.
- **Modificar** `frontend/src/components/Topbar.tsx` — troca o botão estático do Sino (e o `notif-dot`) por `<NotificationBell />`.
- **Criar** `frontend/src/lib/alertas.ts` — funções puras + tipos (sem React, testável).

## Tipos (em `lib/alertas.ts`)

```ts
export type AlertaTipo = 'pronto' | 'parcial' | 'inscricoes' | 'sem_regra'

export type Alerta = {
  id: string            // único (ex.: `evt-12-pronto`, `semregra-12-34`)
  tipo: AlertaTipo
  titulo: string        // ex.: "Pronto para sortear"
  descricao: string     // ex.: nome do evento (+ modalidade/N no sem_regra)
  to: string            // rota de navegação (ex.: /eventos/12/inscricoes)
}
```

## Dados (react-query)

- `eventosService.listar()` — **sempre** (1 query cacheada; compartilhada com EventosList). Traz `id`, `nome`, `status`, `competicao_id`, `competicao.modalidades[{ id, nome, sigla, tipo_modalidade.tipo }]`, `data_hora`.
- Para o item 4, sobre os **eventos ativos** (status ∈ {inscricoes, pronto, parcial}):
  - `inscricoesService.counts(eventoId)` → `Record<modalidade_id, number>` — via `useQueries` (uma por evento ativo), key `['inscricoes-counts', eventoId]`, `staleTime: 60_000`.
  - regras por competição dos eventos ativos: `sistemasDisputaService.grupos.listar(cid)` e `.chaves.listar(cid)` — via `useQueries` (deduplicado por competição), keys `['sistemas-grupos', cid]` / `['sistemas-chaves', cid]`, `staleTime: 60_000`.

## Funções puras

### `deriveEventoAlerts(eventos): Alerta[]`
- Mapeia cada evento por `status`:
  - `pronto` → `{ tipo:'pronto', titulo:'Pronto para sortear', descricao: nome, to:`/eventos/${id}/inscricoes` }`
  - `parcial` → `{ tipo:'parcial', titulo:'Sorteio incompleto', ... }`
  - `inscricoes` → `{ tipo:'inscricoes', titulo:'Inscrições abertas', ... }`
  - `rascunho` / `sorteado` → ignorados.

### `deriveSemRegraAlerts(input): Alerta[]`
Entrada:
```ts
{
  eventosAtivos: Array<{ id:number; nome:string; competicao_id:number;
    modalidades: Array<{ id:number; nome:string; tipo:'grupos'|'chaves'|'especifico'|'ordem_entrada' }> }>,
  countsByEvento: Record<number, Record<number, number>>,   // eventoId -> (modalidadeId -> N)
  rulesByCompeticao: Record<number, { grupos:number[]; chaves:number[] }>, // cid -> Ns com regra
}
```
Lógica: para cada evento ativo, para cada modalidade com `tipo ∈ {grupos,chaves}` e `N = counts[modId] > 0`:
- `grupos`: tem regra se `rulesByCompeticao[cid].grupos.includes(N)`.
- `chaves`: tem regra se `rulesByCompeticao[cid].chaves.includes(N)`.
- Se **não** tem regra → `{ id:`semregra-${evId}-${modId}`, tipo:'sem_regra', titulo:'Modalidade sem regra', descricao:`${eventoNome} · ${modNome} (${N})`, to:`/eventos/${evId}/inscricoes` }`.
- Modalidades `especifico`/`ordem_entrada` e N=0 são ignoradas.

## Montagem no componente

1. `eventos = useQuery(eventosService.listar)`.
2. `alertasStatus = deriveEventoAlerts(eventos)`.
3. `eventosAtivos = eventos.filter(status ∈ ativos)`.
4. `countsQueries = useQueries(eventosAtivos.map(e => counts(e.id)))`; monta `countsByEvento`.
5. `competicoesAtivas = unique(eventosAtivos.map(e => competicao_id))`; `rulesQueries = useQueries(...)`; monta `rulesByCompeticao` (extraindo os Ns: grupos→`quantidade_equipes`, chaves→`numero_inscrito`).
6. `alertasSemRegra = deriveSemRegraAlerts(...)` (só quando as queries resolveram; enquanto carrega, considera vazio).
7. `todos = [...alertasStatus, ...alertasSemRegra]`; badge = `todos.length`.

## UI do popover

- Agrupado por categoria, com cabeçalho e contagem por grupo; cada item: título + descrição; clicar **navega** (`useNavigate`) e fecha.
- Estado vazio: "Nenhum alerta no momento".
- Estilo theme-aware (vars `--card-bg`/`--card-border`/`--t*`), no padrão dos outros popovers/cards. Largura ~360px, scroll se exceder.

## Testes (`frontend/src/lib/alertas.test.ts`, Vitest puro)

- `deriveEventoAlerts`: classifica pronto/parcial/inscricoes; ignora rascunho/sorteado; gera `to` correto; ordem estável.
- `deriveSemRegraAlerts`:
  - chaves com N sem regra → alerta; com regra → nada.
  - grupos idem.
  - tipo `especifico`/`ordem_entrada` → ignorado.
  - N=0 → ignorado.
  - descrição e `to` corretos.

## Performance / observações

- Item 4 dispara N queries pequenas (counts por evento ativo + regras por competição), **cacheadas** com `staleTime` de 60s — não refaz a cada navegação. Escala atual (poucos eventos) é tranquila.
- Se no futuro o volume crescer, migrar o item 4 para um endpoint backend dedicado (fora de escopo agora).
