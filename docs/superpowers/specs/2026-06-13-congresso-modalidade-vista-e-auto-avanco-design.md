# Modo Congresso: marcar modalidade como vista + auto-avanço — Design

**Data:** 2026-06-13
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Melhorar a usabilidade da tela **Modo Congresso**: depois que uma modalidade é apresentada (sorteio para sorteáveis, ou apresentação para tipo **específico**), sinalizá-la como concluída com o mesmo check verde das sorteadas e posicionar a etapa de modalidade na **próxima** ainda não concluída.

## Contexto atual

- `frontend/src/pages/congresso/ModoCongresso.tsx` é a máquina de estados do wizard (`step`, `eventoId`, `modalidadeId`). Fluxo: `evento → modalidade → participantes → (sorteio | volta)`.
- `frontend/src/pages/congresso/CongressoStepModalidade.tsx` lista as modalidades (esquerda) + detalhe (direita). Tem `selectedId` local; ao (re)montar, um `useEffect` auto-seleciona a primeira modalidade **não sorteada**. As sorteadas vêm do backend (`sorteios` → `sorteadasIds`) e são sinalizadas com `cw-md-done` (check verde) na lista e badge `b-success` "Sorteado" no detalhe.
- Tipos **sorteáveis** (chaves/grupos/ordem_entrada): vão para a etapa de sorteio; após sortear, viram "Sorteado" e, ao voltar, o auto-select já pula para a próxima não sorteada (funciona hoje).
- Tipo **específico**: `nextAfterParticipantes` detecta `tipoAtual === 'especifico'` e chama `voltarParaModalidade()` direto (sem sorteio). Como nunca vira "sorteada", hoje o auto-select volta a selecioná-la e ela fica sem sinal — **este é o gap**.
- Não existe hoje nenhum estado de "vista/apresentada". Estado do congresso vive só em React (perde no refresh); sorteadas persistem no backend.

## Decisões (do brainstorming)

- A marca "vista/apresentada" **persiste em localStorage por evento** (sobrevive a refresh durante o congresso; sem migration/backend).
- O sinal na lista é o **mesmo check verde** das sorteadas (visual unificado de "concluída"). No detalhe, o badge diz **"Apresentada"** (não-sorteada) vs **"Sorteado"** (sorteada).

## Persistência — helper novo

`frontend/src/lib/congresso-vistas.ts`:

```ts
const KEY = (eventoId: number) => `prosports.congresso.vistas.${eventoId}`

export function addVista(ids: number[], modalidadeId: number): number[] {
  return ids.includes(modalidadeId) ? ids : [...ids, modalidadeId]
}

export function loadVistas(eventoId: number): number[] {
  try {
    const raw = localStorage.getItem(KEY(eventoId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : []
  } catch { return [] }
}

export function saveVistas(eventoId: number, ids: number[]): void {
  try { localStorage.setItem(KEY(eventoId), JSON.stringify(ids)) } catch { /* ignora */ }
}
```

- `addVista` é pura e dedupe (testável).
- `loadVistas`/`saveVistas` toleram storage indisponível e JSON inválido (retornam `[]` / no-op).

## Estado e marcação — `ModoCongresso.tsx`

- Novo estado `const [vistas, setVistas] = useState<number[]>([])`.
- Carregar quando o evento muda: `useEffect(() => { if (eventoId != null) setVistas(loadVistas(eventoId)) }, [eventoId])`.
- `vistasIds = new Set(vistas)` (memo) passado como prop a `CongressoStepModalidade`.
- **Quando marcar:** em `nextAfterParticipantes`, no ramo de `especifico`, antes de `voltarParaModalidade()`:
  ```ts
  if (modalidadeId != null) {
    const next = addVista(vistas, modalidadeId)
    setVistas(next)
    saveVistas(eventoId!, next)
  }
  ```
  Apenas para `especifico`. Tipos sorteáveis **não** são marcados como vista (o sinal deles é a sorteada; isso evita marcar como concluída uma modalidade cujo sorteio foi pulado via `pularSorteio`).
- A "apresentação" do específico é a própria etapa de participantes; concluí-la = clicar **Próximo** lá (que aciona `nextAfterParticipantes`).

## Sinal + auto-avanço — `CongressoStepModalidade.tsx`

- Nova prop `vistasIds: Set<number>` (default vazio).
- `concluida(id) = sorteadasIds.has(id) || vistasIds.has(id)`.
- **Lista:** mostrar `cw-md-done` (check verde) quando `concluida(m.id)` (hoje é só `sorteada`).
- **Detalhe:** badge verde `b-success` — texto **"Sorteado"** se `sorteadasIds.has(id)`, senão **"Apresentada"** se `vistasIds.has(id)`.
- **Contador** do subtítulo (`restantes`) passa a contar as **não concluídas**.
- **Auto-posição:** o `useEffect` de auto-select passa a escolher a primeira modalidade **não concluída** (`!sorteadasIds.has ∧ !vistasIds.has`), com fallback para `modalidades[0]`. Assim, após apresentar uma específico e voltar, a etapa já abre na próxima.
- **Visibilidade:** garantir que o item selecionado fique visível na lista (um `scrollIntoView({ block: 'nearest' })` no botão selecionado quando `selectedId` muda).

## Tratamento de erros / casos

- localStorage indisponível/corrompido → tratado como vazio (sem quebrar).
- Todas concluídas → auto-select cai no fallback `modalidades[0]`; subtítulo mostra "todas concluídas".
- Reapresentar uma específico já vista (clicando nela de novo): funciona normalmente; permanece marcada (idempotente via `addVista`).
- Sorteáveis: comportamento inalterado (sorteada continua sendo o sinal e o critério de avanço).

## Testes

- **Frontend (Vitest, função pura):** `addVista` — adiciona novo id; idempotente (não duplica); preserva ordem.
- **Build + manual:** `npm run build`; manual no Modo Congresso (apresentar uma específico → check verde na lista + badge "Apresentada" no detalhe + a etapa pula para a próxima não concluída; refresh mantém as vistas; sorteáveis seguem como hoje).
- Sem backend/migration.

## Fora de escopo

- Persistir "vista" no backend (decisão foi localStorage por evento).
- Desmarcar/limpar "vistas" via UI (idempotente; recomeçar = limpar storage manualmente — fora de escopo).
- Mudar o fluxo de etapas ou o sinal das sorteáveis.
