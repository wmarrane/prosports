# Security Group 1 — IDOR nas leituras (escopar GETs por evento) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Impedir que `COMISSAO_TECNICA` leia dados de eventos não atribuídos: aplicar `requireAcessoEvento` nas rotas GET de inscrições/sorteios/campeões; ADMIN mantém acesso global.

**Architecture:** Reusar o middleware `requireAcessoEvento` existente. Ajustá-lo para **liberar ADMIN antes de exigir o evento_id** (ADMIN é global, não escopado) — necessário para os GETs sem filtro de evento. Depois, anexar os resolvers de evento aos GETs.

**Tech Stack:** Node/Express/Prisma, Vitest (mock prisma).

**Validação obrigatória:** `npm run test` + `npm run build` em `C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/backend`.

**Spec:** `docs/superpowers/specs/2026-06-14-security-hardening-design.md` (Grupo 1)

**Git:** identidade NÃO configurada — commitar inline (NÃO rodar `git config`): `git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit ...`. Não pular hooks.

---

## File Structure

- **Modify** `backend/src/middleware/evento-acesso.ts` — short-circuit ADMIN.
- **Modify** `backend/src/middleware/evento-acesso.test.ts` — ajustar/adicionar testes.
- **Modify** `backend/src/modules/inscricoes/inscricoes.routes.ts` — proteger GET /counts, /, /:id.
- **Modify** `backend/src/modules/sorteios/sorteios.routes.ts` — proteger GET /, /:id.
- **Modify** `backend/src/modules/campeoes_anteriores/campeoes_anteriores.routes.ts` — proteger GET /.

---

## Task 1: ADMIN bypassa `requireAcessoEvento` antes de resolver evento_id

**Files:**
- Modify: `backend/src/middleware/evento-acesso.ts`
- Modify: `backend/src/middleware/evento-acesso.test.ts`

- [ ] **Step 1: Ajustar o teste existente + adicionar caso ADMIN-sem-evento**

Em `backend/src/middleware/evento-acesso.test.ts`, o teste atual "400 quando evento_id não resolve" usa role ADMIN — após a mudança, ADMIN passa direto. Trocar esse teste para usar `COMISSAO_TECNICA` e adicionar um teste de ADMIN sem evento_id.

Trocar:
```ts
  it('400 quando evento_id não resolve', async () => {
    const req: any = { user: { sub: 1, role: 'ADMIN' } }
    const res: any = mkRes()
    const next = vi.fn()
    await requireAcessoEvento(() => null)(req, res, next)
    expect(res.statusCode).toBe(400)
    expect(next).not.toHaveBeenCalled()
  })
```
Por:
```ts
  it('400 quando evento_id não resolve (não-admin)', async () => {
    const req: any = { user: { sub: 2, role: 'COMISSAO_TECNICA' } }
    const res: any = mkRes()
    const next = vi.fn()
    await requireAcessoEvento(() => null)(req, res, next)
    expect(res.statusCode).toBe(400)
    expect(next).not.toHaveBeenCalled()
  })

  it('ADMIN passa mesmo sem evento_id (resolver não é chamado)', async () => {
    const req: any = { user: { sub: 1, role: 'ADMIN' } }
    const res: any = mkRes()
    const next = vi.fn()
    const resolver = vi.fn(() => null)
    await requireAcessoEvento(resolver as any)(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(resolver).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: Rodar testes — confirmar FALHA**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/backend" && npm run test -- evento-acesso`
Expected: FAIL (o novo teste "ADMIN passa mesmo sem evento_id" falha — hoje ADMIN com resolver null recebe 400 e o resolver É chamado).

- [ ] **Step 3: Short-circuit ADMIN no middleware**

Em `backend/src/middleware/evento-acesso.ts`, no `requireAcessoEvento`, trocar:
```ts
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user as AuthUser
      const evento_id = await resolver(req)
      if (evento_id == null || Number.isNaN(evento_id)) {
        res.status(400).json({ message: 'Evento não identificado na requisição.' })
        return
      }
      if (await usuarioTemAcessoAoEvento(user, evento_id)) { next(); return }
      res.status(403).json({ message: 'Acesso negado a este evento.' })
    } catch (err) { next(err) }
  }
```
Por:
```ts
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user as AuthUser
      // ADMIN tem acesso global — não precisa resolver/scopo de evento.
      if (user?.role === 'ADMIN') { next(); return }
      const evento_id = await resolver(req)
      if (evento_id == null || Number.isNaN(evento_id)) {
        res.status(400).json({ message: 'Evento não identificado na requisição.' })
        return
      }
      if (await usuarioTemAcessoAoEvento(user, evento_id)) { next(); return }
      res.status(403).json({ message: 'Acesso negado a este evento.' })
    } catch (err) { next(err) }
  }
```

- [ ] **Step 4: Rodar testes — confirmar PASSA**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/backend" && npm run test -- evento-acesso`
Expected: PASS (todos, incluindo os ajustados/novos).

- [ ] **Step 5: Commit**

```bash
git add backend/src/middleware/evento-acesso.ts backend/src/middleware/evento-acesso.test.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(security): requireAcessoEvento libera ADMIN antes de exigir evento_id"
```

---

## Task 2: Proteger GETs de inscrições

**Files:**
- Modify: `backend/src/modules/inscricoes/inscricoes.routes.ts`

- [ ] **Step 1: Adicionar resolver por query e proteger os GETs**

Em `backend/src/modules/inscricoes/inscricoes.routes.ts`, após a linha `const acessoInscricaoId = requireAcessoEvento(async req => { ... })` (fim do bloco), adicionar:
```ts
const acessoQueryEvento = requireAcessoEvento(req => Number(req.query.evento_id))
```

Trocar:
```ts
router.get('/counts', requireAuth, ctrl.counts)
router.get('/', requireAuth, ctrl.listar)
router.get('/:id', requireAuth, ctrl.buscarPorId)
```
Por:
```ts
router.get('/counts', requireAuth, acessoQueryEvento, ctrl.counts)
router.get('/', requireAuth, acessoQueryEvento, ctrl.listar)
router.get('/:id', requireAuth, acessoInscricaoId, ctrl.buscarPorId)
```

- [ ] **Step 2: Build**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/backend" && npm run build`
Expected: PASS (`tsc`).

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/inscricoes/inscricoes.routes.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "fix(security): escopar GETs de inscricoes por evento (IDOR)"
```

---

## Task 3: Proteger GETs de sorteios

**Files:**
- Modify: `backend/src/modules/sorteios/sorteios.routes.ts`

- [ ] **Step 1: Adicionar resolver por query e proteger os GETs**

Em `backend/src/modules/sorteios/sorteios.routes.ts`, após a linha `const acessoSorteioId = requireAcessoEvento(async req => { ... })`, adicionar:
```ts
const acessoQueryEvento = requireAcessoEvento(req => Number(req.query.evento_id))
```

Trocar:
```ts
router.get('/', requireAuth, ctrl.listar)
router.get('/:id', requireAuth, ctrl.buscarPorId)
```
Por:
```ts
router.get('/', requireAuth, acessoQueryEvento, ctrl.listar)
router.get('/:id', requireAuth, acessoSorteioId, ctrl.buscarPorId)
```

- [ ] **Step 2: Build**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/backend" && npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/sorteios/sorteios.routes.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "fix(security): escopar GETs de sorteios por evento (IDOR)"
```

---

## Task 4: Proteger GET de campeões anteriores + validação final

**Files:**
- Modify: `backend/src/modules/campeoes_anteriores/campeoes_anteriores.routes.ts`

- [ ] **Step 1: Adicionar resolver por query e proteger o GET**

Em `backend/src/modules/campeoes_anteriores/campeoes_anteriores.routes.ts`, após a linha `const acessoCampeaoId = requireAcessoEvento(async req => { ... })`, adicionar:
```ts
const acessoQueryEvento = requireAcessoEvento(req => Number(req.query.evento_id))
```

Trocar:
```ts
router.get('/', requireAuth, ctrl.listar)
```
Por:
```ts
router.get('/', requireAuth, acessoQueryEvento, ctrl.listar)
```

- [ ] **Step 2: Build + suíte completa**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/backend" && npm run build`
Expected: PASS.

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/backend" && npm run test`
Expected: PASS (suíte inteira).

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/campeoes_anteriores/campeoes_anteriores.routes.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "fix(security): escopar GET de campeoes anteriores por evento (IDOR)"
```

---

## Manual Test Checklist

- Como **ADMIN**: listar inscrições/sorteios/campeões (com e sem `evento_id`) funciona normalmente; abrir um evento e ver inscritos/sorteios funciona.
- Como **COMISSAO_TECNICA** atribuída ao evento A: vê inscritos/sorteios/campeões do A; `GET /inscricoes?evento_id=B` (evento não atribuído) → 403; `GET /sorteios/:id` de um sorteio do B → 403; `GET /inscricoes` sem `evento_id` → 400.
- Frontend do CT (Modo Congresso, relatórios) continua funcionando para os eventos atribuídos (todas as chamadas passam `evento_id`).

---

## Self-Review

**1. Spec coverage (Grupo 1):**
- `GET /inscricoes` (+`/counts`, `/:id`) escopados → Task 2. ✓
- `GET /sorteios` (+`/:id`) escopados → Task 3. ✓
- `GET /campeoes-anteriores` escopado → Task 4. ✓
- ADMIN não escopado (liberado antes do evento_id) → Task 1. ✓

**2. Placeholder scan:** Sem TBD/TODO; blocos completos. ✓

**3. Type consistency:** `requireAcessoEvento(resolver)` inalterado na assinatura; `acessoQueryEvento`/`acessoInscricaoId`/`acessoSorteioId`/`acessoCampeaoId` retornam `number | null`. `req.query.evento_id` → `Number(...)` (NaN para CT vira 400; ADMIN bypassa). ✓
