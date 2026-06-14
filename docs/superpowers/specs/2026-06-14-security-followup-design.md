# Security follow-up (pós re-auditoria) — Design

**Data:** 2026-06-14
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Corrigir as pendências da re-auditoria de segurança (após o hardening G1–G4):
1. **ALTO** — formula injection no Excel do relatório de congresso (export server-side).
2. **MÉDIO** — vazamento cross-tenant em 3 GETs de evento (anfitrião-ordem, modalidades, modalidades-excluídas).
3. **MÉDIO** — terminar o sweep de validação de id em params (~13 controllers/guards restantes).
4. **MÉDIO (arquitetural)** — segredo dedicado opcional para o token da chave mobile (`JWT_KEY_SECRET`).

## Item 1 — Excel do congresso: neutralizar fórmula

Em `backend/src/modules/relatorios/relatorio_congresso.service.ts`, valores de nomes (participantes, anfitrião, modalidade) são gravados crus como `.value` de células (`ExcelJS` não neutraliza fórmula). Um nome iniciado por `= + - @` vira fórmula no `.xlsx`.

- Criar helper `backend/src/lib/sheet-safe.ts`:
  ```ts
  // Neutraliza injeção de fórmula em células de planilha: prefixa ' quando
  // o valor (string) começa com = + - @ tab ou CR. Não-strings passam intactos.
  export function sheetSafe<T>(value: T): T | string {
    if (typeof value === 'string' && /^[=+\-@\t\r]/.test(value)) return `'${value}`
    return value
  }
  ```
- Aplicar `sheetSafe(...)` nas atribuições de `.value` que recebem **dados de usuário** (nomes), nas linhas: 76 (`anfitriao`), 89/197/255 (`nome.toUpperCase()` da modalidade), 96/262 (`n` = nome do inscrito), 125/171/173/204/275 (`nomePorPid.get(pid) ?? '—'`). Os rótulos estáticos (cabeçalhos, "Grupos", datas-label, aviso) e numéricos (contagens, `i+1`) **não** precisam.

**Teste:** Vitest na função pura `sheetSafe` (prefixa `=`/`+`/`-`/`@`; mantém normais e não-strings).

## Item 2 — Escopar 3 GETs de evento

Em `backend/src/modules/eventos/eventos.routes.ts`, estes têm só `requireAuth`:
```
router.get('/:id/anfitriao-ordem', requireAuth, anfitriaoOrdem.getAnfitriaoOrdem)
router.get('/:id/modalidades', requireAuth, modalidadesExcluidas.getModalidadesDoEvento)
router.get('/:id/modalidades-excluidas', requireAuth, modalidadesExcluidas.getExcluidas)
```
- Importar `requireAcessoEvento` e definir `const acessoEventoIdParam = requireAcessoEvento(req => Number(req.params.id))`.
- Aplicar `acessoEventoIdParam` aos 3 GETs (ADMIN curto-circuita; CT só acessa eventos atribuídos). Os PUTs já são `...admin`; `GET /:id` (buscarPorId) já checa no controller — não mexer.

## Item 3 — Terminar o sweep de id

Aplicar `parseIntParam(req.params.<x>, '<x>')` (helper `backend/src/lib/parse-id.ts`) nos `Number(req.params.*)` restantes:
- `competicoes.controller.ts`, `delegacias.controller.ts`, `inspetorias.controller.ts`, `municipios.controller.ts`, `tipos_modalidade.controller.ts`, `sistemas_disputa.controller.ts`, `eventos/anfitriao-ordem.controller.ts`, `eventos/modalidades-excluidas.controller.ts`, `key_access/key_access.controller.ts` (`modalidadeDetail`), `relatorios/relatorios.controller.ts`.
- Guards de rota com `findUnique({ where: { id: Number(req.params.id) } })`: `campeoes_anteriores.routes.ts`, `inscricoes.routes.ts`, `sorteios.routes.ts` — aqui o resolver retorna `null` para id inválido (não lançar dentro do resolver); manter o padrão atual (NaN → resolver retorna null → 400 do middleware) **ou** validar com `Number.isInteger`. Para esses guards, basta garantir que id inválido vire `null` (já vira, pois `findUnique` com NaN lança e é pego pelo `try/catch` do middleware → next(err) → 500). Para consistência, trocar para: `const n = Number(req.params.id); return Number.isInteger(n) && n > 0 ? (await prisma...).evento_id ?? null : null`. (Evita o 500.)
- Regra: **só** `req.params.*` numéricos; não tocar `req.body`/`req.query`. Onde já houver validação inline, deixar.

## Item 4 — `JWT_KEY_SECRET` (opcional, sem quebrar boot)

Em `backend/src/lib/key-jwt.ts`, usar um segredo dedicado **com fallback** para `JWT_SECRET` (sem nova env obrigatória; sem alterar o boot):
```ts
const KEY_SECRET = process.env.JWT_KEY_SECRET ?? process.env.JWT_SECRET!
```
e usar `KEY_SECRET` no `signKeyToken`/`verifyKeyToken` (mantendo `algorithm: 'HS256'`/`algorithms: ['HS256']`). Documentar `JWT_KEY_SECRET` (opcional) no `backend/.env.example`. Para separação real em prod, criar depois o secret `PROD_JWT_KEY_SECRET` e wirear (fora do escopo deste código; opcional).

## Testes

- **Backend:** Vitest — `sheetSafe` (puro); `parse-id` já testado; demais por build + suíte. `npm run build` + `npm run test`.
- **Manual:** export do Excel do congresso com um nome iniciado por `=` → célula vira texto (`'=...`), não fórmula; CT não consegue ler anfitrião-ordem/modalidades de evento não atribuído (403); ids inválidos → 400.
- Sem migration. Frontend inalterado.

## Fora de escopo
- Upgrade breaking de `vite@8`/`exceljs` (deps) — planejamento à parte.
- Tornar `JWT_KEY_SECRET` obrigatório (fica opcional com fallback).
- Scrub do `erp0192` no `.claude/settings.local.json` (arquivo local não versionado — ação manual do Wagner).
- Enumeração por timing no login; CSP `unsafe-inline` em styles (info).
