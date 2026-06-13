# Pular modalidade sem inscritos (botão "Iniciar"→"Próxima") — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No Modo Congresso, quando a modalidade selecionada tem zero inscritos, o botão "Iniciar" vira "Próxima"; ao clicar, marca a modalidade como apresentada (vista) e avança para a próxima não concluída.

**Architecture:** Frontend-only, 2 arquivos. `CongressoStepModalidade` detecta `vazia` (0 inscritos, fora de loading) e troca rótulo/ação do botão; ao pular, chama um novo callback `onPularVazia` e avança a seleção local. `ModoCongresso` implementa `onPularVazia` reusando `addVista`/`saveVistas`.

**Tech Stack:** React 18, TypeScript, Vite.

**Validação obrigatória:** `npm run build` (`tsc -b && vite build`) + `npm run test` (regressão) em `C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend`. Estas telas não têm teste unitário (convenção do repo).

**Spec:** `docs/superpowers/specs/2026-06-13-congresso-pular-modalidade-sem-inscritos-design.md`

**Git:** identidade NÃO configurada — commitar inline (NÃO rodar `git config`): `git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit ...`. Não pular hooks.

---

## File Structure

- **Modify** `frontend/src/pages/congresso/CongressoStepModalidade.tsx` — `onPularVazia` prop, `vazia`, `pularVazia`, botão condicional.
- **Modify** `frontend/src/pages/congresso/ModoCongresso.tsx` — handler `pularModalidadeVazia` + passar a prop.

---

## Task 1: Pular modalidade sem inscritos

**Files:**
- Modify: `frontend/src/pages/congresso/CongressoStepModalidade.tsx`
- Modify: `frontend/src/pages/congresso/ModoCongresso.tsx`

- [ ] **Step 1: Props — adicionar `onPularVazia`**

Em `CongressoStepModalidade.tsx`, trocar o tipo `Props`:
```ts
type Props = {
  eventoId: number
  onSelect: (modalidadeId: number) => void
  vistasIds?: Set<number>
}
```
Por:
```ts
type Props = {
  eventoId: number
  onSelect: (modalidadeId: number) => void
  vistasIds?: Set<number>
  onPularVazia?: (modalidadeId: number) => void
}
```

E a assinatura do componente:
```tsx
export default function CongressoStepModalidade({ eventoId, onSelect, vistasIds = EMPTY_IDS }: Props) {
```
Por:
```tsx
export default function CongressoStepModalidade({ eventoId, onSelect, vistasIds = EMPTY_IDS, onPularVazia }: Props) {
```

- [ ] **Step 2: Expor loading da query de inscritos e derivar `vazia` + `pularVazia`**

Trocar a query `inscricoesSel`:
```tsx
  const { data: inscricoesSel = [] } = useQuery({
    queryKey: ['inscricoes', eventoId, selectedId],
    queryFn: () => inscricoesService.listar({ evento_id: eventoId, modalidade_id: selectedId! }),
    enabled: selectedId != null,
  })
```
Por:
```tsx
  const { data: inscricoesSel = [], isLoading: inscricoesLoading } = useQuery({
    queryKey: ['inscricoes', eventoId, selectedId],
    queryFn: () => inscricoesService.listar({ evento_id: eventoId, modalidade_id: selectedId! }),
    enabled: selectedId != null,
  })

  const vazia = !inscricoesLoading && selectedMod != null && inscricoesSel.length === 0

  function pularVazia() {
    if (!selectedMod) return
    onPularVazia?.(selectedMod.id)
    const idx = modalidades.findIndex(m => m.id === selectedMod.id)
    const after = modalidades.slice(idx + 1).find(m => !isConcluida(m.id))
    const before = modalidades.slice(0, idx).find(m => !isConcluida(m.id))
    const proxima = after ?? before
    setSelectedId(proxima ? proxima.id : selectedMod.id)
  }
```

(`selectedMod`, `modalidades`, `isConcluida`, `setSelectedId` já existem no componente. A atual é excluída do alvo via `slice` em torno do seu índice.)

- [ ] **Step 3: Botão de ação condicional (Iniciar/Próxima)**

Trocar o botão do detalhe:
```tsx
                  <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => onSelect(selectedMod.id)}
                      className="cw-btn cw-btn-primary cw-btn-xl"
                    >
                      Iniciar <ArrowRight size={22} />
                    </button>
                  </div>
```
Por:
```tsx
                  <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => (vazia ? pularVazia() : onSelect(selectedMod.id))}
                      className="cw-btn cw-btn-primary cw-btn-xl"
                    >
                      {vazia ? 'Próxima' : 'Iniciar'} <ArrowRight size={22} />
                    </button>
                  </div>
```

- [ ] **Step 4: `ModoCongresso` — handler + passar a prop**

Em `frontend/src/pages/congresso/ModoCongresso.tsx`, adicionar a função logo após `nextAfterParticipantes` (antes do `const contexto = ...`):
```ts
  function pularModalidadeVazia(id: number) {
    if (eventoId == null) return
    const next = addVista(vistas, id)
    setVistas(next)
    saveVistas(eventoId, next)
  }
```

E passar a prop na renderização da etapa de modalidade. Trocar:
```tsx
      {step === 'modalidade' && eventoId != null && (
        <CongressoStepModalidade
          eventoId={eventoId}
          onSelect={(id) => { setModalidadeId(id); setStep('participantes') }}
          vistasIds={vistasIds}
        />
      )}
```
Por:
```tsx
      {step === 'modalidade' && eventoId != null && (
        <CongressoStepModalidade
          eventoId={eventoId}
          onSelect={(id) => { setModalidadeId(id); setStep('participantes') }}
          vistasIds={vistasIds}
          onPularVazia={pularModalidadeVazia}
        />
      )}
```

(`addVista`/`saveVistas` já estão importados em `ModoCongresso.tsx`.)

- [ ] **Step 5: Build + testes**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend" && npm run build`
Expected: PASS (`tsc -b && vite build`, sem erros).

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend" && npm run test`
Expected: PASS (suíte inteira — sem regressão).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/congresso/CongressoStepModalidade.tsx frontend/src/pages/congresso/ModoCongresso.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(congresso): pular modalidade sem inscritos pelo botao (marca vista + avanca)"
```

---

## Manual Test Checklist

`npm run dev` → Modo Congresso (`/congresso`) → escolher um evento que tenha uma modalidade **sem inscritos** e outra **com inscritos**:

- Selecionar a modalidade sem inscritos → o detalhe mostra "0" em Inscritos e o botão aparece como **"Próxima"**.
- Clicar "Próxima" → a modalidade ganha o **check verde** (apresentada) e a seleção avança para a próxima não concluída.
- Selecionar uma modalidade com inscritos → botão segue **"Iniciar"** e entra no fluxo normal (participantes).
- Reabrir a etapa → a modalidade pulada continua marcada (persistido). "Reiniciar evento" limpa.

---

## Self-Review

**1. Spec coverage:**
- Botão "Próxima" quando 0 inscritos; "Iniciar" caso contrário → Step 3. ✓
- Pular marca apresentada (vista, persistida) → Step 4 (`pularModalidadeVazia` via `addVista`/`saveVistas`). ✓
- Avança para a próxima não concluída → Step 2 (`pularVazia`). ✓
- `vazia` ignora estado de loading dos inscritos → Step 2 (`!inscricoesLoading`). ✓
- Sem outras não concluídas → permanece na atual → Step 2 (`proxima ? ... : selectedMod.id`). ✓

**2. Placeholder scan:** Sem TBD/TODO; blocos completos. ✓

**3. Type consistency:** `onPularVazia?: (modalidadeId: number) => void` definido na Props e passado como `pularModalidadeVazia(id: number)` em `ModoCongresso`. `vazia: boolean`, `pularVazia(): void`. `addVista`/`saveVistas` já importados. ✓
