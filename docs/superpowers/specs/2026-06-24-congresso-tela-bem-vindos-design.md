# Modo Congresso — tela "Bem-vindos" (após selecionar o evento) — Design

**Data:** 2026-06-24
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Adicionar uma etapa **"Bem-vindos"** no Modo Congresso, exibida **após selecionar o evento** e **antes** da etapa de Modalidades, com:
- **Bloco 1:** logo do evento (regra do logo cadastrado) + nome do evento.
- **Bloco 2:** big numbers — nº de **modalidades** (esportes distintos) e nº de **inscritos** (participantes distintos do evento).
- **Bloco 3:** lista dos **participantes do evento inteiro** (independente de modalidade), alfabética, com subtítulo.

Após avançar (botão "Iniciar"), segue para a etapa de Modalidades; o restante do fluxo permanece inalterado.

## Contexto

- Máquina de etapas: `frontend/src/types/congresso-step.ts` (`type CongressoStep = 'evento' | 'modalidade' | 'participantes' | 'campeoes' | 'sorteio'`); orquestração em `frontend/src/pages/congresso/ModoCongresso.tsx`; cabeçalho/steps em `frontend/src/pages/congresso/CongressoShell.tsx` (`STEPS` + `STEP_INDEX`).
- Hoje: `CongressoStepEvento.onSelect(id)` → `ModoCongresso` faz `setEventoId(id); setStep('modalidade')`.
- `ModoCongresso` já carrega `evento` (`eventosService.buscar`) e `modalidades` (`eventosService.getModalidadesDoEvento`).
- `handleBack`: `sorteio→participantes`, `participantes→modalidade`, `modalidade→evento (reset eventoId)`.
- Helpers: `esporteBase` (`frontend/src/site-publico/lib/esporte.ts`), `composeSubtituloLine` (`frontend/src/lib/compose-subtitulo.ts`).
- Services: `eventosService.buscar`, `eventosService.getModalidadesDoEvento`, `inscricoesService.listar({ evento_id })`, `competicoesService.buscar`.
- CSS wizard (`frontend/src/styles/congresso-wizard.css`): `.cw-h1`, `.cw-sub`, `.cw-md-stat`, `.cw-plist`, `.cw-prow`/`.cw-prow-n`/`.cw-prow-main`/`.cw-prow-name`/`.cw-prow-club`, `.cw-btn`/`.cw-btn-primary`/`.cw-btn-xl`.

## Mudanças

### 1. `types/congresso-step.ts`
```ts
export type CongressoStep = 'evento' | 'bemvindos' | 'modalidade' | 'participantes' | 'campeoes' | 'sorteio'
```

### 2. `CongressoShell.tsx`
- `STEPS` passa a incluir Bem-vindos no índice 1:
```ts
const STEPS: Array<{ key: CongressoStep; label: string }> = [
  { key: 'evento', label: 'Evento' },
  { key: 'bemvindos', label: 'Bem-vindos' },
  { key: 'modalidade', label: 'Modalidade' },
  { key: 'participantes', label: 'Participantes' },
  { key: 'sorteio', label: 'Sorteio' },
]
```
- `STEP_INDEX`:
```ts
const STEP_INDEX: Record<CongressoStep, number> = {
  evento: 0, bemvindos: 1, modalidade: 2, participantes: 3, campeoes: 4, sorteio: 4,
}
```

### 3. `ModoCongresso.tsx`
- `CongressoStepEvento` onSelect: `(id) => { setEventoId(id); setStep('bemvindos') }`.
- Novo render:
```tsx
{step === 'bemvindos' && eventoId != null && (
  <CongressoStepBemvindos eventoId={eventoId} onIniciar={() => setStep('modalidade')} />
)}
```
- `handleBack`: adicionar `else if (step === 'bemvindos') { setStep('evento'); setEventoId(null) }`. O ramo `modalidade → evento` permanece como está (comportamento inalterado).
- Import do novo componente.

### 4. Novo `frontend/src/pages/congresso/CongressoStepBemvindos.tsx`
Props: `{ eventoId: number; onIniciar: () => void }`.

Queries (react-query):
```ts
const { data: evento } = useQuery({ queryKey: ['eventos', eventoId], queryFn: () => eventosService.buscar(eventoId) })
const { data: modalidades = [] } = useQuery({ queryKey: ['evento-modalidades', eventoId], queryFn: () => eventosService.getModalidadesDoEvento(eventoId) })
const { data: inscricoes = [] } = useQuery({ queryKey: ['inscricoes', eventoId], queryFn: () => inscricoesService.listar({ evento_id: eventoId }) })
const { data: competicao } = useQuery({ queryKey: ['competicoes', evento?.competicao_id], queryFn: () => competicoesService.buscar(evento!.competicao_id), enabled: evento?.competicao_id != null })
```

Derivações:
```ts
const nModalidades = new Set(modalidades.map(m => esporteBase(m.nome))).size
const participantes = [...new Map(inscricoes.map(i => [i.participante_id, i.participante])).values()]
  .sort((a, b) => (a?.nome ?? '').localeCompare(b?.nome ?? '', 'pt-BR', { sensitivity: 'base' }))
const nInscritos = participantes.length
const camposSubtitulo = competicao?.subtitulo_campos ?? []
```

Render:
- **Bloco 1:** se `evento?.logo_url`, exibir `<img src={evento.logo_url} ...>` (caixa com borda, `object-fit: contain`, padrão do card de detalhe da modalidade); caso contrário, omitir o logo. Nome em `<h1 className="cw-h1">{evento?.nome}</h1>` (+ subtítulo opcional cidade/data em `.cw-sub`).
- **Bloco 2:** dois `.cw-md-stat` (dentro de um container flex/`.cw-md-card-stats`): `<b>{nModalidades}</b><span>Modalidades</span>` e `<b>{nInscritos}</b><span>Inscritos</span>`.
- **Bloco 3:** título "Participantes ({nInscritos})" + `<div className="cw-plist">` com uma `.cw-prow` por participante (número, nome `.cw-prow-name`, subtítulo `.cw-prow-club` via `composeSubtituloLine(p, camposSubtitulo)`).
- Botão "Iniciar" (`className="cw-btn cw-btn-primary cw-btn-xl"`) alinhado à direita → `onIniciar()`.

Estados: enquanto carrega, mostrar `.cw-sub` "Carregando..."; sem participantes, mostrar mensagem vazia (padrão das outras etapas). Reaproveitar CSS existente; só adicionar regra nova se necessário para o cabeçalho/logo do bloco 1 (ex.: `.cw-bv-head`).

## Testes / Verificação

- `npm run build` (frontend; `tsc -b && vite build`) sem erros.
- Manual no Modo Congresso: selecionar evento → aparece "Bem-vindos" com logo+nome, big numbers (modalidades distintas e inscritos) e lista de participantes; "Iniciar" → vai para Modalidade; "Voltar" → seleção de evento; etapas seguintes inalteradas.
- Sem teste unitário dedicado (tela de leitura/agregação). Sem backend/migration.

## Fora de escopo

- Endpoint novo no backend (usa services existentes; dedup/contagem no frontend).
- Mudar etapas de Modalidade/Participantes/Sorteio.
- Persistir algo da tela de boas-vindas.
