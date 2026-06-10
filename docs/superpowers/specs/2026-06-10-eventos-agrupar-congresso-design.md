# Agrupar eventos por competição (EventosList) + filtro do Modo Congresso — Design

**Data:** 2026-06-10
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Dois ajustes na listagem/seleção de eventos:
- **A)** Na tela **Eventos** (`EventosList`): agrupar os cards por **competição**, em seções **colapsáveis**, ordenadas por **data do evento**.
- **B)** No **Modo Congresso** (`CongressoStepEvento`): listar apenas eventos com status **'pronto'** ("Pronto p/ sorteio") **ou 'parcial'**.

## A) EventosList — agrupar por competição

### Lógica pura (testável)
`frontend/src/lib/agrupar-eventos.ts`: `agruparEventosPorCompeticao(eventos)` →
`Array<{ competicaoId: number; competicaoNome: string; eventos: Evento[] }>`, onde:
- agrupa por `competicao_id`;
- **eventos dentro do grupo** ordenados por `data_hora` desc;
- **grupos** ordenados pela **data do evento mais recente** de cada grupo (desc); empate → nome da competição (pt-BR).

### UI (`EventosList`)
- O filtro por tipo (chips) continua aplicando primeiro; o resultado (`lista`) é então agrupado por `agruparEventosPorCompeticao`.
- Estado local `recolhidas: Set<number>` (competições recolhidas) — **default: todas expandidas**.
- Cada grupo renderiza:
  - **Cabeçalho clicável** (chevron + `competicaoNome` + nº de eventos do grupo) que alterna recolher/expandir (toggle no `Set`).
  - Quando expandido: o **grid de cards** atual (mesmo card, sem alteração) com os eventos do grupo.
- Estados vazios (sem eventos / nenhum no filtro) permanecem como hoje.
- Estado de recolhido é efêmero (não persiste entre navegações).

## B) Modo Congresso — `CongressoStepEvento`

- Trocar o filtro atual `eventos.filter(e => e.status !== 'rascunho')` por
  `eventos.filter(e => e.status === 'pronto' || e.status === 'parcial')`.
- Ajustar os textos (contagem/vazio) para refletir "eventos prontos para sorteio" (ex.: vazio → "Nenhum evento pronto para sorteio."). A ordenação já vem por data (backend `data_hora` desc) — sem mudança.

## Testes

- `frontend/src/lib/agrupar-eventos.test.ts` (Vitest puro): agrupa por competição; ordena grupos pela data mais recente (desc); eventos dentro por data desc; empate por nome.
- UI (EventosList colapsável e filtro do Congresso): `npm run build` (tsc) + verificação manual.

## Fora de escopo

- Persistir o estado de recolhido entre sessões.
- Mudanças no conteúdo do card em si.
- Backend (ambos são ajustes de frontend; os dados necessários já vêm de `eventosService.listar`).
