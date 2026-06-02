# Acesso Mobile via Chave — Design

**Data:** 2026-06-02
**Versão alvo:** v1.46.0
**Autor:** Wagner Marrane (brainstorming colaborativo)

## Visão geral

Convidados externos (sem cadastro no sistema) acessam um evento via **link único + QR code** no celular para acompanhar inscritos, campeões anteriores e resultado dos sorteios em **tempo real (polling 15s)**, em modo **somente leitura**.

A chave:
- É gerada pelo admin no `EventoForm`
- Identifica o convidado por **email** (único por evento)
- Trava no **primeiro device** que a usa (fingerprint armazenado no banco)
- Permanece válida **até o admin revogar**
- Tem auditoria visível (`device_label`, `last_seen_at`)

Não há envio automático de email. O admin copia o link/QR e envia manualmente (WhatsApp, etc).

## Schema

Novo model `EventoKey`:

```prisma
model EventoKey {
  id              Int       @id @default(autoincrement())
  token           String    @unique           // UUID v4 base62, ~22 chars
  email           String                       // identifica o convidado
  evento          Evento    @relation(fields: [evento_id], references: [id], onDelete: Cascade)
  evento_id       Int
  device_fp       String?                      // null = ainda não usada
  device_label    String?                      // ex: "iPhone Safari" (parsed do UA)
  first_used_at   DateTime?
  last_seen_at    DateTime?
  revogado_em     DateTime?                    // null = ativa
  criado_em       DateTime  @default(now())
  criada_por      Int                          // user.id do admin que criou
  criador         User      @relation(fields: [criada_por], references: [id])

  @@unique([evento_id, email])
  @@index([evento_id])
  @@index([token])
}
```

`Evento` ganha `event_keys EventoKey[]` no bloco de relations.
`User` ganha `event_keys_criadas EventoKey[]` no bloco de relations.

Migration: `20260602000000_evento_keys` (timestamp pode ser ajustado no momento da criação).

## Backend

### Rotas admin (`requireAuth` + `requireRole('ADMIN')`)

| Método | Rota | Body / Params | Retorno |
|---|---|---|---|
| `GET` | `/eventos/:id/keys` | — | `EventoKey[]` (do evento) |
| `POST` | `/eventos/:id/keys` | `{ email }` | `EventoKey` criada |
| `POST` | `/eventos/:id/keys/:keyId/revoke` | — | `EventoKey` com `revogado_em` |
| `POST` | `/eventos/:id/keys/:keyId/reset-device` | — | `EventoKey` com `device_fp=null` |
| `DELETE` | `/eventos/:id/keys/:keyId` | — | `204` (só se `device_fp IS NULL`) |

Validação Zod no controller: email valida formato; `:keyId` precisa pertencer ao `:id` do evento (senão 404).

Erros mapeados:
- P2002 `(evento_id, email)` → 409 "Já existe chave para este email neste evento"
- `apagar` quando `device_fp != null` → 409 "Esta chave já foi usada; use Revogar ao invés de Apagar"

### Rotas públicas — `/key-access/*` (sem JWT do admin)

| Método | Rota | Body / Header | Retorno |
|---|---|---|---|
| `POST` | `/key-access/login` | `{ token, device_fp, device_label }` | `{ keyToken, evento }` |
| `GET` | `/key-access/me` | `Bearer <keyToken>` | `{ evento, valido }` (touch `last_seen_at`) |
| `GET` | `/key-access/modalidades` | `Bearer <keyToken>` | `Modalidade[]` do evento da chave |
| `GET` | `/key-access/modalidade/:id` | `Bearer <keyToken>` | `{ modalidade, inscritos, campeoes, sorteio }` |

Auth: middleware novo `requireEventoKey` extrai bearer, valida JWT (reusa `JWT_SECRET` existente; o campo `type: 'event-key'` no payload distingue de tokens de admin), carrega `EventoKey + Evento` e injeta em `req.eventoKey`. Se um token tipo `'access'` (admin) bater nessa rota, middleware retorna 401.

JWT do convidado:
- Expira em **365 dias** (longa, mas é invalidada na hora por `revogado_em` checado em cada request)
- Payload: `{ type: 'event-key', keyId, eventoId, deviceFp }`
- Sign com `JWT_SECRET` (mesma var de env já configurada)

**Mecânica do first-use lock** (em `POST /key-access/login`):

```
1. Find EventoKey where token=X AND revogado_em IS NULL
2. Se não achou → 401 { code: 'invalid_or_revoked' }
3. Se key.device_fp IS NULL:
   - UPDATE device_fp = body.device_fp,
            device_label = body.device_label,
            first_used_at = NOW()
4. Else if key.device_fp !== body.device_fp:
   - 403 { code: 'device_mismatch', message: 'Esta chave já está em uso em outro aparelho. Solicite ao organizador o reset.' }
5. UPDATE last_seen_at = NOW()
6. Gera keyToken JWT
7. Retorna { keyToken, evento: { id, nome, data_hora, local, logo_url, competicao: { subtitulo_campos } } }
```

**Touch `last_seen_at`**: cada GET autenticado faz `UPDATE EventoKey SET last_seen_at = NOW() WHERE id = X` em background (não bloqueia resposta). Em volume alto seria worth batch — agora `await` direto é OK.

**Reads** (`/modalidades`, `/modalidade/:id`):
- `modalidades` é igual ao `modalidadesService.listar({competicao_id})` mas filtrado pelo `evento.competicao_id` da chave
- `modalidade/:id` valida que a modalidade pertence à competição do evento da chave (senão 404 — não vaza inferência)
- Carrega `participantes` com deep-include `{ municipio, inspetoria, delegacia }` (mesmo padrão de v1.39.2)
- Inclui `sorteio` se já realizado para aquela modalidade

### Tests (Vitest)

**`eventoKey.service.test.ts`**
- `criar` rejeita email duplicado no mesmo evento (P2002 → 409)
- `criar` aceita mesmo email em eventos diferentes
- `revogar` preenche `revogado_em`
- `resetDevice` zera `device_fp` + `first_used_at` + `device_label`, preserva email + token
- `apagar` rejeita 409 se `device_fp != null`
- `apagar` apaga se `device_fp IS NULL`

**`keyAccess.service.test.ts`**
- `login` com token inválido → 401
- `login` com token revogado → 401
- `login` first-use grava `device_fp` + `first_used_at`
- `login` re-acesso com mesmo `device_fp` → sucesso, atualiza `last_seen_at`
- `login` com `device_fp` diferente → 403
- `getModalidades` lista só do evento da chave
- `getModalidadeDetail` rejeita modalidade de outra competição → 404
- `getModalidadeDetail` retorna participantes com municipio/inspetoria/delegacia nested
- `getModalidadeDetail` inclui sorteio quando existe, omite quando não

## Frontend — Admin (EventoForm)

Novo card **"Acesso mobile"** abaixo do card "Logotipo do evento", visível apenas em `isEdit`:

**Header:**
- Ícone 🔑 + título + descrição curta

**Bloco "Nova chave":**
- Input email + botão "Gerar chave" (chama `POST /eventos/:id/keys`)
- Validação email com Zod no client
- onSuccess: nova chave aparece no topo da lista; modal automático mostrando QR/link da chave criada

**Bloco "Chaves emitidas":**

Lista de cards verticais; cada chave mostra:

| Estado | Indicador | Texto | Ações |
|---|---|---|---|
| Ativa, não usada | 🟢 | "Nunca acessada" | `📋 copiar link` `📲 QR` `🗑 apagar` |
| Ativa, em uso | 🔵 | "{device_label} · {last_seen_at relativo}" | `📋 copiar link` `📲 QR` `🔄 reset device` `🚫 revogar` |
| Revogada | ⚪ (riscada) | "Revogada {revogado_em relativo}" | nenhuma (read-only) |

**Modal QR**: overlay grande com QR (lib `qrcode` ~5KB) + link copiável em fonte mono. Pensado para projetar e convidado escanear.

**Modais de confirmação** (padrão do sistema, danger-soft):
- "Revogar chave?" — explica que convidado é deslogado na próxima request
- "Resetar device?" — explica que próximo acesso será first-use
- "Apagar chave?" — só se nunca usada

**URL pattern**: `https://<host>/e/{token}` (mobile abre direto)

**Lib QR**: `qrcode.react` (~10KB gzip). API React-friendly: `<QRCodeSVG value={url} size={240} />`. SVG inline, sem dataURL.

## Frontend — Mobile (`/e/{token}`)

### Arquitetura

- **Rota nova**: `/e/:token` no `App.tsx`, FORA do `<Layout>` (sem sidebar/topbar)
- **Pages**:
  - `MobileLogin.tsx` — recebe `:token` da URL, chama `POST /key-access/login` com device_fp gerado, persiste `keyToken` em localStorage, redireciona pra `/m/modalidades`
  - `MobileModalidades.tsx` — lista de modalidades do evento
  - `MobileModalidade.tsx` — detalhe da modalidade selecionada (3 tabs)
- **Layout shared**: `MobileShell.tsx` — header sticky com logo + nome evento + botão sair
- **Service**: `keyAccessService.ts` — métodos `login`, `me`, `modalidades`, `modalidade(id)`
- **Auth interceptor**: novo axios instance `apiKey` (separado do `api` admin), injeta `Bearer <keyToken>` do localStorage; on 401 ou 403 limpa storage e redireciona pra `/e/{token}` original

### Device fingerprint

Gerado client-side, uma vez por device:

```ts
function getDeviceFingerprint(): string {
  let fp = localStorage.getItem('prosports.device_fp')
  if (!fp) {
    fp = crypto.randomUUID()
    localStorage.setItem('prosports.device_fp', fp)
  }
  return fp
}

function getDeviceLabel(): string {
  // Parse simples do User-Agent: extrai "iPhone Safari", "Android Chrome", "Windows Edge", etc.
  // Bibliotecas tipo bowser ou ua-parser-js seriam overkill; um regex pequeno basta.
}
```

UUID é estável até o usuário limpar localStorage. Não é fingerprint forte (não é anti-fraude), só identifica "mesmo browser + mesma instalação".

### Polling

`MobileModalidade` usa React Query com `refetchInterval: 15000` na query `modalidade/:id`. Pausa quando aba está em background (`refetchIntervalInBackground: false`). Botão refresh no header chama `queryClient.invalidateQueries`.

### Tabs

3 abas: `Inscritos | Campeões | Sorteio`. Aba Sorteio fica disabled (visualmente acinzentada, clicável mas mostra mensagem) quando:
- `modalidade.tipo === 'especifico'` → "Modalidade sem sorteio automático"
- `sorteio === null` → "Sorteio ainda não realizado"

### Reuso de componentes

`SorteioGrupos`, `SorteioChaves`, `SorteioOrdem` aceitam `large={false}` — já testados em desktop. Adicionar CSS extra mobile no `MobileShell` (scroll-x para o bracket de chaves quando excede largura).

### Mobile CSS

- `viewport meta` já existe (`width=device-width, initial-scale=1`)
- `MobileShell` aplica `max-width: 100vw`, `overflow-x: hidden` no body durante a rota
- Header sticky com `position: sticky; top: 0`
- Tabs com `position: sticky; top: <header-height>` para sempre visíveis
- Touch targets ≥ 44×44 (botões, abas, items de lista)

### Não construído nessa versão (YAGNI)

- Pull-to-refresh (só botão manual)
- PWA / manifest / service worker (pode adicionar depois)
- Modo offline / cache strategy
- Notificações push
- Compartilhamento via Web Share API

## Fluxo end-to-end

```
1. Admin abre /eventos/:id/editar → card "Acesso mobile"
2. Admin digita email + clica "Gerar chave"
3. POST /eventos/:id/keys → cria EventoKey { token, email, device_fp=null }
4. Modal mostra QR + link
5. Admin copia link, manda no WhatsApp do convidado
6. Convidado abre link no celular → /e/{token}
7. Frontend gera device_fp (localStorage UUID) + device_label (UA parse)
8. POST /key-access/login { token, device_fp, device_label }
9. Backend grava device_fp, first_used_at, last_seen_at
10. Retorna keyToken + evento
11. Frontend salva keyToken em localStorage, navega /m/modalidades
12. Convidado vê lista, seleciona uma modalidade
13. Tab Inscritos abre por padrão; polling 15s mantém atualizado
14. Convidado tenta abrir o mesmo link em outro celular → 403 "use no aparelho original"
15. (opcional) Admin clica "Reset device" → device_fp volta a null → segundo celular consegue logar
16. (qualquer momento) Admin clica "Revogar" → próxima request do convidado retorna 401 → app limpa storage e fica em tela "Chave revogada"
```

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Convidado limpa localStorage e perde sessão | Tem o link/QR ainda — basta abrir de novo, faz novo first-use (se device_fp ainda bate) OU pede reset |
| Token vaza em logs/screenshot | Admin revoga e cria nova chave |
| Vazamento de dados de outro evento | Middleware `requireEventoKey` carrega só o evento da chave; queries filtram por `evento.competicao_id` ou `evento_id` da chave |
| Múltiplos devices da mesma pessoa | Por design: 1 chave = 1 device. Se precisa mais: admin gera nova chave OU faz reset |
| Polling sobrecarrega servidor | 15s por convidado é leve; em pico de 100 convidados ≈ 7 req/s. Postgres atual suporta com folga. Caching fica fora de escopo. |
| Convidado erra o email no cadastro da chave | Admin apaga (se nunca usada) ou revoga e cria de novo |

## Dependências novas

- Backend: nada (Prisma + JWT já existem)
- Frontend: `qrcode.react` (~10KB gzip) para renderizar QR

## Estimativa de escopo

- Backend (schema + 2 services + 2 controllers + middleware + 14 tests): 1 sessão
- Admin UI (card + 3 modais + lib QR): 1 sessão
- Mobile UI (4 pages + shell + service + interceptor + polling): 1-2 sessões
- Total: ~3 sessões de implementação subagent-driven
