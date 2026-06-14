# Security follow-up — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans. Steps usam checkbox (`- [ ]`).

**Goal:** Fechar as pendências da re-auditoria: (1) fórmula no Excel do congresso, (2) escopar 3 GETs de evento, (3) terminar o sweep de validação de id, (4) `JWT_KEY_SECRET` opcional.

**Tech Stack:** Node/Express/Prisma + Vitest (backend). Sem frontend, sem migration.

**Validação obrigatória:** backend `npm run build` + `npm run test`.

**Spec:** `docs/superpowers/specs/2026-06-14-security-followup-design.md`

**Git:** identidade NÃO configurada — commitar inline (`git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit ...`). Não pular hooks. Caminhos absolutos.

---

## Task 1: Excel do congresso — neutralizar fórmula

**Files:** Create `backend/src/lib/sheet-safe.ts` (+test); Modify `backend/src/modules/relatorios/relatorio_congresso.service.ts`

- [ ] **Step 1: Test (falha)**

Create `backend/src/lib/sheet-safe.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { sheetSafe } from './sheet-safe'

describe('sheetSafe', () => {
  it('prefixa apóstrofo em strings de fórmula', () => {
    expect(sheetSafe('=SOMA(A1)')).toBe(`'=SOMA(A1)`)
    expect(sheetSafe('+1')).toBe(`'+1`)
    expect(sheetSafe('-2')).toBe(`'-2`)
    expect(sheetSafe('@x')).toBe(`'@x`)
  })
  it('mantém strings normais e não-strings', () => {
    expect(sheetSafe('Campinas')).toBe('Campinas')
    expect(sheetSafe(10)).toBe(10)
    expect(sheetSafe(null)).toBe(null)
  })
})
```

- [ ] **Step 2: Run — FAIL**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/backend" && npm run test -- sheet-safe`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implement helper**

Create `backend/src/lib/sheet-safe.ts`:
```ts
// Neutraliza injeção de fórmula em células de planilha (Excel/Sheets):
// prefixa ' quando o valor (string) começa com = + - @ tab ou CR.
// Não-strings passam intactos.
export function sheetSafe<T>(value: T): T | string {
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(value)) return `'${value}`
  return value
}
```

- [ ] **Step 4: Run — PASS**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/backend" && npm run test -- sheet-safe`
Expected: PASS.

- [ ] **Step 5: Aplicar nas atribuições de nomes**

Em `backend/src/modules/relatorios/relatorio_congresso.service.ts`, adicionar `import { sheetSafe } from '../../lib/sheet-safe'` e envolver com `sheetSafe(...)` os valores **de nome/usuário** nestas atribuições (ler o arquivo para casar o RHS exato):
- linha ~76: `d2.value = sheetSafe(anfitriao)`
- linhas ~89, ~197, ~255: `... .value = sheetSafe(nome.toUpperCase())`
- linhas ~96, ~262: `cell.value = sheetSafe(n)`
- linhas ~125, ~204, ~275: `... .value = sheetSafe(nomePorPid.get(pid) ?? '—')`
- linhas ~171, ~173: `... .value = pidE != null ? sheetSafe(nomePorPid.get(pidE) ?? '-') : '-'` (e idem `pidD`)

NÃO envolver rótulos estáticos (cabeçalhos, "Grupos", "Programação", datas-label, "RELATÓRIO REQUER REVISÃO...") nem numéricos (`inscritos.length`, `i + 1`). Se algum nome de variável diferir, aplicar pelo mesmo critério (valor derivado de nome de participante/anfitrião/modalidade).

- [ ] **Step 6: Build + test**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/backend" && npm run build && npm run test`
Expected: PASS.

- [ ] **Step 7: Commit**
```bash
git add backend/src/lib/sheet-safe.ts backend/src/lib/sheet-safe.test.ts backend/src/modules/relatorios/relatorio_congresso.service.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "fix(security): neutralizar formula injection no Excel do congresso"
```

---

## Task 2: Escopar 3 GETs de evento

**Files:** Modify `backend/src/modules/eventos/eventos.routes.ts`

- [ ] **Step 1: Importar middleware + resolver**

Adicionar o import (após `import { requireAuth, requireRole } from '../../middleware/auth'`):
```ts
import { requireAcessoEvento } from '../../middleware/evento-acesso'
```
E após `const admin = [requireAuth, requireRole('ADMIN')]`:
```ts
const acessoEventoIdParam = requireAcessoEvento(req => Number(req.params.id))
```

- [ ] **Step 2: Aplicar nos 3 GETs**

Trocar:
```ts
router.get('/:id/anfitriao-ordem', requireAuth, anfitriaoOrdem.getAnfitriaoOrdem)
```
Por:
```ts
router.get('/:id/anfitriao-ordem', requireAuth, acessoEventoIdParam, anfitriaoOrdem.getAnfitriaoOrdem)
```
Trocar:
```ts
router.get('/:id/modalidades', requireAuth, modalidadesExcluidas.getModalidadesDoEvento)
router.get('/:id/modalidades-excluidas', requireAuth, modalidadesExcluidas.getExcluidas)
```
Por:
```ts
router.get('/:id/modalidades', requireAuth, acessoEventoIdParam, modalidadesExcluidas.getModalidadesDoEvento)
router.get('/:id/modalidades-excluidas', requireAuth, acessoEventoIdParam, modalidadesExcluidas.getExcluidas)
```
(Não mexer em `GET /`, `GET /:id`, nem nos `...admin`.)

- [ ] **Step 3: Build + test**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/backend" && npm run build && npm run test`
Expected: PASS.

- [ ] **Step 4: Commit**
```bash
git add backend/src/modules/eventos/eventos.routes.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "fix(security): escopar GETs de evento (anfitriao-ordem/modalidades) por acesso (IDOR)"
```

---

## Task 3: Terminar o sweep de validação de id

**Files:** Modify controllers + route-guards listados.

- [ ] **Step 1: Sweep dos controllers**

Em cada controller abaixo, adicionar `import { parseIntParam } from '../../lib/parse-id'` (caminho relativo conforme a pasta) e trocar `Number(req.params.<x>)` por `parseIntParam(req.params.<x>, '<x>')` (apenas params; não tocar body/query; pular onde já há validação inline):
- `backend/src/modules/competicoes/competicoes.controller.ts`
- `backend/src/modules/delegacias/delegacias.controller.ts`
- `backend/src/modules/inspetorias/inspetorias.controller.ts`
- `backend/src/modules/municipios/municipios.controller.ts`
- `backend/src/modules/tipos_modalidade/tipos_modalidade.controller.ts`
- `backend/src/modules/sistemas_disputa/sistemas_disputa.controller.ts`
- `backend/src/modules/eventos/anfitriao-ordem.controller.ts`
- `backend/src/modules/eventos/modalidades-excluidas.controller.ts`
- `backend/src/modules/key_access/key_access.controller.ts` (no `modalidadeDetail`, `Number(req.params.id)`)
- `backend/src/modules/relatorios/relatorios.controller.ts`

- [ ] **Step 2: Guards de rota (evitar NaN→500)**

Nos resolvers que fazem `findUnique({ where: { id: Number(req.params.id) } })` (`campeoes_anteriores.routes.ts`, `inscricoes.routes.ts`, `sorteios.routes.ts`), validar o id antes do lookup para retornar `null` (→ 400 do middleware) em vez de NaN→500. Padrão:
```ts
const acessoXId = requireAcessoEvento(async req => {
  const n = Number(req.params.id)
  if (!Number.isInteger(n) || n <= 0) return null
  const r = await prisma.<modelo>.findUnique({ where: { id: n }, select: { evento_id: true } })
  return r?.evento_id ?? null
})
```
Aplicar aos resolvers `acessoInscricaoId`, `acessoSorteioId`, `acessoCampeaoId` (e quaisquer outros guards desses arquivos que usem `Number(req.params.id)`).

- [ ] **Step 3: Build + suíte**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/backend" && npm run build && npm run test`
Expected: PASS (se algum teste passava id inválido esperando outro status, ajustar para 400 — relatar).

- [ ] **Step 4: Commit**
```bash
git add backend/src/modules
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "fix(security): completar validacao de id em params (400 em vez de NaN/500)"
```

---

## Task 4: `JWT_KEY_SECRET` opcional (com fallback)

**Files:** Modify `backend/src/lib/key-jwt.ts`, `backend/.env.example`

- [ ] **Step 1: Segredo dedicado com fallback**

Em `backend/src/lib/key-jwt.ts`, adicionar no topo (após os imports):
```ts
const KEY_SECRET = process.env.JWT_KEY_SECRET ?? process.env.JWT_SECRET!
```
E trocar os usos `process.env.JWT_SECRET!` por `KEY_SECRET` em `signKeyToken` e `verifyKeyToken` (mantendo `algorithm: 'HS256'` / `algorithms: ['HS256']`).

- [ ] **Step 2: Documentar env (opcional)**

Em `backend/.env.example`, na seção de auth, adicionar:
```
# Opcional: segredo dedicado para o token da chave mobile (separa do JWT_SECRET). Se vazio, usa JWT_SECRET.
JWT_KEY_SECRET=
```

- [ ] **Step 3: Build + test**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/backend" && npm run build && npm run test`
Expected: PASS (testes de `key_access` continuam — fallback usa `JWT_SECRET`, já setado nos testes).

- [ ] **Step 4: Commit**
```bash
git add backend/src/lib/key-jwt.ts backend/.env.example
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(security): JWT_KEY_SECRET dedicado opcional p/ token da chave (fallback JWT_SECRET)"
```

---

## Manual Test Checklist
- Excel do congresso: gerar com um inscrito de nome `=teste` → no .xlsx a célula mostra `=teste` como texto (não executa).
- CT não atribuída: `GET /eventos/<outro>/anfitriao-ordem` e `/modalidades` → 403; ADMIN e CT atribuída → 200.
- `GET /<modulo>/:id` com id não numérico → 400 (não 500).
- Chave mobile: login/uso continuam funcionando (KEY_SECRET = JWT_SECRET por fallback).

## Self-Review
**Spec coverage:** xlsx (T1) ✓; 3 GETs (T2) ✓; sweep id (T3) ✓; JWT_KEY_SECRET opcional (T4) ✓.
**Placeholders:** T1/T3 são sweeps explícitos (ler+aplicar com critério exato); helpers com código completo.
**Type consistency:** `sheetSafe<T>(value): T|string`; `parseIntParam(value, name?): number`; `requireAcessoEvento(resolver)`; `KEY_SECRET` string. Sem novas envs obrigatórias.
