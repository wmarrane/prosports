# Site público: regras de "específico" e mínimo de inscritos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o site público (SSG por snapshot) aplicar as mesmas regras do admin: modalidades `especifico` não mostram "Aguardando sorteio" e modalidades abaixo do mínimo mostram a mensagem configurada + "sem sorteio".

**Architecture:** O snapshot passa a carregar `mensagens_inscritos` por modalidade (backend: select + builder + tipos). O render do site público (`ModalidadeSorteio` e a linha-resumo de `EventoPage`) usa `matchMensagem` para decidir o texto. Sem migration — campo JSON já existe no modelo Prisma. Efeito ao vivo exige re-publicar o evento.

**Tech Stack:** Backend Node/TS (Vitest), Prisma; Frontend React 18/Vite/TS (build `tsc -b && vite build`).

**Spec:** `docs/superpowers/specs/2026-06-14-site-publico-regras-especifico-e-minimo-design.md`

---

### Task 1: Backend — propagar `mensagens_inscritos` no snapshot

**Files:**
- Modify: `backend/src/modules/site-publico/snapshot-types.ts`
- Modify: `backend/src/modules/site-publico/snapshot.ts`
- Modify: `backend/src/modules/site-publico/site-publico.service.ts:27`
- Test: `backend/src/modules/site-publico/snapshot.test.ts`

- [ ] **Step 1: Adicionar o campo ao tipo `SnapModalidade`**

Em `backend/src/modules/site-publico/snapshot-types.ts`, dentro de `SnapModalidade`, adicionar `mensagens_inscritos` após `resultado`:

```ts
export type SnapModalidade = {
  id: number; nome: string; grupo: string | null
  tipo: 'grupos' | 'chaves' | 'ordem_entrada' | 'especifico'
  status: 'sorteado' | 'aguardando'
  seed: string | null; anfitriaoId: number | null
  participantes: SnapParticipante[]; campeoes: SnapCampeao[]
  cabecasPids: number[]; resultado: unknown | null
  mensagens_inscritos: { min: number; max: number | null; mensagem: string; pular_sorteio: boolean }[]
}
```

- [ ] **Step 2: Escrever o teste que falha**

Em `backend/src/modules/site-publico/snapshot.test.ts`, adicionar ao final do arquivo:

```ts
it('propaga mensagens_inscritos da modalidade para o snapshot', () => {
  const regras = [{ min: 0, max: 3, mensagem: 'Mínimo não atingido', pular_sorteio: true }]
  const snap = montaSnapshot({
    evento: baseEvento as any,
    modalidades: [{ id: 4, nome: 'Xadrez', tipo_modalidade: { tipo: 'chaves' }, mensagens_inscritos: regras } as any],
    inscricoesPorModalidade: new Map([[4, [
      { participante: { id: 1, nome: 'A', subtitulo: null } },
    ]]]) as any,
    campeoesPorModalidade: new Map() as any,
    sorteiosPorModalidade: new Map() as any,
    subtituloFn: () => null,
  })
  expect(snap.modalidades[0].mensagens_inscritos).toEqual(regras)
})

it('usa [] quando mensagens_inscritos é null/ausente', () => {
  const snap = montaSnapshot({
    evento: baseEvento as any,
    modalidades: [{ id: 5, nome: 'Dama', tipo_modalidade: { tipo: 'chaves' }, mensagens_inscritos: null } as any],
    inscricoesPorModalidade: new Map([[5, []]]) as any,
    campeoesPorModalidade: new Map() as any,
    sorteiosPorModalidade: new Map() as any,
    subtituloFn: () => null,
  })
  expect(snap.modalidades[0].mensagens_inscritos).toEqual([])
})
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `cd backend && npx vitest run src/modules/site-publico/snapshot.test.ts`
Expected: FAIL — `mensagens_inscritos` é `undefined` (campo não montado ainda).

- [ ] **Step 4: Adicionar o campo a `ModalidadeRow` e ao objeto retornado**

Em `backend/src/modules/site-publico/snapshot.ts`:

Linha 12 — trocar:
```ts
type ModalidadeRow = { id: number; nome: string; tipo_modalidade: { tipo: string } }
```
Por:
```ts
type ModalidadeRow = { id: number; nome: string; tipo_modalidade: { tipo: string }; mensagens_inscritos: unknown }
```

No objeto retornado de `montaSnapshot` (após a linha `resultado: sorteio?.resultado ?? null,`), adicionar:
```ts
      mensagens_inscritos: Array.isArray(mod.mensagens_inscritos)
        ? (mod.mensagens_inscritos as SnapModalidade['mensagens_inscritos'])
        : [],
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `cd backend && npx vitest run src/modules/site-publico/snapshot.test.ts`
Expected: PASS (todos os testes do arquivo).

- [ ] **Step 6: Incluir `mensagens_inscritos` no select do serviço**

Em `backend/src/modules/site-publico/site-publico.service.ts`, linha 27 — trocar:
```ts
    select: { id: true, nome: true, tipo_modalidade: { select: { tipo: true } } },
```
Por:
```ts
    select: { id: true, nome: true, tipo_modalidade: { select: { tipo: true } }, mensagens_inscritos: true },
```

- [ ] **Step 7: Build do backend**

Run: `cd backend && npm run build`
Expected: sem erros de TypeScript.

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/site-publico/snapshot-types.ts backend/src/modules/site-publico/snapshot.ts backend/src/modules/site-publico/site-publico.service.ts backend/src/modules/site-publico/snapshot.test.ts
git commit -m "feat(site-publico): inclui mensagens_inscritos no snapshot"
```

---

### Task 2: Frontend — tipo `SnapModalidade` com `mensagens_inscritos`

**Files:**
- Modify: `frontend/src/site-publico/snapshot-types.ts`

- [ ] **Step 1: Importar o tipo e adicionar o campo**

Em `frontend/src/site-publico/snapshot-types.ts`, no topo do arquivo adicionar o import e, em `SnapModalidade`, o campo `mensagens_inscritos` após `resultado`:

```ts
import type { MensagemInscritos } from '../../lib/mensagens-inscritos'

export type SnapParticipante = { id: number; nome: string; subtitulo: string | null }
export type SnapCampeao = { participanteId: number; posicao: number }

export type SnapModalidade = {
  id: number
  nome: string
  grupo: string | null
  tipo: 'grupos' | 'chaves' | 'ordem_entrada' | 'especifico'
  status: 'sorteado' | 'aguardando'
  seed: string | null
  anfitriaoId: number | null
  participantes: SnapParticipante[]
  campeoes: SnapCampeao[]
  cabecasPids: number[]
  resultado: unknown | null
  mensagens_inscritos: MensagemInscritos[]
}
```

(`SnapEvento` permanece inalterado.)

- [ ] **Step 2: Build do frontend (deve falhar nos consumidores)**

Run: `cd frontend && npm run build`
Expected: pode passar (campo apenas adicionado). Se passar, seguir. Os consumidores que usam o campo serão adicionados nas Tasks 3 e 4.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/site-publico/snapshot-types.ts
git commit -m "feat(site-publico): adiciona mensagens_inscritos ao SnapModalidade do frontend"
```

---

### Task 3: Frontend — corpo do card (`ModalidadeSorteio.tsx`)

**Files:**
- Modify: `frontend/src/site-publico/components/ModalidadeSorteio.tsx`

- [ ] **Step 1: Importar `matchMensagem`**

Em `frontend/src/site-publico/components/ModalidadeSorteio.tsx`, adicionar após os imports existentes (após a linha 5):

```ts
import { matchMensagem } from '../../lib/mensagens-inscritos'
```

- [ ] **Step 2: Substituir o guard de "Aguardando sorteio" pelos 3 ramos**

Trocar o bloco atual (linhas 19-21):
```ts
  if (modalidade.status !== 'sorteado' || !modalidade.resultado) {
    return <div style={{ padding: 16, color: 'var(--t3)', fontStyle: 'italic' }}>Aguardando sorteio</div>
  }
```
Por:
```ts
  if (modalidade.tipo === 'especifico') {
    return <div style={{ padding: 16, color: 'var(--t3)', fontStyle: 'italic' }}>Modalidade específica — não possui sorteio.</div>
  }
  if (modalidade.status !== 'sorteado' || !modalidade.resultado) {
    const regra = matchMensagem(modalidade.mensagens_inscritos ?? [], modalidade.participantes.length)
    return (
      <div style={{ padding: 16, color: 'var(--t3)', fontStyle: 'italic' }}>
        {regra?.mensagem && <p style={{ margin: '0 0 8px' }}>{regra.mensagem}</p>}
        {regra?.pular_sorteio ? 'Não vai a sorteio (regra de inscritos).' : 'Aguardando sorteio'}
      </div>
    )
  }
```

- [ ] **Step 3: Remover o ramo final inalcançável de "específico"**

Como `especifico` agora é tratado no topo, o `return` final (linha 62) ficou inalcançável. Remover:
```ts
  return <div style={{ padding: 16, color: 'var(--t3)' }}>Emparceiramento específico</div>
```

Verificar que a função termina nos três `if` por tipo (`grupos`, `chaves`, `ordem_entrada`). Como TS exige um retorno em todos os caminhos e os três tipos restantes são exaustivos para uma modalidade não-`especifico` já sorteada, adicionar um retorno de segurança no final do componente:
```ts
  return null
```

- [ ] **Step 4: Build do frontend**

Run: `cd frontend && npm run build`
Expected: sem erros de TypeScript.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/site-publico/components/ModalidadeSorteio.tsx
git commit -m "feat(site-publico): card aplica regra de especifico e minimo de inscritos"
```

---

### Task 4: Frontend — linha-resumo (`EventoPage.tsx`)

**Files:**
- Modify: `frontend/src/site-publico/pages/EventoPage.tsx`

- [ ] **Step 1: Importar `matchMensagem`**

Em `frontend/src/site-publico/pages/EventoPage.tsx`, adicionar após os imports existentes (após a linha 3):

```ts
import { matchMensagem } from '../../lib/mensagens-inscritos'
```

- [ ] **Step 2: Adicionar a função `statusLabel`**

Logo após a função `categoriaDe` (após a linha 9), adicionar:

```ts
function statusLabel(m: SnapModalidade): string {
  if (m.tipo === 'especifico') return 'específico'
  if (m.status === 'sorteado') return 'sorteado'
  const regra = matchMensagem(m.mensagens_inscritos ?? [], m.participantes.length)
  return regra?.pular_sorteio ? 'sem sorteio' : 'aguardando'
}
```

- [ ] **Step 3: Usar `statusLabel` na linha-resumo**

Trocar (linha 32):
```ts
                  <span className="mod-meta">{m.tipo} · {m.participantes.length} inscritos · {m.status}</span>
```
Por:
```ts
                  <span className="mod-meta">{m.tipo} · {m.participantes.length} inscritos · {statusLabel(m)}</span>
```

- [ ] **Step 4: Build do frontend**

Run: `cd frontend && npm run build`
Expected: sem erros de TypeScript.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/site-publico/pages/EventoPage.tsx
git commit -m "feat(site-publico): linha-resumo mostra status de especifico e sem sorteio"
```

---

## Notas de verificação manual (pós-implementação)

- Re-publicar um evento que tenha (a) uma modalidade `especifico` e (b) uma modalidade sorteável abaixo do mínimo com `pular_sorteio`.
- Confirmar na página pública: específico → "Modalidade específica — não possui sorteio." e linha-resumo `... · específico`; abaixo do mínimo → mensagem da regra + "Não vai a sorteio (regra de inscritos)." e linha-resumo `... · sem sorteio`.
- Snapshots antigos (sem o campo) degradam para "aguardando" até re-publicação — esperado.
