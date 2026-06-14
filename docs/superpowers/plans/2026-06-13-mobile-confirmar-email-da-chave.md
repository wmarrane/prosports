# Mobile: confirmar email da chave — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exigir, no login mobile da chave, que o usuário digite o email; o backend valida (server-side, sem expor o email) se corresponde ao da chave e só então libera as modalidades.

**Architecture:** Backend: `login` passa a receber e validar `email` (normalizado), 401 `email_mismatch` se não bater; resposta segue `{ keyToken, evento }`. Frontend: `MobileLogin` deixa de fazer login automático e vira um formulário de email.

**Tech Stack:** Node/Express/Prisma + Vitest (mock prisma) no backend; React 18 + TS + Vite no frontend.

**Validação obrigatória:** backend `npm run test` + `npm run build`; frontend `npm run test` + `npm run build`. Backend em `.../prosports_v2/backend`, frontend em `.../prosports_v2/frontend`.

**Spec:** `docs/superpowers/specs/2026-06-13-mobile-confirmar-email-da-chave-design.md`

**Git:** identidade NÃO configurada — commitar inline (NÃO rodar `git config`): `git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit ...`. Não pular hooks. Sem migration (campo `email` já existe).

---

## File Structure

- **Modify** `backend/src/modules/key_access/key_access.controller.ts` — `loginSchema` ganha `email`.
- **Modify** `backend/src/modules/key_access/key_access.service.ts` — `login` valida o email.
- **Modify** `backend/src/modules/key_access/key_access.service.test.ts` — atualizar inputs + key mocks; novo teste de mismatch.
- **Modify** `frontend/src/services/key-access.ts` — `LoginPayload` ganha `email`.
- **Modify** `frontend/src/pages/mobile/MobileLogin.tsx` — formulário de email no lugar do login automático.

---

## Task 1: Backend — validar email no login

**Files:**
- Modify: `backend/src/modules/key_access/key_access.controller.ts`
- Modify: `backend/src/modules/key_access/key_access.service.ts`
- Modify: `backend/src/modules/key_access/key_access.service.test.ts`

- [ ] **Step 1: Atualizar os testes (TDD)**

Em `backend/src/modules/key_access/key_access.service.test.ts`:

(1a) Atualizar os inputs de `service.login(...)` dos testes existentes para incluir `email`, e adicionar `email` aos key mocks dos testes de sucesso (first-use, same device, takeover) — caso contrário `key.email` é `undefined` e o novo código quebra. Especificamente:

- Teste "login first-use..." (key mock ~linha 37): adicionar `email: 'user@x.com'` ao objeto retornado por `findUnique`; e a chamada `service.login({ token: 'x', device_fp: 'fp1', device_label: 'iPhone' })` vira `service.login({ token: 'x', email: 'user@x.com', device_fp: 'fp1', device_label: 'iPhone' })`.
- Teste "login com mesmo device_fp..." (key mock ~linha 55): adicionar `email: 'user@x.com'`; input ganha `email: 'user@x.com'`.
- Teste "login com device_fp diferente faz takeover..." (key mock ~linha 71): adicionar `email: 'user@x.com'`; input ganha `email: 'user@x.com'`.
- Testes "token não existe" (~24), "revogado_em != null" (~32) e "event_expired" (~90): adicionar `email: 'user@x.com'` ao input (não precisam de email no mock pois lançam antes da checagem de email).

(1b) Adicionar dois novos testes ao final do `describe`:
```ts
  it('login 401 com code email_mismatch quando email não confere (sem rebindar device)', async () => {
    mockPrisma.eventoKey.findUnique.mockResolvedValue({
      id: 1, evento_id: 5, device_fp: null, revogado_em: null, email: 'dono@x.com',
      evento: { id: 5, data_hora: new Date(), competicao: { subtitulo_campos: [] } },
    })
    await expect(service.login({ token: 'x', email: 'outro@x.com', device_fp: 'fp', device_label: 'iPhone' }))
      .rejects.toMatchObject({ status: 401, code: 'email_mismatch' })
    expect(mockPrisma.eventoKey.update).not.toHaveBeenCalled()
  })

  it('login aceita email com espaços/maiúsculas (normalizado)', async () => {
    mockPrisma.eventoKey.findUnique.mockResolvedValue({
      id: 1, evento_id: 5, device_fp: null, revogado_em: null, email: 'Dono@X.com',
      evento: { id: 5, nome: 'E', data_hora: new Date(), local: 'L', logo_url: null, competicao: { subtitulo_campos: [] } },
    })
    mockPrisma.eventoKey.update.mockResolvedValue({})
    const r = await service.login({ token: 'x', email: '  dono@x.com ', device_fp: 'fp1', device_label: 'iPhone' })
    expect(r.keyToken).toBeTruthy()
    expect((r as any).email).toBeUndefined()
  })
```

- [ ] **Step 2: Rodar testes — confirmar FALHA**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/backend" && npm run test -- key_access.service`
Expected: FAIL (o serviço ainda não valida email — o teste de mismatch falha; e/ou erro de tipo no input com `email`).

- [ ] **Step 3: Controller — schema ganha email**

Em `backend/src/modules/key_access/key_access.controller.ts`, trocar:
```ts
const loginSchema = z.object({
  token: z.string().min(1),
  device_fp: z.string().min(1).max(200),
  device_label: z.string().min(1).max(200),
})
```
Por:
```ts
const loginSchema = z.object({
  token: z.string().min(1),
  email: z.string().min(1).max(200),
  device_fp: z.string().min(1).max(200),
  device_label: z.string().min(1).max(200),
})
```

- [ ] **Step 4: Service — validar email (normalizado), antes do rebind**

Em `backend/src/modules/key_access/key_access.service.ts`:

(4a) Assinatura do `login` — trocar:
```ts
export async function login(input: { token: string; device_fp: string; device_label: string }) {
```
Por:
```ts
export async function login(input: { token: string; email: string; device_fp: string; device_label: string }) {
```

(4b) Logo após o bloco de expiração (o `if (expiraEm < new Date()) { ... }`) e ANTES de `const now = new Date()`, inserir:
```ts
  const emailInformado = input.email.trim().toLowerCase()
  const emailChave = key.email.trim().toLowerCase()
  if (emailInformado !== emailChave) {
    throw Object.assign(new Error('Email não confere com o desta chave.'), { status: 401, code: 'email_mismatch' })
  }
```
(O retorno segue `{ keyToken, evento: key.evento }` — não inclui o email.)

- [ ] **Step 5: Rodar testes — confirmar PASSA**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/backend" && npm run test -- key_access.service`
Expected: PASS (todos, incluindo os dois novos).

- [ ] **Step 6: Build backend**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/backend" && npm run build`
Expected: PASS (`tsc`).

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/key_access/key_access.controller.ts backend/src/modules/key_access/key_access.service.ts backend/src/modules/key_access/key_access.service.test.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(key-access): exigir e validar email da chave no login mobile"
```

---

## Task 2: Frontend — formulário de email no MobileLogin

**Files:**
- Modify: `frontend/src/services/key-access.ts`
- Modify: `frontend/src/pages/mobile/MobileLogin.tsx`

- [ ] **Step 1: `LoginPayload` ganha email**

Em `frontend/src/services/key-access.ts`, trocar:
```ts
type LoginPayload = { token: string; device_fp: string; device_label: string }
```
Por:
```ts
type LoginPayload = { token: string; email: string; device_fp: string; device_label: string }
```

- [ ] **Step 2: Reescrever `MobileLogin.tsx` como formulário**

Substituir todo o conteúdo de `frontend/src/pages/mobile/MobileLogin.tsx` por:
```tsx
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { keyAccessService } from '../../services/key-access'
import { getDeviceFingerprint, getDeviceLabel } from '../../lib/device'
import { setKeyToken } from '../../lib/api-key'
import LogoMontana from '../../components/LogoMontana'

export default function MobileLogin() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) { setErro('Link inválido.'); return }
    if (!email.trim()) { setErro('Informe o email.'); return }
    setErro('')
    setEnviando(true)
    keyAccessService.login({
      token,
      email: email.trim(),
      device_fp: getDeviceFingerprint(),
      device_label: getDeviceLabel(),
    })
      .then(r => {
        setKeyToken(r.keyToken)
        navigate('/m', { replace: true })
      })
      .catch((err: any) => {
        const code = err?.response?.data?.code
        const msg = err?.response?.data?.message
        if (code === 'email_mismatch') setErro(msg ?? 'Email não confere com o desta chave.')
        else if (code === 'event_expired') setErro(msg ?? 'Acesso ao evento encerrado.')
        else if (code === 'invalid_or_revoked') setErro(msg ?? 'Chave inválida ou revogada.')
        else if (code === 'device_mismatch') setErro(msg ?? 'Esta chave já está em uso em outro aparelho. Solicite ao organizador o reset.')
        else setErro(msg ?? 'Não foi possível acessar. Tente novamente.')
        setEnviando(false)
      })
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--grad-brand-deep)', color: '#fff',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 20, gap: 24,
    }}>
      <div style={{ background: 'rgba(255,255,255,0.96)', borderRadius: 18, padding: 16, boxShadow: '0 12px 28px rgba(0,0,0,0.3)' }}>
        <LogoMontana variant="simbolo" height={64} />
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 14,
          background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.18)',
          borderRadius: 16, padding: 20,
        }}
      >
        <p style={{ fontSize: 16, fontWeight: 600, textAlign: 'center', margin: 0 }}>
          Confirme seu email para acessar
        </p>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="seu@email.com"
          disabled={enviando}
          autoFocus
          style={{
            width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.95)',
            color: '#111', fontSize: 16,
          }}
        />
        <button
          type="submit"
          disabled={enviando}
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 10, border: 'none',
            background: '#fff', color: 'var(--brand-700, #0b3d91)', fontSize: 16, fontWeight: 700,
            cursor: enviando ? 'wait' : 'pointer', opacity: enviando ? 0.6 : 1,
          }}
        >
          {enviando ? 'Acessando...' : 'Acessar'}
        </button>
        {erro && (
          <div style={{
            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.5)',
            padding: '12px 14px', borderRadius: 12, textAlign: 'center', fontSize: 14,
          }}>
            {erro}
          </div>
        )}
      </form>
    </div>
  )
}
```

(Removido o login automático no `useEffect`; agora o acesso só ocorre ao enviar o formulário. Não exibe email nem dados do evento.)

- [ ] **Step 3: Build + testes (frontend)**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend" && npm run build`
Expected: PASS (`tsc -b && vite build`).

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend" && npm run test`
Expected: PASS (suíte inteira).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/key-access.ts frontend/src/pages/mobile/MobileLogin.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(mobile): formulario de confirmacao de email no login da chave"
```

---

## Manual Test Checklist

- Abrir `/e/:token` no mobile → aparece o formulário "Confirme seu email para acessar" (sem login automático, sem mostrar o email/evento).
- Digitar o **email correto** da chave → libera `/m` (modalidades).
- Digitar **email errado** → erro "Email não confere com o desta chave." e permanece na tela (sem rebindar o aparelho).
- Email com espaços/maiúsculas equivalente ao correto → aceita (normalizado).
- Chave revogada → "Chave inválida ou revogada."; evento +24h → "Acesso ao evento encerrado."
- Reabrir o link → pede o email de novo (a cada abertura).

---

## Self-Review

**1. Spec coverage:**
- Login exige email + valida no servidor (normalizado), 401 `email_mismatch` → Task 1 (steps 3-4). ✓
- Email nunca retornado → resposta inalterada `{ keyToken, evento }`; teste afirma `email` undefined. ✓
- Validação antes do rebind do device → email check antes do `eventoKey.update`; teste afirma `update` não chamado no mismatch. ✓
- Frontend: formulário no lugar do auto-login; mensagens por código → Task 2 (step 2). ✓
- Pede a cada abertura do link → `MobileLogin` sempre mostra o form (sem auto-skip). ✓
- Sem exibir email/evento pré-login → form genérico. ✓

**2. Placeholder scan:** Sem TBD/TODO; blocos completos. ✓

**3. Type consistency:** `login(input: { token; email; device_fp; device_label })` (backend) ↔ `loginSchema` com `email` ↔ `LoginPayload` (frontend) com `email`. Resposta `{ keyToken, evento }` inalterada. ✓
