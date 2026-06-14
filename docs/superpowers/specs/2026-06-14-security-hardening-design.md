# Security Hardening — Design

**Data:** 2026-06-14
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Corrigir os achados da auditoria de segurança do sistema em produção, cobrindo autenticação/sessão, controle de acesso, XSS/CSV, configuração/segredos, headers e dependências. Inclui as 4 melhorias de defesa-em-profundidade aprovadas (revogação de access token no logout, rotação de refresh, CSRF em refresh/logout, encurtar token da chave mobile).

## Escopo e ordem de execução

Agrupado por área (cada grupo é um conjunto de tarefas pequenas e testáveis). Ordem recomendada:

1. **Access control (IDOR)** — Alto, isolado, baixo risco.
2. **Auth/sessão** — Crítico/Alto + os 4 itens profundos; inclui correção de bug latente do refresh. Maior risco; validar em dev antes de prod.
3. **Web hardening** — XSS no site público, CSV injection, headers Firebase, deps.
4. **Higiene/config** — segredos em docs, seed admin, rate limit da chave, validação de id, teto de CSV, .gitignore.

---

## Grupo 1 — Access control / IDOR (Alto)

**Problema:** rotas de **leitura** de inscrições/sorteios/campeões usam só `requireAuth`; um usuário `COMISSAO_TECNICA` lê dados de **qualquer** evento. As escritas já são escopadas por `requireAcessoEvento`.

**Correção** — aplicar `requireAcessoEvento(resolver)` (já existe em `backend/src/middleware/evento-acesso.ts`) nestes GETs:
- `inscricoes.routes.ts`: `GET /counts` (resolver `req.query.evento_id`), `GET /` (resolver `req.query.evento_id`), `GET /:id` (resolver busca `inscricao.evento_id` por `req.params.id`).
- `sorteios.routes.ts`: `GET /` (resolver `req.query.evento_id`), `GET /:id` (resolver busca `sorteio.evento_id`).
- `campeoes_anteriores.routes.ts`: `GET /` (resolver `req.query.evento_id`).

Para ADMIN, `usuarioTemAcessoAoEvento` já retorna `true` (sem regressão). Resolver deve retornar `number | null`; quando o `evento_id` não vier (ex.: `GET /` sem filtro), decidir: para CT exigir `evento_id` (400 se ausente) — ADMIN não chega a precisar pois passa direto. Como `requireAcessoEvento` hoje dá 400 sem evento_id mesmo para ADMIN, ajustar o middleware para **liberar ADMIN antes de exigir o evento_id** (ADMIN não é escopado). Confirmar esse comportamento ao implementar.

**Testes:** Vitest (mock prisma) — CT sem acesso recebe 403 nos GETs; ADMIN segue; resolver por `:id` busca o evento certo.

---

## Grupo 2 — Autenticação / Sessão

### 2.1 Pin de algoritmo (Crítico)
Em todos os `jwt.verify`: passar `{ algorithms: ['HS256'] }`.
- `auth.service.ts:87` (refresh), `auth.service.ts:131` (`verifyAccess`), `lib/key-jwt.ts:18` (`verifyKeyToken`).
- Nos `jwt.sign`, fixar `algorithm: 'HS256'` (explícito) em access, refresh e key.

### 2.2 Segredos JWT (Alto)
- Remover o fallback `REFRESH_SECRET = ACCESS_SECRET + '_refresh'` (`auth.service.ts:8`). Exigir `JWT_REFRESH_SECRET` distinto.
- Validação no boot (`backend/src/index.ts` `start()`): exigir `JWT_SECRET` e `JWT_REFRESH_SECRET` presentes, `>= 32` chars, e diferentes do valor de exemplo; senão `process.exit(1)` com mensagem clara.
- Atualizar `.env.example` com `JWT_REFRESH_SECRET`.

### 2.3 Correção do bug latente do refresh + rotação (item B, Alto)
**Bug atual:** `signRefresh` não inclui `jti`; `login` grava `refresh:{id}:{jtiAleatório}` mas `refresh()` lê `refresh:{sub}:{payload.jti}` (undefined) → refresh sempre 401. O `jti` existe só no cookie (`jti::token`).

**Correção (rotação):**
- `signRefresh(payload, jti)` passa a assinar com `{ jwtid: jti, algorithm: 'HS256', expiresIn }` — o `jti` entra no JWT.
- `login`: gera `refreshJti = randomUUID()`, assina refresh com esse jti, grava `refresh:{id}:{jti}` (igual hoje). Mantém o cookie `jti::token` (ou passa a depender só do JWT; manter compat).
- `refresh(refreshToken)`: verifica (com alg pin) → lê `jti` do payload → busca `refresh:{sub}:{jti}`:
  - Se não existir/!=token → **possível reuse**: revogar todas as sessões do usuário (`revogarTodosRefreshTokens`) + setar `authEpoch` (2.4) → 401.
  - Se válido → **rotaciona**: `del` da chave antiga, gera novo `jti`+refresh, grava nova chave, retorna `{ accessToken, refreshToken, refreshJti }`.
- `refreshHandler` (controller): re-setar o cookie com o novo `jti::refreshToken` rotacionado.

### 2.4 Revogação de access token no logout / "sair de todos" (item A, Médio)
Sem migration — usar Redis + `jti`/`iat` do access:
- `signAccess`: incluir `jwtid: randomUUID()`. (`iat` é automático.)
- `requireAuth` (vira **async**): após `verifyAccess` (alg pin), checar:
  - `denyAccess:{jti}` existe → 401 (token revogado individualmente).
  - `authEpoch:{sub}` existe e `token.iat < authEpoch` → 401 (revogação global).
- `logout`: além de apagar o refresh, gravar `denyAccess:{accessJti}` com TTL = tempo restante do access (derivar de `exp`). O `accessJti` vem de `req.user.jti` (logout é autenticado).
- `revogarTodosRefreshTokens` (logout-all/troca de senha): também setar `authEpoch:{userId} = now` (segundos).
- Nota de performance: adiciona 1–2 leituras Redis por request autenticado (Redis já é usado). Aceitável.

### 2.5 CSRF em /auth/refresh e /auth/logout (item C, Médio)
- Novo middleware `requireSameOrigin` (ou checagem inline) que valida `Origin` (fallback `Referer`) contra a allowlist `CORS_ORIGINS`. Aplicar em `POST /auth/refresh` e `POST /auth/logout`. Sem Origin/Referer ou fora da allowlist → 403. (Em prod o cookie é `SameSite=None`, então CORS é a única proteção hoje; isto reforça.)

### 2.6 Encurtar token da chave mobile (item D, Médio)
- `lib/key-jwt.ts:3`: `EXPIRES` de `'365d'` para `'7d'`. O acesso já expira 24h após o evento (re-checado no `requireEventoKey`); 7d é folga segura. Re-login no mobile é simples (link + email).

### 2.7 Itens menores de auth (Baixo)
- (Opcional, já mitigado) timing de enumeração no login — manter como está; não alterar fluxo de bloqueio.

**Testes (Grupo 2):** Vitest mock prisma/redis — alg pin rejeita `alg:none`; refresh rotaciona e detecta reuse; `requireAuth` bloqueia jti em denyAccess e iat < authEpoch; CSRF middleware 403 fora da allowlist; boot falha sem segredos. Mock do `redis` lib.

---

## Grupo 3 — Web hardening

### 3.1 XSS no site público (Médio)
- `frontend/src/site-publico/html-shell.ts:7`: o `<title>${opts.title}</title>` interpola o **nome do evento** cru. Escapar com um `escapeHtml` (reusar/extrair o de `export-html.ts`). Idealmente também sanitizar `ev.nome` no snapshot.

### 3.2 CSV formula injection (Médio)
- `frontend/src/pages/Relatorio.tsx` (`escapeCsv`) e `frontend/src/lib/csv-template.ts` (`escape`): além do RFC-4180, prefixar com `'` qualquer célula iniciando em `= + - @`, tab ou CR. Extrair um helper compartilhado e testar (função pura).

### 3.3 Headers de segurança no Firebase (admin SPA) (Médio)
- `frontend/firebase.json` (target admin): adicionar bloco `headers` para `**` com `X-Frame-Options: DENY` (ou CSP `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security`. Avaliar headers equivalentes para o target do site público.

### 3.4 Dependências (Médio/Baixo)
- `frontend`: `npm audit fix` para o advisory de open redirect do `react-router`/`react-router-dom` (bump não-breaking). Rodar `npm run build` + testes após.
- `backend`: advisory moderate do `uuid` via `exceljs` — apenas registrar (fix é breaking); não alterar agora.

**Testes (Grupo 3):** função pura de neutralização CSV (Vitest); `npm run build`; verificação manual do `<title>` e dos headers.

---

## Grupo 4 — Higiene / config

### 4.1 Segredo de banco em docs (Alto)
- Substituir a string `postgresql://USUARIO:SENHA@HOST:5432/newprosports` por um placeholder (`postgresql://USER:SENHA@HOST:5432/DB`) nos arquivos `docs/superpowers/plans/2026-05-27-cicd-deploy.md`, `2026-05-28-fundacao.md`, `2026-05-30-bracket-por-planilha.md`, `2026-05-30-bracket-arvore-fiel.md`.
- **Ação manual do Wagner (fora do código):** rotacionar a senha do usuário `prosports` no Postgres de dev e confirmar que **não** é reusada no Cloud SQL de prod. (Histórico git permanece; reescrita opcional.)

### 4.2 Seed do admin (Médio)
- `backend/prisma/seed.ts`: a senha do admin passa a vir de `ADMIN_SEED_PASSWORD` (env). Em produção, falhar se ausente; em dev, permitir um default com aviso no log. **Ação manual:** confirmar que a senha do admin em prod foi trocada de `admin123`.

### 4.3 Rate limit na chave mobile (Médio)
- `key_access.routes.ts`: aplicar `loginRateLimit` (já existe em `middleware/security.ts`) ao `POST /login`.

### 4.4 Validação de id em params (Baixo)
- Criar helper `parseIdParam(req, name)` (ou zod `z.coerce.number().int().positive()`) retornando 400 em vez de deixar `NaN` chegar ao Prisma (→ 500). Aplicar nos controllers que fazem `Number(req.params.id)` sem checagem (eventos, modalidades, participantes, inscricoes, users, sorteios, site-publico, evento_keys). Mudança mecânica e ampla.

### 4.5 Teto de linhas no import CSV (Baixo)
- `backend/src/modules/modalidades/import.service.ts` e `municipios/import.service.ts`: limitar `rows.length` (ex.: 5000) e/ou processar em lote. Os imports JSON já têm teto.

### 4.6 .gitignore (Baixo)
- Adicionar `frontend/.firebase/`, `*.xlsx`, `*_tmp.*` e `backend/migration_script.sql` ao `.gitignore` para evitar commit acidental do `CHAVES CT_tmp.xlsx` (pode conter dados pessoais) e artefatos.

---

## Fora de escopo / ações manuais (não-código)
- Rotacionar a senha do Postgres de dev e do Cloud SQL prod (4.1).
- Trocar/confirmar a senha do admin em produção (4.2).
- Reescrita de histórico git para remover segredos (opcional).
- Atualização breaking do `exceljs`/`uuid` (3.4).

## Estratégia de validação e deploy
- Implementar por grupo, com testes; `npm run build` (front e back) + suíte a cada tarefa.
- Push em `develop` (deploy dev) e **validar bem o login/refresh/logout no dev** antes de promover (o Grupo 2 muda auth — risco de deslogar usuários). Promoção para `main` só após validação explícita, e exige `JWT_REFRESH_SECRET` configurado no ambiente de prod (senão o boot falha por 2.2).
