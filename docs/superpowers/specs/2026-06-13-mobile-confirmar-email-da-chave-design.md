# Mobile: confirmar email da chave antes das modalidades — Design

**Data:** 2026-06-13
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Na tela mobile da chave de acesso, antes de entrar direto nas modalidades, exigir que o usuário **confirme o email vinculado à chave**: ele digita o email; o servidor valida se corresponde ao da chave; só então libera as modalidades. É uma verificação real de quem acessa (o email **não** é exposto).

## Decisões (do brainstorming)

- **Digitar e validar no servidor** (gate real; o email da chave não é devolvido ao cliente).
- Pedir a confirmação **a cada abertura do link** (`/e/:token`); navegar dentro do app não repete.

## Contexto atual

- `EventoKey` (schema.prisma:264-282) tem `email` **obrigatório**, com `@@unique([evento_id, email])`. O email é definido pelo admin ao criar a chave (`evento_keys`).
- Login mobile: `frontend/src/pages/mobile/MobileLogin.tsx` (`/e/:token`) faz login **automático** no `useEffect` e navega direto para `/m`.
- Backend `backend/src/modules/key_access/key_access.service.ts` `login({ token, device_fp, device_label })`: valida chave (inválida/revogada), janela de 24h após `data_hora`, rebinda `device_fp/label` (1 sessão por chave), assina `keyToken` e retorna `{ keyToken, evento }`. **Hoje não usa o email.**
- `loginSchema` (controller) hoje: `{ token, device_fp, device_label }`.
- Front service `frontend/src/services/key-access.ts`: `login(payload)` → `{ keyToken, evento }`.

## Backend

### `key_access.controller.ts`
- `loginSchema` ganha `email`:
  ```ts
  const loginSchema = z.object({
    token: z.string().min(1),
    email: z.string().min(1).max(200),
    device_fp: z.string().min(1).max(200),
    device_label: z.string().min(1).max(200),
  })
  ```
  (Usar `min(1)` e normalizar no serviço, para ser tolerante a formatação; a validação de formato já ocorreu na criação da chave.)

### `key_access.service.ts` `login`
- Assinatura: `login(input: { token: string; email: string; device_fp: string; device_label: string })`.
- Após as validações existentes (inválida/revogada → 401 `invalid_or_revoked`; expiração 24h → 401 `event_expired`), **antes** de atualizar o device, comparar emails normalizados:
  ```ts
  const emailInformado = input.email.trim().toLowerCase()
  const emailChave = key.email.trim().toLowerCase()
  if (emailInformado !== emailChave) {
    throw Object.assign(new Error('Email não confere com o desta chave.'), { status: 401, code: 'email_mismatch' })
  }
  ```
- O restante (rebind device, `signKeyToken`, retorno) inalterado. **Resposta continua `{ keyToken, evento }` — o email não é retornado.**

## Frontend (mobile)

### `frontend/src/services/key-access.ts`
- `LoginPayload` ganha `email: string`.

### `frontend/src/pages/mobile/MobileLogin.tsx`
- Remover o login automático no `useEffect`. Em vez disso, renderizar um **formulário** com um campo de email e botão "Acessar".
- Estado: `email`, `enviando`, `erro`. Ao enviar:
  ```ts
  keyAccessService.login({ token, email, device_fp: getDeviceFingerprint(), device_label: getDeviceLabel() })
    .then(r => { setKeyToken(r.keyToken); navigate('/m', { replace: true }) })
    .catch(/* mapear código → mensagem */)
  ```
- Mensagens de erro por `err.response.data.code`:
  - `email_mismatch` → "Email não confere com o desta chave."
  - `event_expired` → "Acesso ao evento encerrado."
  - `invalid_or_revoked` → "Chave inválida ou revogada."
  - genérico → "Não foi possível acessar. Tente novamente."
- Sem `token` na URL → "Link inválido." (igual a hoje).
- Texto da tela: título curto (ex.: "Confirme seu email para acessar"). **Não** exibir nenhum email nem dados do evento (não há info pré-login e o email deve permanecer secreto).
- Como a confirmação é pedida a cada abertura do link, o formulário sempre aparece ao abrir `/e/:token` (mesmo que exista `keyToken` salvo de antes; um novo login rebinda o device).

## Tratamento de erros / casos

- Email com espaços/maiúsculas: normalizado nos dois lados (`trim().toLowerCase()`).
- Email errado: 401 `email_mismatch`, sem rebindar o device (o aparelho anterior, se houver, continua válido).
- Chave expirada/revogada: mensagens específicas (inalteradas).
- O email da chave nunca trafega para o cliente.

## Testes

- **Backend (Vitest, mock prisma):**
  - login com email correto (normalizado) segue e retorna `keyToken` (não retorna email).
  - email diferente → 401 `email_mismatch`; `eventoKey.update` (rebind) **não** é chamado.
  - atualizar os testes de login existentes para enviar o `email` correspondente ao `key.email` mockado.
- **Frontend:** `npm run build` + manual (abrir `/e/:token` → digitar email correto libera `/m`; email errado bloqueia com mensagem; expirada/revogada com mensagens próprias).
- Sem migration (campo `email` já existe).

## Fora de escopo

- Reenvio/recuperação de email; OTP por email.
- Exibir o email (mascarado ou não) — decisão foi não expor.
- Lembrar o email no dispositivo (decisão foi pedir a cada abertura do link).
- Mudar a criação/admin de chaves.
