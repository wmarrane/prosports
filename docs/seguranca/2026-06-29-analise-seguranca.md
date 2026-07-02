# Análise de Segurança — prosports_v2 (aplicação + arquitetura GCP)

**Data:** 2026-06-29
**Escopo:** Backend (Node/Express + Prisma), site público SSG, e a arquitetura de produção no GCP.
**Natureza:** Análise read-only (nenhum código foi alterado nesta atividade). Achados com evidência `arquivo:linha` quando aplicável.
**Revisão (2026-06-29):** todos os achados de aplicação foram verificados manualmente contra o código. Resultado: A1–A7 e A9–A12 confirmados; **A8 rebaixado para falso positivo** (o slug remove tudo exceto `[a-zA-Z0-9]` — ver nota em "Baixo"). Pontos fortes conferidos por amostragem (bcrypt 12, `requireSameOrigin`, `validarSegredos`).

## Sumário executivo

A postura geral é **boa**: há hardening prévio sólido — rotação de refresh token com revogação no Redis, bcrypt (cost 12), lockout de conta, CORS por allowlist, Helmet/HSTS/CSP na API, validação Zod em todos os writes, ausência de SQL raw e guards de IDOR consistentes. Os itens abaixo são melhorias incrementais.

Os riscos de maior impacto:
- Upload de PDF sem validação de conteúdo real, combinado com bucket GCS público.
- Falta de CSP no site público (Firebase).
- VM única multi-tenant + runner self-hosted na VM de produção (blast radius).
- Escopo/segregação de secrets e least-privilege da Service Account.

## Metodologia

- Revisão do código da camada de auth/autorização (`backend/src/modules/auth`, middleware, rotas, `index.ts`).
- Revisão de entrada/validação, upload de arquivo, renderização (SSG), headers HTTP e higiene de config.
- Arquitetura GCP a partir do estado conhecido do projeto (VM, Cloud SQL, WIF, Firebase, Caddy, bucket GCS, secrets de CI) e dos arquivos `docker-compose.prod.yml` / workflows.

---

## Achados — Aplicação

### Alto

**A1. Upload de PDF sem checagem de magic bytes**
`backend/src/lib/upload-pdf.ts:9-12`
O `fileFilter` do multer valida apenas `file.mimetype` (header do cliente) e a extensão — ambos falsificáveis. Como o bucket GCS é público, qualquer conteúdo aceito fica imediatamente world-readable.
**Correção:** antes de `storage.put()`, exigir que `file.buffer.subarray(0,4)` seja `%PDF`.

**A2. Site público (Firebase) sem Content-Security-Policy**
`frontend/firebase.json` (target `publico`)
O target tem `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` e HSTS, mas **não** tem CSP. O site injeta GTM e blocos `<script>` inline (SSG).
**Correção:** adicionar `Content-Security-Policy` (ex.: `script-src 'self' https://www.googletagmanager.com 'sha256-<hash-do-inline>'; object-src 'none'; base-uri 'none'`).

### Médio

**A3. `JWT_KEY_SECRET` cai para `JWT_SECRET` silenciosamente**
`backend/src/lib/key-jwt.ts:6` — `process.env.JWT_KEY_SECRET ?? process.env.JWT_SECRET!`; não é exigido em `validarSegredos()` (`backend/src/index.ts`).
Tokens de "chave do evento" podem compartilhar o segredo dos tokens de sessão se `JWT_KEY_SECRET` não estiver setado.
**Correção:** exigir `JWT_KEY_SECRET` presente e distinto em produção no boot.

**A4. `/uploads` servido sem autenticação**
`backend/src/index.ts:45` — `app.use('/uploads', express.static(UPLOADS_DIR))` antes de qualquer auth.
Arquivos acessíveis por URL (nomes são UUID, o que mitiga). Em prod, boletins vão para o GCS; resta confirmar o que fica em `/uploads` (logos etc.).
**Correção:** confirmar que só há conteúdo público ali; servir o que for sensível por rota autenticada.

**A5. Container do backend roda como root**
`backend/Dockerfile` (sem diretiva `USER`).
**Correção:** criar usuário não-root (`adduser -S app` / `USER app`) antes do `CMD`.

**A6. Bucket GCS de boletins é público (`allUsers:objectViewer`)**
`backend/src/lib/storage/gcs.ts` + `backend/src/modules/boletins/boletins.service.ts:23`
Para boletins **oficiais** o acesso público é **por design** (o site público linka os PDFs). O risco é um upload sensível acidental ficar world-readable em URL adivinhável (`eventos/{id}/boletim-{numero}-{uuid}.pdf`).
**Correção:** manter público para boletins, mas somar A1 (validação) e avaliar signed URLs de TTL curto caso surja documento restrito.

**A7. `trust proxy 1` sem verificação de topologia**
`backend/src/index.ts:37`; rate-limit em `backend/src/middleware/security.ts`.
`req.ip` confia no 1º `X-Forwarded-For`. Se o backend for alcançável sem o proxy, dá para spoofar IP e furar o rate limit. O lockout por conta (no DB) mitiga o caso de login.
**Correção:** garantir/documentar que só o Caddy fala com o `:3000`; complementar o login limit com chave por e-mail.

### Baixo

**A8. [FALSO POSITIVO após verificação] `Content-Disposition` no relatório**
`backend/src/modules/relatorios/relatorios.controller.ts:24` interpola o nome em `filename="..."`, mas `nomeArquivo()` (`relatorio_congresso.service.ts:333-339`) normaliza NFD e aplica `replace(/[^a-zA-Z0-9]+/g, '_')` + `slice(0,60)` — **nenhuma aspa/control char sobrevive**; não há injeção de header no código atual. Opcional (defesa em profundidade): migrar para `filename*=UTF-8''…` caso o slug mude no futuro.

**A9.** `file.originalname` gravado sem sanitização (`backend/src/modules/boletins/boletins.service.ts:29,77`) — só vira XSS se renderizado sem escape depois (o object key usa UUID, então o FS é seguro). **Correção:** sanitizar/limitar ao gravar.

**A10.** Roles `PARTICIPANTE`/`VIEWER` existem no schema (`backend/src/modules/users/users.schemas.ts:3`) mas sem semântica de acesso; rotas `requireAuth`-only ficam acessíveis a elas. **Correção:** documentar/estreitar o modelo de acesso.

**A11.** GA measurement ID hardcoded (`frontend/src/site-publico/html-shell.ts`) — baixo (já é público no HTML). **Correção:** injetar via env de build.

**A12.** Cookie de refresh no formato `jti::token` (`backend/src/modules/auth/auth.controller.ts:34,49`) — funcional, mas cria dependência de parsing. **Correção (opcional):** cookies separados.

---

## Achados — Arquitetura GCP

### Alto

**G1. VM única multi-tenant**
A mesma `prosports-vm` (e2-micro, us-central1-a) hospeda vários projetos não relacionados (ateliei9, r2p, webhookmonitor, eletrodocmonitor) no mesmo Docker/usuário. Comprometer **um** app = acesso ao host e à **Service Account da VM** (`prosports@newprosports.iam.gserviceaccount.com`), que tem `storage.objectAdmin` no bucket + acesso ao Cloud SQL. Blast radius alto.
**Correção:** isolar o prosports (VM/projeto próprio) ou, no mínimo, containers com usuário/limites e uma SA dedicada de menor privilégio.

**G2. Runner self-hosted na VM de produção**
O runner do GitHub Actions roda na própria VM e executa os workflows com acesso ao host e à SA. Um workflow/dependência comprometido alcança tudo.
**Correção:** runner efêmero/isolado (ou hospedado); jamais auto-executar workflow de PR vindo de fork.

### Médio

**G3. Escopo dos secrets de CI**
Secrets sensíveis (`PROD_DATABASE_URL`, `PROD_JWT_SECRET`, `DATABASE_URL`, `JWT_SECRET`) estão em **repo-level** (disponíveis a qualquer workflow); apenas `PROD_JWT_REFRESH_SECRET` está no environment `production`.
**Correção:** mover os secrets de prod para o environment `production` (com required reviewers) e remover do escopo do repo os de dev não usados.

**G4. Least-privilege da SA da VM**
Confirmar que `prosports@newprosports.iam.gserviceaccount.com` não tem papel amplo (ex.: Editor).
**Correção:** restringir a exatamente `roles/cloudsql.client` + binding de `storage.objectAdmin` no bucket.

**G5. Cloud SQL — exposição e backups**
Confirmar que a instância é **somente IP privado** (via proxy) e sem IP público; validar que os backups automáticos estão ativos (pendência antiga do deploy).

**G6. Firewall / SSH**
`allow-http-https` libera 80/443 de qualquer IP (ok para web). Verificar se a **porta 22 (SSH)** está aberta ao mundo — se sim, restringir por IP de origem ou usar IAP. Confirmar que portas de app (3000/3100/8080/8081/8090/3010…) **não** estão expostas externamente.

**G7. Sem WAF/rate-limit na borda**
O Caddy só faz TLS + proxy reverso.
**Correção:** rate-limit/regras básicas no Caddy à frente do backend.

### Baixo / Resiliência

**G8.** e2-micro sem redundância; Cloud SQL ligada/desligada manualmente (site dá 500 quando parada) — disponibilidade, não confidencialidade.
**G9.** Baseline de migrations pendente (risco operacional em DB limpo).

---

## Pontos fortes (já sólidos)

- Rotação de refresh token com revogação no Redis + detecção de reuse (revogação total + `authEpoch`).
- Lockout de conta (5 tentativas → 15 min, persistido no DB); bcrypt cost 12; troca/reset de senha revoga todas as sessões.
- `JWT_SECRET` ≠ `JWT_REFRESH_SECRET`, mínimo 32 chars em prod, `process.exit` no boot se violado.
- CSRF (`requireSameOrigin`) em `/refresh` e `/logout`; CORS por allowlist (bypass de LAN só fora de produção).
- IDOR: recursos por evento resolvem `evento_id` do DB e passam por `requireAcessoEvento` — não confiam no id do cliente.
- Sem SQL raw (tudo Prisma tipado); Zod em todos os writes; `parseIntParam` nos params numéricos.
- Hardening de fórmula em XLSX (`sheetSafe`); parser de CSV próprio.
- Guard de path traversal em `deleteFile` (`path.resolve` + `startsWith`); upload de imagem salva com UUID (ignora `originalname` no FS).
- Helmet + HSTS + CSP na API; rate limit global (200/min) e de login (20/15min, pula sucessos).
- Autenticação GCP via WIF (sem chaves de SA), pool restrito ao repo `wmarrane/prosports`.

---

## Roadmap sugerido (esforço × impacto)

### Ganhos rápidos (1 PR cada, baixo risco)
1. **A1** — magic-byte `%PDF` no upload (Alto, trivial). Em `criarBoletim`/`substituirBoletim` (ou no próprio `upload-pdf.ts` via validação pós-multer): rejeitar com 400 se `!file.buffer.subarray(0, 4).equals(Buffer.from('%PDF'))`.
2. **A2** — CSP no `firebase.json` (target `publico`) (Alto). Ponto de atenção: os `<script>` inline do SSG exigem hashes `'sha256-…'` na `script-src` (ou mover os scripts para arquivos servidos do próprio site); incluir `https://www.googletagmanager.com` para o GA4 e `connect-src` para `google-analytics.com`.
3. **A5** — `USER` não-root no `backend/Dockerfile` (Médio): `RUN addgroup -S app && adduser -S app -G app` + `USER app` antes do `CMD` (atenção a permissões de `/app/uploads` e do volume).
4. **A3** — exigir `JWT_KEY_SECRET` presente e **distinto** de `JWT_SECRET` em `validarSegredos()` quando `NODE_ENV=production` (Médio). Pré-requisito de deploy: criar o secret `PROD_JWT_KEY_SECRET` e passar no compose/workflow **antes** de promover, senão o boot de prod falha.
5. **A9** — sanitizar `originalname` ao gravar (strip de control chars, limite ~150 chars) (Baixo). *(A8 dispensado após verificação — o slug já remove tudo exceto `[a-zA-Z0-9]`.)*

### Config GCP (sem código; requer acesso do Wagner)
6. **G3** mover secrets de prod para o environment `production`; **G4** auditar/estreitar papéis da SA; **G5** confirmar Cloud SQL sem IP público + backups; **G6** fechar/restringir SSH e portas de app.

### Estrutural (maior esforço)
7. **G1/G2** separar o prosports do host multi-tenant e/ou runner efêmero isolado; **G7** rate-limit no Caddy.

---

## Comandos de verificação GCP (rodar no PowerShell / Cloud Shell, projeto `newprosports`)

```powershell
# G4 — papéis da SA da VM no projeto
gcloud projects get-iam-policy newprosports --flatten="bindings[].members" --filter="bindings.members:prosports@newprosports.iam.gserviceaccount.com" --format="table(bindings.role)"

# G5 — Cloud SQL: IP público? backups?
gcloud sql instances list --project newprosports
gcloud sql instances describe <INSTANCIA> --project newprosports --format="yaml(settings.ipConfiguration, settings.backupConfiguration)"

# G6 — regras de firewall (procurar 22 aberto a 0.0.0.0/0)
gcloud compute firewall-rules list --project newprosports --format="table(name, sourceRanges.list(), allowed[].map().firewall_rule().list(), targetTags.list())"

# G3 — escopo dos secrets (repo vs environment production)
gh secret list
gh secret list --env production
```

## Itens que não pude verificar daqui (dependem de acesso GCP)
- Papéis exatos da SA da VM (G4).
- IP público/privado e backups do Cloud SQL (G5).
- Regras de firewall / exposição de SSH e portas de app (G6).

## Fora de escopo desta análise
- Pentest ativo / varredura dinâmica.
- Revisão de dependências (SCA/`npm audit`) — recomendável como follow-up.
- LGPD/privacidade de dados dos participantes — recomendável avaliar separadamente.
