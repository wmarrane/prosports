# Mensagens personalizadas por modalidade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configurar no cadastro de modalidades (Grupo/Chaves) mensagens por faixa de nº de inscritos, exibidas na tela Inscritos do Modo Congresso (caixa alta/negrito/grande) e que podem fazer "Próxima" pular o sorteio e voltar para Modalidade.

**Architecture:** Coluna JSON `mensagens_inscritos` em `Modalidade` (lista de `{min,max|null,mensagem,pular_sorteio}`); função pura `matchMensagem` (primeira faixa que casa). Cadastro ganha editor de lista (só Grupo/Chaves); o Modo Congresso exibe a mensagem e, conforme `pular_sorteio`, redireciona a navegação.

**Tech Stack:** Backend Node/Express/Prisma/PostgreSQL/Vitest; Frontend React 18/Vite/Vitest. Spec: `docs/superpowers/specs/2026-06-08-mensagens-inscritos-design.md`.

---

## File Structure

- `frontend/src/lib/mensagens-inscritos.ts` — tipo `MensagemInscritos` + `matchMensagem` (puro).
- `frontend/src/lib/mensagens-inscritos.test.ts` — testes.
- `backend/prisma/schema.prisma` — coluna `mensagens_inscritos Json @default("[]")`.
- `backend/prisma/migrations/<ts>_add_mensagens_inscritos_modalidade/migration.sql` — migration manual.
- `backend/src/modules/modalidades/modalidades.controller.ts` — zod aceita `mensagens_inscritos`.
- `backend/src/modules/modalidades/modalidades.service.ts` — tipos de criar/editar.
- `backend/src/modules/modalidades/modalidades.service.test.ts` — teste.
- `frontend/src/types/modalidade.ts` + `frontend/src/services/modalidades.ts` — campo no tipo/payload.
- `frontend/src/pages/modalidades/ModalidadeForm.tsx` — editor (só Grupo/Chaves).
- `frontend/src/pages/congresso/CongressoStepParticipantes.tsx` + `frontend/src/pages/congresso/ModoCongresso.tsx` — exibição + navegação.

---

## Task 1: `matchMensagem` (lógica pura)

**Files:**
- Create: `frontend/src/lib/mensagens-inscritos.ts`
- Test: `frontend/src/lib/mensagens-inscritos.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `frontend/src/lib/mensagens-inscritos.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { matchMensagem, type MensagemInscritos } from './mensagens-inscritos'

const r = (min: number, max: number | null, mensagem: string, pular = false): MensagemInscritos => ({ min, max, mensagem, pular_sorteio: pular })

describe('matchMensagem', () => {
  it('primeira regra que casa vence', () => {
    const regras = [r(1, 5, 'A'), r(3, 5, 'B')]
    expect(matchMensagem(regras, 4)?.mensagem).toBe('A')
  })

  it('max nulo casa para qualquer n >= min', () => {
    expect(matchMensagem([r(6, null, 'seis+')], 99)?.mensagem).toBe('seis+')
    expect(matchMensagem([r(6, null, 'seis+')], 5)).toBeNull()
  })

  it('valor único (min===max)', () => {
    const regras = [r(2, 2, 'dois')]
    expect(matchMensagem(regras, 2)?.mensagem).toBe('dois')
    expect(matchMensagem(regras, 3)).toBeNull()
  })

  it('limites inclusivos', () => {
    const regras = [r(3, 5, 'tres-cinco')]
    expect(matchMensagem(regras, 3)?.mensagem).toBe('tres-cinco')
    expect(matchMensagem(regras, 5)?.mensagem).toBe('tres-cinco')
    expect(matchMensagem(regras, 6)).toBeNull()
  })

  it('nenhum match retorna null', () => {
    expect(matchMensagem([], 4)).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `cd frontend && npx vitest run src/lib/mensagens-inscritos.test.ts`
Expected: FAIL — módulo/função não existe.

- [ ] **Step 3: Implementar**

Criar `frontend/src/lib/mensagens-inscritos.ts`:

```ts
export type MensagemInscritos = {
  min: number
  max: number | null
  mensagem: string
  pular_sorteio: boolean
}

export function matchMensagem(regras: MensagemInscritos[], n: number): MensagemInscritos | null {
  for (const r of regras) {
    if (n >= r.min && (r.max == null || n <= r.max)) return r
  }
  return null
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/lib/mensagens-inscritos.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/mensagens-inscritos.ts frontend/src/lib/mensagens-inscritos.test.ts
git commit -m "feat(mensagens): matchMensagem (faixa de inscritos -> mensagem)"
```

---

## Task 2: Backend — coluna + migration + API

**Files:**
- Modify: `backend/prisma/schema.prisma` (model `Modalidade`)
- Create: `backend/prisma/migrations/20260608220000_add_mensagens_inscritos_modalidade/migration.sql`
- Modify: `backend/src/modules/modalidades/modalidades.controller.ts`
- Modify: `backend/src/modules/modalidades/modalidades.service.ts`
- Test: `backend/src/modules/modalidades/modalidades.service.test.ts`

- [ ] **Step 1: Adicionar o campo ao schema**

Em `backend/prisma/schema.prisma`, no model `Modalidade`, após a linha `chave_versao        String          @default("V1")` adicionar:

```prisma
  mensagens_inscritos Json            @default("[]")
```

- [ ] **Step 2: Criar a migration manualmente**

Criar `backend/prisma/migrations/20260608220000_add_mensagens_inscritos_modalidade/migration.sql` com:

```sql
-- AlterTable
ALTER TABLE "Modalidade" ADD COLUMN "mensagens_inscritos" JSONB NOT NULL DEFAULT '[]';
```

(Não rodar `prisma migrate dev` — o `DATABASE_URL` aponta para o banco de dev compartilhado; o deploy aplica via `migrate deploy`. Ver memória de migrations.)

- [ ] **Step 3: Regenerar o Prisma Client (offline)**

Run: `cd backend && npx prisma generate`
Expected: "Generated Prisma Client" (sem conectar no banco).

- [ ] **Step 4: Escrever o teste que falha (service)**

Adicionar dentro do `describe('modalidades.service', ...)` em `backend/src/modules/modalidades/modalidades.service.test.ts`, após o teste `criar repassa chave_versao para prisma.create`:

```ts
  it('criar repassa mensagens_inscritos para prisma.create', async () => {
    const regras = [{ min: 2, max: 2, mensagem: 'Final direta', pular_sorteio: true }]
    const data = { nome: 'Judo', sigla: 'JUD', competicao_id: 1, tipo_modalidade_id: 2, mensagens_inscritos: regras }
    mockPrisma.modalidade.create.mockResolvedValue({ id: 1, ...data })
    await service.criar(data)
    expect(mockPrisma.modalidade.create).toHaveBeenCalledWith({ data, include: INCLUDE })
  })

  it('editar repassa mensagens_inscritos para prisma.update', async () => {
    const regras = [{ min: 1, max: null, mensagem: 'Sem disputa', pular_sorteio: true }]
    mockPrisma.modalidade.update.mockResolvedValue({ id: 1 })
    await service.editar(1, { mensagens_inscritos: regras })
    expect(mockPrisma.modalidade.update).toHaveBeenCalledWith({
      where: { id: 1 }, data: { mensagens_inscritos: regras }, include: INCLUDE,
    })
  })
```

- [ ] **Step 5: Rodar e confirmar falha (compilação do teste)**

Run: `cd backend && npx vitest run src/modules/modalidades/modalidades.service.test.ts`
Expected: FAIL de tipo — `mensagens_inscritos` não existe nos parâmetros de `criar`/`editar`. (Obs.: Vitest é transpile-only; se não falhar em runtime, ainda assim aplique os passos 6-7.)

- [ ] **Step 6: Atualizar os tipos do service**

Em `backend/src/modules/modalidades/modalidades.service.ts`, nas assinaturas de `criar` e `editar`, adicionar `mensagens_inscritos`:

```ts
export async function criar(data: {
  nome: string
  sigla: string
  competicao_id: number
  tipo_modalidade_id: number
  chave_versao?: string
  mensagens_inscritos?: unknown
}) {
  return mapPrismaError(() => prisma.modalidade.create({ data: data as any, include: INCLUDE }))
}

export async function editar(
  id: number,
  data: Partial<{ nome: string; sigla: string; competicao_id: number; tipo_modalidade_id: number; chave_versao: string; mensagens_inscritos: unknown }>
) {
```

(O corpo não muda; `data` segue repassado a `prisma.modalidade.create/update`. O `as any` no create cobre o tipo `Json` do Prisma para o campo `unknown`.)

- [ ] **Step 7: Atualizar a validação zod no controller**

Em `backend/src/modules/modalidades/modalidades.controller.ts`, no `createSchema`, adicionar:

```ts
  mensagens_inscritos: z.array(z.object({
    min: z.number().int().min(1),
    max: z.number().int().min(1).nullable(),
    mensagem: z.string(),
    pular_sorteio: z.boolean(),
  })).optional(),
```

(`updateSchema = createSchema.partial()` herda o campo.)

- [ ] **Step 8: Rodar e confirmar que passa**

Run: `cd backend && npx vitest run src/modules/modalidades/modalidades.service.test.ts`
Expected: PASS (todos).

- [ ] **Step 9: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/src/modules/modalidades
git commit -m "feat(modalidades): coluna mensagens_inscritos + API (Json)"
```

---

## Task 3: Frontend — tipo e serviço

**Files:**
- Modify: `frontend/src/types/modalidade.ts`
- Modify: `frontend/src/services/modalidades.ts`

- [ ] **Step 1: Tipo**

Em `frontend/src/types/modalidade.ts`:
- adicionar import no topo: `import type { MensagemInscritos } from '../lib/mensagens-inscritos'`
- no tipo `Modalidade`, após `chave_versao: ChaveVersao`, adicionar:
```ts
  mensagens_inscritos: MensagemInscritos[]
```

- [ ] **Step 2: Payload do serviço**

Em `frontend/src/services/modalidades.ts`:
- ajustar o import de tipos: `import type { Modalidade, ChaveVersao } from '../types/modalidade'` e adicionar `import type { MensagemInscritos } from '../lib/mensagens-inscritos'`
- no `ModalidadePayload`, adicionar:
```ts
  mensagens_inscritos?: MensagemInscritos[]
```

- [ ] **Step 3: Verificar tipos**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros citando `modalidade.ts`/`modalidades.ts`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/modalidade.ts frontend/src/services/modalidades.ts
git commit -m "feat(modalidades-fe): tipo/payload mensagens_inscritos"
```

---

## Task 4: Cadastro — editor de mensagens (só Grupo/Chaves)

**Files:**
- Modify: `frontend/src/pages/modalidades/ModalidadeForm.tsx`

- [ ] **Step 1: Imports e estado**

Em `frontend/src/pages/modalidades/ModalidadeForm.tsx`:
- adicionar import: `import type { MensagemInscritos } from '../../lib/mensagens-inscritos'`
- após o estado `chaveVersao` (`const [chaveVersao, setChaveVersao] = useState<ChaveVersao>('V2')`), adicionar:
```ts
  const [mensagens, setMensagens] = useState<MensagemInscritos[]>([])
```
- no `useEffect` que carrega `existing`, adicionar dentro do `if (existing) { ... }`:
```ts
      setMensagens(existing.mensagens_inscritos ?? [])
```

- [ ] **Step 2: Helpers de edição da lista**

Adicionar dentro do componente (antes do `return`), perto dos outros handlers:
```ts
  function addMensagem() {
    setMensagens(prev => [...prev, { min: 1, max: null, mensagem: '', pular_sorteio: false }])
  }
  function updateMensagem(i: number, patch: Partial<MensagemInscritos>) {
    setMensagens(prev => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)))
  }
  function removeMensagem(i: number) {
    setMensagens(prev => prev.filter((_, idx) => idx !== i))
  }
```

- [ ] **Step 3: Enviar no payload**

No objeto `payload` do `mutationFn` (após `chave_versao: chaveVersao,`), adicionar:
```ts
        mensagens_inscritos: mensagens
          .filter(m => m.mensagem.trim() !== '')
          .map(m => ({ ...m, mensagem: m.mensagem.trim() })),
```

- [ ] **Step 4: Renderizar o card (só grupos/chaves)**

Logo após o fechamento do card "Identificação" (a `</section>` que contém Nome/Sigla e o seletor de versão), inserir:

```tsx
          {(tipoSelecionado?.tipo === 'grupos' || tipoSelecionado?.tipo === 'chaves') && (
            <section style={cardStyle}>
              <div className="flex items-center gap-3 mb-1">
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #0d9488 0%, #14b88a 100%)', color: '#fff', display: 'grid', placeItems: 'center' }}>
                  <FileText size={18} />
                </div>
                <div>
                  <div className="eyebrow">Modo Congresso</div>
                  <h3 className="sec-title" style={{ fontSize: 17 }}>Mensagens por nº de inscritos</h3>
                </div>
              </div>
              <p className="text-xs text-[var(--t3)] mb-4 ml-12">
                Exibidas na tela "Inscritos" do Modo Congresso quando o nº de inscritos cair na faixa. "Pular sorteio" faz a próxima etapa voltar para a tela de modalidade.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {mensagens.map((m, i) => (
                  <div key={i} style={{ border: '1px solid var(--card-border)', borderRadius: 'var(--radius-lg)', padding: 12, background: 'var(--card-bg-2)' }}>
                    <div className="grid grid-cols-2 gap-3" style={{ marginBottom: 8 }}>
                      <div>
                        <label className="block text-xs font-medium text-[var(--t2)] mb-1">De (mín.)</label>
                        <input type="number" min={1} value={m.min}
                          onChange={e => updateMensagem(i, { min: Math.max(1, Number(e.target.value) || 1) })}
                          className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--t2)] mb-1">Até (vazio = sem limite)</label>
                        <input type="number" min={1} value={m.max ?? ''}
                          onChange={e => updateMensagem(i, { max: e.target.value === '' ? null : Number(e.target.value) })}
                          className={inputClass} />
                      </div>
                    </div>
                    <label className="block text-xs font-medium text-[var(--t2)] mb-1">Mensagem</label>
                    <textarea value={m.mensagem} rows={2}
                      onChange={e => updateMensagem(i, { mensagem: e.target.value })}
                      className={inputClass} style={{ resize: 'vertical' }} />
                    <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
                      <label className="inline-flex items-center gap-2 text-sm text-[var(--t2)]">
                        <input type="checkbox" checked={m.pular_sorteio}
                          onChange={e => updateMensagem(i, { pular_sorteio: e.target.checked })} />
                        Pular sorteio (voltar para modalidade)
                      </label>
                      <button type="button" onClick={() => removeMensagem(i)} className="text-[var(--danger)] text-xs font-semibold">Remover</button>
                    </div>
                  </div>
                ))}
              </div>

              <button type="button" onClick={addMensagem} className="btn btn-ghost btn-sm" style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Plus size={16} /> Adicionar mensagem
              </button>
            </section>
          )}
```

(`FileText` e `Plus` já estão importados em `ModalidadeForm.tsx`; `inputClass` e `cardStyle` já existem; `tipoSelecionado` já existe.)

- [ ] **Step 5: Verificar tipos e build**

Run: `cd frontend && npx tsc --noEmit`  → sem erros novos citando `ModalidadeForm.tsx`.
Run: `cd frontend && npm run build`  → conclui sem erros.

- [ ] **Step 6: Verificação manual**

`cd frontend && npm run dev` (backend rodando): editar uma modalidade de Grupo/Chaves → card aparece; adicionar regra (De/Até/Mensagem/Pular sorteio), salvar, reabrir → persistiu. Trocar tipo para Ordem de entrada → card some.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/modalidades/ModalidadeForm.tsx
git commit -m "feat(modalidades-fe): editor de mensagens por nº de inscritos (grupo/chaves)"
```

---

## Task 5: Modo Congresso — exibir mensagem + navegação

**Files:**
- Modify: `frontend/src/pages/congresso/CongressoStepParticipantes.tsx`
- Modify: `frontend/src/pages/congresso/ModoCongresso.tsx`

- [ ] **Step 1: `CongressoStepParticipantes` — imports e match**

Em `frontend/src/pages/congresso/CongressoStepParticipantes.tsx`:
- ajustar o import do react para incluir `useMemo`: `import { useState, useMemo } from 'react'`
- adicionar import: `import { matchMensagem } from '../../lib/mensagens-inscritos'`
- alterar o tipo de `onNext` no `type Props`:
```ts
  onNext: (opts?: { pularSorteio?: boolean }) => void
```
- após `const excludeIds = inscricoes.map(i => i.participante_id)`, adicionar:
```ts
  const regraMensagem = useMemo(
    () => matchMensagem(modalidade?.mensagens_inscritos ?? [], inscricoes.length),
    [modalidade, inscricoes.length],
  )
```

- [ ] **Step 2: Renderizar a mensagem (abaixo da lista, acima do botão)**

Inserir entre o fechamento do bloco da lista (`)}` que fecha o ternário `isLoading ? ... : inscricoes.length === 0 ? ... : (...)`) e o `<div>` do botão "Próximo":

```tsx
      {regraMensagem && (
        <div style={{ marginTop: 24, padding: '20px 24px', background: 'var(--cw-card)', border: '2px solid var(--brand-500)', borderRadius: 'var(--radius-xl)', textAlign: 'center' }}>
          <p style={{ margin: 0, textTransform: 'uppercase', fontWeight: 800, fontSize: 'clamp(20px, 2.4vw, 32px)', lineHeight: 1.25, color: FG }}>
            {regraMensagem.mensagem}
          </p>
        </div>
      )}
```

- [ ] **Step 3: Navegação no botão Próximo**

Substituir:
```tsx
        <button onClick={onNext} className="cw-btn cw-btn-primary">
          Próximo <ArrowRight size={20} />
        </button>
```
por:
```tsx
        <button onClick={() => onNext({ pularSorteio: regraMensagem?.pular_sorteio === true })} className="cw-btn cw-btn-primary">
          Próximo <ArrowRight size={20} />
        </button>
```

- [ ] **Step 4: `ModoCongresso` — respeitar pularSorteio**

Em `frontend/src/pages/congresso/ModoCongresso.tsx`, substituir a função `nextAfterParticipantes`:

```tsx
  function nextAfterParticipantes() {
    if (tipoAtual === 'especifico') {
      voltarParaModalidade()
    } else {
      setStep('sorteio')
    }
  }
```
por:
```tsx
  function nextAfterParticipantes(opts?: { pularSorteio?: boolean }) {
    if (opts?.pularSorteio || tipoAtual === 'especifico') {
      voltarParaModalidade()
    } else {
      setStep('sorteio')
    }
  }
```

- [ ] **Step 5: Verificar tipos e build**

Run: `cd frontend && npx tsc --noEmit`  → sem erros novos.
Run: `cd frontend && npm run build`  → conclui sem erros.

- [ ] **Step 6: Verificação manual**

No Modo Congresso, numa modalidade Grupo/Chaves com regra cadastrada cujo nº de inscritos casa:
- a mensagem aparece abaixo da lista em CAIXA ALTA/negrito/grande.
- se `pular_sorteio` marcado → "Próximo" volta para a tela de Modalidade; senão vai para o Sorteio.
- nº fora de qualquer faixa → nenhuma mensagem; "Próximo" segue o fluxo normal.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/congresso/CongressoStepParticipantes.tsx frontend/src/pages/congresso/ModoCongresso.tsx
git commit -m "feat(congresso): exibe mensagem por nº de inscritos + pular sorteio"
```

---

## Self-review (cobertura da spec)

- Modelo `mensagens_inscritos` (JSON) + migration → Task 2 ✓
- `matchMensagem` (primeira que casa, max nulo, inclusivo) → Task 1 ✓
- API zod/serviço → Task 2 ✓ · tipo/payload FE → Task 3 ✓
- Editor só Grupo/Chaves → Task 4 ✓
- Exibição caixa alta/negrito/grande abaixo da lista → Task 5 ✓
- Navegação por `pular_sorteio` (volta p/ Modalidade) → Task 5 ✓
- Testes: `matchMensagem` (Task 1) + service criar/editar (Task 2). Componentes via tsc/build + manual (usam react-query/estado, sem testing-library).
