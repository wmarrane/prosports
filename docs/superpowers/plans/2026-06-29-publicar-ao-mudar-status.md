# Publicar/despublicar ao mudar status — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao alterar o status de um evento no admin, publicar automaticamente (pronto/parcial/sorteado) ou despublicar (rascunho/inscrições/suspenso) o evento no site público — só na mudança de status, best-effort.

**Architecture:** Função de decisão **pura** (`decidirAcaoPublicacao`) num módulo isolado e sem dependências pesadas, mais o wiring no `eventos.service.editar` que lê o status anterior, aplica o update e dispara `publicar`/`despublicar` do `site-publico.service` (best-effort).

**Tech Stack:** Node + TypeScript (Express/Prisma), Vitest. Backend: `npm run build` = `tsc`; `npm test` = `vitest run`.

## Global Constraints

- Host Windows; ler antes de editar; caminhos absolutos.
- Git identity inline: `git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit ...`.
- Nunca `git add -A` — só os arquivos da task.
- Validar: `cd backend && npx vitest run src/modules/eventos` e `cd backend && npx tsc --noEmit` (sem erros novos). Sem schema/migration.
- Best-effort: a publicação/despublicação **nunca** pode derrubar o salvamento do status.
- Reusar `publicar`/`despublicar` do `site-publico.service` (sem novo endpoint). Sem cores/UI.
- Demo em develop antes de promover.

---

### Task 1: Decisão de publicação + wiring no editar

**Files:**
- Create: `backend/src/modules/eventos/publicar-status.ts`
- Create (test): `backend/src/modules/eventos/publicar-status.test.ts`
- Modify: `backend/src/modules/eventos/eventos.service.ts`

**Interfaces:**
- Produz: `decidirAcaoPublicacao(statusAntes, statusDepois, publicado) → 'publicar' | 'despublicar' | null` e `type EventoStatus` em `publicar-status.ts`.
- Consome: `publicar(id, { permitirParcial })` e `despublicar(id)` de `../site-publico/site-publico.service`.

- [ ] **Step 1: Teste que falha**

Criar `backend/src/modules/eventos/publicar-status.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { decidirAcaoPublicacao } from './publicar-status'

describe('decidirAcaoPublicacao', () => {
  it('publica ao virar pronto/parcial/sorteado', () => {
    expect(decidirAcaoPublicacao('inscricoes', 'pronto', false)).toBe('publicar')
    expect(decidirAcaoPublicacao('pronto', 'parcial', true)).toBe('publicar')
    expect(decidirAcaoPublicacao('parcial', 'sorteado', true)).toBe('publicar')
  })
  it('despublica ao virar status nao-publico SE estiver publicado', () => {
    expect(decidirAcaoPublicacao('sorteado', 'rascunho', true)).toBe('despublicar')
    expect(decidirAcaoPublicacao('pronto', 'suspenso', true)).toBe('despublicar')
  })
  it('nada quando nao-publico e nao publicado', () => {
    expect(decidirAcaoPublicacao('inscricoes', 'rascunho', false)).toBeNull()
  })
  it('nada quando status ausente ou igual ao atual', () => {
    expect(decidirAcaoPublicacao('pronto', undefined, true)).toBeNull()
    expect(decidirAcaoPublicacao('sorteado', 'sorteado', true)).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/modules/eventos/publicar-status.test.ts`
Expected: FAIL (módulo `./publicar-status` não existe).

- [ ] **Step 3: Criar `publicar-status.ts`**

```ts
export type EventoStatus = 'rascunho' | 'inscricoes' | 'pronto' | 'sorteado' | 'parcial' | 'suspenso'

const PUBLICAVEIS: EventoStatus[] = ['pronto', 'parcial', 'sorteado']

/**
 * Decide a ação no site público a partir da transição de status.
 * - vira pronto/parcial/sorteado  -> 'publicar'
 * - vira rascunho/inscricoes/suspenso -> 'despublicar' (só se já publicado)
 * - status ausente ou inalterado  -> null
 */
export function decidirAcaoPublicacao(
  statusAntes: EventoStatus | undefined,
  statusDepois: EventoStatus | undefined,
  publicado: boolean,
): 'publicar' | 'despublicar' | null {
  if (!statusDepois || statusDepois === statusAntes) return null
  if (PUBLICAVEIS.includes(statusDepois)) return 'publicar'
  return publicado ? 'despublicar' : null
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx vitest run src/modules/eventos/publicar-status.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Ligar no `eventos.service.editar`**

a) Imports no topo de `backend/src/modules/eventos/eventos.service.ts` (após os imports existentes):
```ts
import { publicar, despublicar } from '../site-publico/site-publico.service'
import { decidirAcaoPublicacao } from './publicar-status'
```
(Sem ciclo: `site-publico.service` importa `evento-modalidades.service`, não `eventos.service`. Se o build/runtime acusar import circular, trocar por import dinâmico dentro do `editar`: `const { publicar, despublicar } = await import('../site-publico/site-publico.service')`.)

b) Substituir a função `editar` inteira:
```ts
export async function editar(id: number, data: Partial<CreateInput>) {
  const { comissao_ids: comissaoRaw, ...rest } = data
  const comissao_ids = comissaoRaw ? [...new Set(comissaoRaw)] : undefined
  if (comissao_ids) await validarComissaoIds(comissao_ids)
  const antes = await prisma.evento.findUnique({ where: { id }, select: { status: true, site_publicado_em: true } })
  const atualizado = await mapPrismaError(async () => {
    await prisma.evento.update({ where: { id }, data: rest })
    if (comissao_ids) {
      await prisma.$transaction([
        prisma.eventoComissao.deleteMany({ where: { evento_id: id } }),
        ...(comissao_ids.length > 0
          ? [prisma.eventoComissao.createMany({ data: comissao_ids.map(usuario_id => ({ evento_id: id, usuario_id })) })]
          : []),
      ])
    }
    return prisma.evento.findUnique({ where: { id }, include: INCLUDE })
  })
  const acao = decidirAcaoPublicacao(antes?.status, rest.status, !!antes?.site_publicado_em)
  if (acao === 'publicar') {
    try { await publicar(id, { permitirParcial: true }) } catch (e) { console.warn(`[editar] publicar evento ${id} falhou`, e) }
  } else if (acao === 'despublicar') {
    try { await despublicar(id) } catch (e) { console.warn(`[editar] despublicar evento ${id} falhou`, e) }
  }
  return atualizado
}
```
(`antes?.status` é o enum do Prisma e `rest.status` é o `EventoStatus` local — ambos são a mesma união de literais, atribuíveis estruturalmente ao parâmetro de `decidirAcaoPublicacao`.)

- [ ] **Step 6: Build + testes**

Run: `cd backend && npx tsc --noEmit && npx vitest run src/modules/eventos`
Expected: `tsc` sem erros; testes do módulo verdes (nota: pode haver ~6 falhas pré-existentes de timeout em storage/relatorio_congresso fora de `src/modules/eventos` — não rodam neste filtro).

- [ ] **Step 7: Commit**
```bash
git add backend/src/modules/eventos/publicar-status.ts backend/src/modules/eventos/publicar-status.test.ts backend/src/modules/eventos/eventos.service.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(eventos): publica/despublica no site ao mudar status do evento (best-effort)"
```

---

## Verificação final (após a task)

- [ ] `cd backend && npx tsc --noEmit && npx vitest run src/modules/eventos` verdes.
- [ ] **Demo no dev:** no admin, mudar um evento para **Pronto p/ sortear** → aparece publicado no site de dev (~1–2 min); mudar para **Sorteado** → atualiza; mudar para **Rascunho** → some do site. (Backend não é SSG estático — validar ao vivo no dev após o merge.)
- [ ] Após aprovação: merge `feat/<branch>` → develop (só arquivos esperados), push, monitorar deploy.

## Self-Review (cobertura da spec)
- Gatilho só na mudança de status: `decidirAcaoPublicacao` retorna null se ausente/igual — Step 3 ✓.
- pronto/parcial/sorteado → publicar; rascunho/inscricoes/suspenso → despublicar (só se publicado): Step 3 ✓.
- Best-effort (não derruba o save): try/catch no Step 5 ✓.
- Reusa publicar/despublicar, sem endpoint novo, sem migration: Step 5 ✓.
- Teste do mapa transição→ação (pure, sem DB/mocks): Step 1 ✓.
