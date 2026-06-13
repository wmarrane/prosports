# Melhorias: sino com mensagens lidas + bloco "Sorteados" recolhível — Design

**Data:** 2026-06-13
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Duas melhorias pequenas e independentes, **somente frontend**:

1. **Sino de notificações:** permitir marcar mensagens como **lidas** para reduzir o acúmulo no badge. Mensagem lida sai da lista de "Novas" e vai para uma aba "Lidas" (que mantém apenas as últimas 10).
2. **Lista de eventos:** transformar a seção **"Sorteados"** em um bloco **expandir/recolher**, **recolhido por padrão**.

## Contexto atual

- `frontend/src/components/NotificationBell.tsx`: os alertas são **derivados** (não armazenados) a cada render via `deriveEventoAlerts(eventos)` + `deriveSemRegraAlerts(...)`. O badge mostra `alertas.length`. O dropdown renderiza cada alerta como botão que navega (`goTo(a.to)`).
- `frontend/src/lib/alertas.ts`: `type Alerta = { id, tipo, titulo, descricao, to }`; ids estáveis (`evt-{id}-{status}`, `semregra-{ev}-{mod}`).
- `frontend/src/pages/eventos/EventosList.tsx`: já separa `demais`/`sorteados` e tem `renderGrupos(grupos)`. A seção "Sorteados" hoje renderiza sempre aberta. Já existe padrão de recolher por competição (`recolhidas`/`toggleGrupo` + sessionStorage).

## Melhoria 1 — Sino com mensagens lidas

### Persistência das lidas

- Como os alertas são derivados (sem id de banco), as **lidas** precisam ser persistidas para sobreviver a re-renders e reloads. Usar `localStorage` (chave `prosports.notif.lidas`).
- Cada lida guarda um **snapshot** do alerta: `{ id, tipo, titulo, descricao, to, lidaEm }` (ISO string em `lidaEm`). Guardar o snapshot (e não só o id) porque o alerta pode deixar de ser derivado depois (ex.: status do evento mudou) e ainda assim queremos exibi-lo na aba "Lidas".

### Helper puro — `frontend/src/lib/alertas-lidas.ts`

```ts
import type { Alerta } from './alertas';

export type AlertaLido = Alerta & { lidaEm: string };

const KEY = 'prosports.notif.lidas';
const CAP = 10;

export function aplicarLida(lidas: AlertaLido[], alerta: Alerta, agora?: Date): AlertaLido[] {
  const lidaEm = (agora ?? new Date()).toISOString();
  const semDuplicata = lidas.filter((l) => l.id !== alerta.id);
  return [{ ...alerta, lidaEm }, ...semDuplicata].slice(0, CAP);
}

export function carregarLidas(): AlertaLido[] { /* lê localStorage, tolera JSON inválido → [] */ }
export function salvarLidas(lidas: AlertaLido[]): void { /* grava localStorage */ }
```

Regras de `aplicarLida`: **dedupe por id** (uma lida re-marcada vai pro topo, sem duplicar) e **cap nas últimas 10** (mais recente primeiro).

### Componente `NotificationBell`

- Estado `lidas: AlertaLido[]` inicializado de `carregarLidas()`; toda alteração chama `salvarLidas`.
- Conjunto de ids lidos: `lidasIds = new Set(lidas.map(l => l.id))`.
- **Novas** = `alertas.filter(a => !lidasIds.has(a.id))`. **Lidas** = `lidas` (já capadas em 10).
- **Badge** = `novas.length` (some quando tudo lido).
- **Duas abas** no dropdown: "Novas (N)" e "Lidas". Aba ativa em estado local (default "Novas").
- Clicar uma **Nova**: `setLidas(aplicarLida(lidas, a))` e em seguida `goTo(a.to)`.
- Botão **"Marcar todas como lidas"** (visível na aba Novas quando há novas): aplica `aplicarLida` em sequência para todas as novas e fecha/atualiza.
- Clicar uma **Lida**: apenas `goTo(l.to)` (não re-ordena nem altera estado).
- Aba "Novas" vazia → "Nenhuma mensagem nova." Aba "Lidas" vazia → "Nenhuma mensagem lida."

## Melhoria 2 — Bloco "Sorteados" recolhível

Em `frontend/src/pages/eventos/EventosList.tsx`:

- A seção "Sorteados" passa a ter um **cabeçalho clicável** (chevron + texto "Sorteados (N)"), no mesmo estilo visual do recolhimento por competição já existente.
- **Recolhido por padrão.** A preferência (aberto/recolhido) é lembrada em `sessionStorage` (chave própria, ex.: `prosports.eventos.sorteadosAberto`).
- Quando expandido, renderiza `renderGrupos(gruposSorteados)` (agrupamento por competição inalterado). Quando recolhido, mostra só o cabeçalho com a contagem.
- Mantida a regra de não renderizar a seção quando `sorteados.length === 0` (sem cabeçalho órfão).

## Tratamento de erros / casos

- `localStorage`/`sessionStorage` indisponível ou JSON corrompido → tratar como vazio (try/catch), sem quebrar o sino/lista.
- Alerta marcado como lido que **deixou de ser derivado** continua aparecendo na aba "Lidas" (snapshot), até ser empurrado para fora do cap de 10.
- Alerta lido que **ainda é derivado**: não aparece em "Novas" (filtrado por id); aparece em "Lidas".

## Testes

- **Frontend (Vitest, função pura):** `aplicarLida` — adiciona no topo; dedupe por id (re-marcar não duplica e sobe ao topo); cap em 10 (11º empurra o mais antigo); `lidaEm` preenchido.
- **Build + manual:** `npm run build`; manual (marcar uma e todas como lidas → badge cai; aba Lidas mostra até 10; reload preserva lidas; bloco Sorteados começa recolhido e lembra a preferência na sessão).
- Sem backend/migration.

## Fora de escopo

- Sincronizar lidas entre dispositivos/usuários (é local ao navegador).
- Notificações push ou novos tipos de alerta.
- Recolher também a seção "Em andamento"/demais (só "Sorteados").
- Histórico de lidas além das últimas 10.
