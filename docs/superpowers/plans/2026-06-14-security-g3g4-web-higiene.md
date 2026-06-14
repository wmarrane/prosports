# Security Grupos 3 & 4 — Web hardening + Higiene — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir XSS no site público, CSV formula injection, headers de segurança no Firebase, advisory de dependência; e itens de higiene: rate limit na chave mobile, seed admin via env, teto de import CSV, validação de id em params, .gitignore e scrub de segredo em docs.

**Architecture:** Mudanças isoladas e de baixo risco em frontend (lib/CSV, html-shell, firebase.json), backend (rate limit, seed, import caps, helper de id) e docs/config. Sem mudanças de auth (essas ficam no Grupo 2).

**Tech Stack:** React/TS/Vite (frontend), Node/Express/Prisma + Vitest (backend).

**Validação obrigatória:** frontend `npm run build` + `npm run test`; backend `npm run build` + `npm run test`.

**Spec:** `docs/superpowers/specs/2026-06-14-security-hardening-design.md` (Grupos 3 e 4)

**Git:** identidade NÃO configurada — commitar inline (NÃO rodar `git config`): `git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit ...`. Não pular hooks.

---

## File Structure
- **Create** `frontend/src/lib/csv-safe.ts` (+test) — `csvCell()` (RFC4180 + neutralização de fórmula).
- **Modify** `frontend/src/pages/Relatorio.tsx`, `frontend/src/lib/csv-template.ts` — usar `csvCell`.
- **Modify** `frontend/src/site-publico/html-shell.ts` — escapar `<title>`.
- **Modify** `frontend/firebase.json` — headers de segurança.
- **Modify** `frontend/package.json` + lock — `npm audit fix` (react-router).
- **Modify** `backend/src/modules/key_access/key_access.routes.ts` — rate limit no login.
- **Modify** `backend/prisma/seed.ts` — senha admin via env.
- **Modify** `backend/src/modules/modalidades/import.service.ts`, `backend/src/modules/municipios/import.service.ts` — teto de linhas.
- **Create** `backend/src/lib/parse-id.ts` (+test); **Modify** controllers — validação de id.
- **Modify** `.gitignore`; scrub de segredo em `docs/**`.

---

## Task 1: Helper CSV seguro (formula injection) + uso

**Files:**
- Create: `frontend/src/lib/csv-safe.ts`
- Test: `frontend/src/lib/csv-safe.test.ts`
- Modify: `frontend/src/pages/Relatorio.tsx`, `frontend/src/lib/csv-template.ts`

- [ ] **Step 1: Test (falha)**

Create `frontend/src/lib/csv-safe.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { csvCell } from './csv-safe'

describe('csvCell', () => {
  it('neutraliza fórmula com prefixo apóstrofo', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('+1')).toBe(`'+1`)
    expect(csvCell('-2')).toBe(`'-2`)
    expect(csvCell('@cmd')).toBe(`'@cmd`)
  })
  it('mantém valores normais', () => {
    expect(csvCell('Campinas')).toBe('Campinas')
    expect(csvCell(10)).toBe('10')
    expect(csvCell(null)).toBe('')
  })
  it('aplica RFC4180 quando há vírgula/aspas/quebra', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('a"b')).toBe('"a""b"')
  })
})
```

- [ ] **Step 2: Run — FAIL**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend" && npm run test -- csv-safe`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implement**

Create `frontend/src/lib/csv-safe.ts`:
```ts
// Gera uma célula CSV segura: neutraliza injeção de fórmula (Excel/Sheets)
// prefixando com apóstrofo quando o valor começa com = + - @ tab ou CR,
// e aplica RFC 4180 (aspas) quando há vírgula/aspas/quebra de linha.
export function csvCell(value: string | number | null | undefined): string {
  let s = value == null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}
```

- [ ] **Step 4: Run — PASS**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend" && npm run test -- csv-safe`
Expected: PASS.

- [ ] **Step 5: Usar csvCell em Relatorio.tsx**

Em `frontend/src/pages/Relatorio.tsx`, adicionar o import (junto aos demais imports do topo): `import { csvCell } from '../lib/csv-safe'`. Trocar a função `escapeCsv` (linhas ~14-20) inteira por um reuso:
```ts
function escapeCsv(value: string | null | undefined): string {
  return csvCell(value)
}
```
(Mantém `buildCsv` chamando `escapeCsv`.)

- [ ] **Step 6: Usar csvCell em csv-template.ts**

Em `frontend/src/lib/csv-template.ts`, adicionar `import { csvCell } from './csv-safe'` no topo e trocar a função `escape(...)` inteira por:
```ts
function escape(value: string | number | null | undefined): string {
  return csvCell(value)
}
```

- [ ] **Step 7: Build + test**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend" && npm run build`
Expected: PASS.
Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend" && npm run test`
Expected: PASS.

- [ ] **Step 8: Commit**
```bash
git add frontend/src/lib/csv-safe.ts frontend/src/lib/csv-safe.test.ts frontend/src/pages/Relatorio.tsx frontend/src/lib/csv-template.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "fix(security): neutralizar CSV formula injection nos exports"
```

---

## Task 2: Escapar `<title>` no site público (XSS)

**Files:**
- Modify: `frontend/src/site-publico/html-shell.ts`

- [ ] **Step 1: Implementar escape**

Trocar todo o conteúdo de `frontend/src/site-publico/html-shell.ts` por:
```ts
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function htmlShell(opts: { title: string; body: string; cssHref: string }): string {
  return `<!doctype html>
<html lang="pt-BR" data-theme="light">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(opts.title)}</title>
<link rel="icon" href="/montana/simbolo.png" />
<link rel="stylesheet" href="${opts.cssHref}" />
</head>
<body>${opts.body}</body>
</html>`
}
```
(`opts.body` continua sendo HTML já gerado por `renderToStaticMarkup` — auto-escapado; só o `title` era cru.)

- [ ] **Step 2: Build**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend" && npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**
```bash
git add frontend/src/site-publico/html-shell.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "fix(security): escapar title do site publico (XSS)"
```

---

## Task 3: Headers de segurança no Firebase

**Files:**
- Modify: `frontend/firebase.json`

- [ ] **Step 1: Adicionar bloco de headers de segurança nos dois targets**

Em `frontend/firebase.json`, no array `headers` do target **admin**, adicionar como **primeiro** item:
```json
{ "source": "**", "headers": [
  { "key": "X-Frame-Options", "value": "DENY" },
  { "key": "X-Content-Type-Options", "value": "nosniff" },
  { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
  { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" }
] },
```
Repetir o mesmo item como primeiro do array `headers` do target **publico**. Garantir JSON válido (vírgulas).

- [ ] **Step 2: Validar JSON**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend" && node -e "JSON.parse(require('fs').readFileSync('firebase.json','utf8')); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 3: Commit**
```bash
git add frontend/firebase.json
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "hardening: headers de seguranca no Firebase Hosting"
```

---

## Task 4: npm audit fix (frontend, react-router)

**Files:**
- Modify: `frontend/package.json`, `frontend/package-lock.json`

- [ ] **Step 1: Aplicar fix não-breaking**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend" && npm audit fix`
(Se `npm audit fix` quiser breaking changes, NÃO usar `--force`; relatar o que sobrou.)

- [ ] **Step 2: Build + test**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend" && npm run build && npm run test`
Expected: PASS (sem regressão de roteamento).

- [ ] **Step 3: Commit**
```bash
git add frontend/package.json frontend/package-lock.json
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "chore(security): npm audit fix (react-router open redirect)"
```

---

## Task 5: Rate limit na chave mobile

**Files:**
- Modify: `backend/src/modules/key_access/key_access.routes.ts`

- [ ] **Step 1: Aplicar loginRateLimit ao POST /login**

Trocar:
```ts
import { Router } from 'express'
import { requireEventoKey } from '../../middleware/requireEventoKey'
import * as ctrl from './key_access.controller'

const router = Router()

// Public: login com token + device
router.post('/login', ctrl.login)
```
Por:
```ts
import { Router } from 'express'
import { requireEventoKey } from '../../middleware/requireEventoKey'
import { loginRateLimit } from '../../middleware/security'
import * as ctrl from './key_access.controller'

const router = Router()

// Public: login com token + device (rate-limited contra brute force)
router.post('/login', loginRateLimit, ctrl.login)
```

- [ ] **Step 2: Build**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/backend" && npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**
```bash
git add backend/src/modules/key_access/key_access.routes.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "fix(security): rate limit no login da chave mobile"
```

---

## Task 6: Seed admin via env

**Files:**
- Modify: `backend/prisma/seed.ts`

- [ ] **Step 1: Senha do admin a partir de ADMIN_SEED_PASSWORD**

Trocar a linha:
```ts
  const senhaHash = await bcrypt.hash('admin123', 12)
```
Por:
```ts
  const senha = process.env.ADMIN_SEED_PASSWORD
  if (!senha) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ADMIN_SEED_PASSWORD é obrigatório para seed em produção.')
    }
    console.warn('[seed] ADMIN_SEED_PASSWORD não definido — usando senha de desenvolvimento "admin123". NÃO use em produção.')
  }
  const senhaHash = await bcrypt.hash(senha ?? 'admin123', 12)
```

- [ ] **Step 2: Build**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/backend" && npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**
```bash
git add backend/prisma/seed.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "fix(security): senha do admin no seed via ADMIN_SEED_PASSWORD"
```

---

## Task 7: Teto de linhas no import CSV

**Files:**
- Modify: `backend/src/modules/modalidades/import.service.ts`, `backend/src/modules/municipios/import.service.ts`

- [ ] **Step 1: Cap em modalidades**

Em `backend/src/modules/modalidades/import.service.ts`, dentro de `importarCsv`, logo após `const rows = parseCsv(content)`, antes do `if (rows.length === 0)`, inserir:
```ts
  if (rows.length > 5000) {
    throw Object.assign(new Error('Arquivo CSV excede o limite de 5000 linhas.'), { status: 400 })
  }
```

- [ ] **Step 2: Cap em municipios**

Em `backend/src/modules/municipios/import.service.ts`, dentro de `importarCsv`, logo após `const rows = parseCsv(content)`, antes do `if (rows.length === 0)`, inserir o mesmo bloco:
```ts
  if (rows.length > 5000) {
    throw Object.assign(new Error('Arquivo CSV excede o limite de 5000 linhas.'), { status: 400 })
  }
```

- [ ] **Step 3: Build + test**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/backend" && npm run build && npm run test`
Expected: PASS.

- [ ] **Step 4: Commit**
```bash
git add backend/src/modules/modalidades/import.service.ts backend/src/modules/municipios/import.service.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "fix(security): teto de 5000 linhas no import CSV (DoS)"
```

---

## Task 8: Validação de id em params (helper + sweep)

**Files:**
- Create: `backend/src/lib/parse-id.ts`, `backend/src/lib/parse-id.test.ts`
- Modify: controllers que fazem `Number(req.params.<x>)`

- [ ] **Step 1: Test (falha)**

Create `backend/src/lib/parse-id.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parseIntParam } from './parse-id'

describe('parseIntParam', () => {
  it('retorna o inteiro positivo', () => {
    expect(parseIntParam('5')).toBe(5)
  })
  it('rejeita não-numérico/zero/negativo com status 400', () => {
    for (const v of ['abc', '', undefined, '0', '-3', '1.5', 'NaN']) {
      expect(() => parseIntParam(v as any)).toThrow()
      try { parseIntParam(v as any) } catch (e: any) { expect(e.status).toBe(400) }
    }
  })
})
```

- [ ] **Step 2: Run — FAIL**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/backend" && npm run test -- parse-id`
Expected: FAIL.

- [ ] **Step 3: Implement helper**

Create `backend/src/lib/parse-id.ts`:
```ts
// Converte um parâmetro de rota em inteiro positivo; lança erro 400 se inválido.
export function parseIntParam(value: string | undefined, name = 'id'): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) {
    throw Object.assign(new Error(`Parâmetro ${name} inválido.`), { status: 400 })
  }
  return n
}
```

- [ ] **Step 4: Run — PASS**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/backend" && npm run test -- parse-id`
Expected: PASS.

- [ ] **Step 5: Aplicar no sweep dos controllers**

Em cada controller abaixo, adicionar `import { parseIntParam } from '../../lib/parse-id'` e trocar ocorrências de `Number(req.params.id)` (e outros params numéricos como `req.params.eventoId`, `req.params.evento_id`, `req.params.modalidadeId`) por `parseIntParam(req.params.<x>, '<x>')`. Como cada handler já está em `try/catch` que chama `next(err)`, o erro 400 é tratado pelo `errorHandler`. Arquivos:
- `backend/src/modules/eventos/eventos.controller.ts`
- `backend/src/modules/modalidades/modalidades.controller.ts`
- `backend/src/modules/participantes/participantes.controller.ts`
- `backend/src/modules/inscricoes/inscricoes.controller.ts`
- `backend/src/modules/sorteios/sorteios.controller.ts`
- `backend/src/modules/users/users.controller.ts`
- `backend/src/modules/site-publico/site-publico.controller.ts`
- `backend/src/modules/evento_keys/evento_keys.controller.ts`
- `backend/src/modules/campeoes_anteriores/campeoes_anteriores.controller.ts`

NÃO trocar `Number(req.body.*)` nem `Number(req.query.*)` (esses são validados por zod/resolvers em outro lugar e podem ser opcionais). Apenas `req.params.*` que hoje viram id para o Prisma. Ler cada arquivo e aplicar; se algum já validar o id, deixar como está.

- [ ] **Step 6: Build + test**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/backend" && npm run build && npm run test`
Expected: PASS (suíte inteira — alguns testes de controller podem precisar de ajuste se passavam ids inválidos; nesse caso, corrigir o teste para o novo 400).

- [ ] **Step 7: Commit**
```bash
git add backend/src/lib/parse-id.ts backend/src/lib/parse-id.test.ts backend/src/modules
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "fix(security): validar id de params (400 em vez de NaN/500)"
```

---

## Task 9: .gitignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Adicionar entradas**

Acrescentar ao final de `.gitignore`:
```
# Firebase local cache / artefatos
frontend/.firebase/

# Planilhas e arquivos temporários/ad-hoc (podem conter dados)
*.xlsx
*_tmp.*
backend/migration_script.sql
```

- [ ] **Step 2: Verificar que os arquivos passam a ser ignorados**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2" && git status --porcelain | grep -E "CHAVES CT_tmp.xlsx|migration_script.sql|\.firebase/" || echo "IGNORADOS OK"`
Expected: `IGNORADOS OK` (não aparecem mais como untracked).

- [ ] **Step 3: Commit**
```bash
git add .gitignore
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "chore(security): gitignore para .firebase, xlsx e arquivos temporarios"
```

---

## Task 10: Scrub do segredo de banco em docs

**Files:**
- Modify: `docs/superpowers/plans/2026-05-27-cicd-deploy.md`, `2026-05-28-fundacao.md`, `2026-05-30-bracket-arvore-fiel.md`, `2026-05-30-bracket-por-planilha.md`, `docs/superpowers/specs/2026-06-14-security-hardening-design.md`

- [ ] **Step 1: Substituir a senha por placeholder**

Substituir todas as ocorrências da string `USUARIO:SENHA@HOST` por `USUARIO:SENHA@HOST` nesses arquivos (a senha de banco não deve permanecer em texto). Usar busca/replace direto em cada arquivo. Confirmar com:
Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2" && grep -rl "SENHA_BANCO" docs/ || echo "LIMPO"`
Expected: `LIMPO`.

- [ ] **Step 2: Commit**
```bash
git add docs/
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "chore(security): remover senha de banco dos docs (placeholder)"
```

(Ação manual do Wagner, fora deste plano: rotacionar a senha do Postgres dev e confirmar que não é reusada no Cloud SQL prod; histórico git mantém o valor antigo.)

---

## Self-Review

**1. Spec coverage:** XSS title (T2) ✓; CSV injection (T1) ✓; Firebase headers (T3) ✓; deps (T4) ✓; key login rate limit (T5) ✓; admin seed env (T6) ✓; CSV import caps (T7) ✓; id param validation (T8) ✓; .gitignore (T9) ✓; scrub docs (T10) ✓. Ações manuais (rotacionar senha, trocar admin prod) documentadas.

**2. Placeholder scan:** Sem TBD; blocos completos; T8 é sweep explícito (ler+aplicar com padrão exato).

**3. Type consistency:** `csvCell(value): string` usado por `escapeCsv`/`escape`. `parseIntParam(value, name?): number` (throw 400). `escapeHtml` local no html-shell. `loginRateLimit` importado de `middleware/security`.
