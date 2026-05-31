---
title: Usuários, perfis, alterar senha e logout
date: 2026-05-31
status: aprovado
---

# Usuários, perfis, alterar senha e logout — Design

## Objetivo

Permitir que o ADMIN gerencie usuários (criar/editar/desativar/remover), que qualquer usuário troque a própria senha, que o ADMIN resete a senha de outros, e que qualquer usuário saia do sistema pela UI.

## Escopo

Inclui:
- CRUD de usuários (admin only)
- Endpoint e UI para o usuário logado trocar a própria senha
- Endpoint e UI para o admin resetar a senha de outro usuário
- Popover de menu de usuário na sidebar com "Minha conta", "Trocar senha", "Sair"
- Página "Minha conta" (read-only)

Fora de escopo:
- Convite por email / SMTP
- Auto-registro público
- Perfis customizáveis ou permissões granulares (mantemos o enum `Role` atual: ADMIN, PARTICIPANTE, VIEWER)
- Persistência de refresh JTI em banco (segue só em Redis — comportamento atual)
- Auditlog
- Testes de UI no frontend

---

## Decisões tomadas no brainstorming

| Pergunta | Decisão |
|---|---|
| Como tratar "perfis"? | Usar o enum `Role` existente (ADMIN/PARTICIPANTE/VIEWER) |
| Quem cria usuários? | Só ADMIN, com senha inicial definida no form |
| Quem troca senha? | Ambos: o próprio usuário e o ADMIN (que reseta a de outros) |
| Onde abre o menu de logout? | Popover no card de usuário do rodapé da sidebar |
| Onde fica "Usuários" no menu? | Sob "Administração" |

---

## Backend

### Novo módulo `backend/src/modules/users/`

Segue o padrão dos módulos existentes (ex.: `municipios`, `participantes`):

- `users.service.ts` — regras de negócio
- `users.controller.ts` — handlers REST
- `users.routes.ts` — rotas registradas em `backend/src/index.ts`

### Endpoints

Todos protegidos por `requireAuth + requireRole(ADMIN)`, exceto `/api/auth/alterar-senha` que só precisa de `requireAuth`.

| Método | Rota | Body / Query | Resposta |
|---|---|---|---|
| GET | `/api/users` | — | `User[]` ordenado por nome (pt-BR) |
| GET | `/api/users/:id` | — | `User` |
| POST | `/api/users` | `{ nome, email, role, senha }` | `User` criado |
| PATCH | `/api/users/:id` | `{ nome?, email?, role?, ativo? }` | `User` atualizado |
| POST | `/api/users/:id/resetar-senha` | `{ nova_senha }` | `{ ok: true }` |
| DELETE | `/api/users/:id` | — | `204` |
| POST | `/api/auth/alterar-senha` | `{ senha_atual, nova_senha }` | `{ ok: true }` |

O DTO `User` exposto pelas APIs **nunca** inclui `senha_hash`.

### Validação (zod)

- `nome`: string, 2 a 80 caracteres
- `email`: email válido, único
- `role`: enum `Role` (ADMIN, PARTICIPANTE, VIEWER)
- `senha`/`nova_senha`/`senha_atual`: string, 8 a 72 caracteres (72 é o limite do bcrypt)
- `ativo`: boolean

### Regras de proteção

Implementadas no service e retornam 400 com mensagem clara:

1. **Não pode remover a si mesmo** (`DELETE /api/users/:id` com `id === currentUser.id`).
2. **Não pode desativar a si mesmo** (`PATCH ativo:false` com `id === currentUser.id`).
3. **Não pode rebaixar o próprio role** (`PATCH role:!ADMIN` com `id === currentUser.id`).
4. **Último ADMIN ativo**: qualquer operação que deixaria o sistema sem nenhum `Role.ADMIN` com `ativo:true` é recusada (cobre `DELETE`, `PATCH ativo:false`, `PATCH role:!ADMIN`).
5. **Email único**: erro 400 com mensagem "Email já cadastrado" se o email já existir em outro usuário.

### Comportamento de senha

- **Criar usuário**: senha vai para `senha_hash` via `bcrypt.hash(senha, 12)` (mesmo padrão do `auth.service` atual).
- **Alterar senha (próprio)**: valida `senha_atual` com `bcrypt.compare`; se OK, atualiza hash. **Revoga o refresh JTI atual no Redis** (força re-login no próprio dispositivo e em outros). Frontend reage com toast + logout automático.
- **Resetar senha (admin)**: gera novo hash sem precisar da senha atual. **Revoga o refresh JTI do usuário-alvo no Redis** (kicka sessões ativas dele). **Reseta `tentativas_login = 0` e `bloqueado_ate = null`** (libera conta bloqueada).

### Logout (já existe)

`POST /api/auth/logout` já está implementado e revoga o refresh JTI no Redis. O frontend só precisa chamá-lo.

---

## Frontend

### Novas rotas

| Rota | Página | Acesso |
|---|---|---|
| `/usuarios` | `UsuariosList` | ADMIN |
| `/usuarios/novo` | `UsuarioForm` (criar) | ADMIN |
| `/usuarios/:id/editar` | `UsuarioForm` (editar) | ADMIN |
| `/conta` | `MinhaConta` | logado |
| `/conta/senha` | `TrocarSenha` | logado |

A proteção por role usa o mesmo guard que já protege as rotas hoje. Se nenhum guard de role específico existe, criar um wrapper simples que checa `user.role === 'ADMIN'` e redireciona para `/painel` com toast caso contrário.

### Novos arquivos

| Arquivo | Função |
|---|---|
| `services/users.ts` | Service CRUD: `listar`, `buscar`, `criar`, `editar`, `remover`, `resetarSenha` + `alterarSenha` (própria) |
| `types/user.ts` | Tipos `User`, `UserCreatePayload`, `UserUpdatePayload`, etc. |
| `pages/usuarios/UsuariosList.tsx` | DataTable em card + busca client-side por nome/email |
| `pages/usuarios/UsuarioForm.tsx` | Form criar/editar em 2 cards seccionados |
| `pages/usuarios/ResetSenhaModal.tsx` | Modal para o admin resetar a senha de outro |
| `pages/conta/MinhaConta.tsx` | Card único informativo + atalho para "Trocar senha" |
| `pages/conta/TrocarSenha.tsx` | Form: senha atual / nova / confirmar nova |
| `components/UserMenuPopover.tsx` | Popover do card de usuário do rodapé da sidebar |

### Mudanças em arquivos existentes

- `components/Sidebar.tsx` — adicionar item "Usuários" (Users icon, brand-500) no grupo Administração; envolver o card do rodapé num botão que abre o `UserMenuPopover`.
- `store/authStore.ts` — adicionar `logout()`: chama `POST /api/auth/logout` (best-effort, ignora erro), limpa store + localStorage, redireciona para `/login`.
- `router/index.tsx` (ou equivalente) — registrar as 5 novas rotas com proteções.
- `lib/icons.ts` — exportar `Key`, `LogOut`, `UserCog` (se ainda não exportados).

### Padrão visual

Segue o pattern já estabelecido nos outros menus (Municípios, Inspetorias, Participantes etc.):

- **`UsuariosList`** — header com eyebrow "Administração" + título "Usuários" + sub + botão "Novo Usuário". Card com busca por nome/email. DataTable com colunas: Nome (bold) + email (dim abaixo) · Role (pill colorida: ADMIN brand-deep, PARTICIPANTE verde, VIEWER teal) · Ativo (badge "Sim"/"Não") · Último login (data ou "Nunca") · Ações (Editar / Resetar senha / Remover).
- **`UsuarioForm`** — 2 cards seccionados:
  - **Card "Identificação"** (Users icon brand-deep): Nome + Email (asterisco vermelho em obrigatórios).
  - **Card "Acesso"** (ShieldCheck icon violet): Role select + (no create) campo "Senha inicial" + (no edit) toggle "Ativo". O reset de senha no modo edit fica num botão "Resetar senha" que abre o `ResetSenhaModal`.
  - Action bar Cancelar + Salvar/Criar com ícones, sob borda superior.
- **`MinhaConta`** — card único, padding generoso, avatar grande com iniciais, nome em destaque, abaixo: email · role (pill) · último login. Botão "Trocar senha" leva para `/conta/senha`.
- **`TrocarSenha`** — card único com 3 campos verticais (senha atual, nova, confirmar nova). Validação client-side: nova == confirmar; nova com mínimo 8 chars. Action bar Cancelar + Salvar.
- **`UserMenuPopover`** — popover ancorado ao card de usuário da sidebar. Itens (em ordem): **Minha conta** (User icon), **Trocar senha** (Key icon), divisor, **Sair** (LogOut icon, texto em vermelho `var(--danger)`). Fecha ao clicar fora ou ao escolher um item.

### Fluxo de trocar a própria senha

1. Usuário clica em "Trocar senha" no popover → vai para `/conta/senha`.
2. Preenche `senha_atual`, `nova_senha`, `confirmar_nova_senha`.
3. Frontend valida match + mínimo 8 chars.
4. Chama `POST /api/auth/alterar-senha`.
5. Sucesso → toast "Senha alterada. Faça login novamente." → chama `authStore.logout()` → redireciona para `/login`.
6. Erro "Senha atual incorreta" → mensagem inline no campo `senha_atual`.

### Fluxo de logout

1. Usuário clica em "Sair" no popover.
2. `authStore.logout()`:
   - Dispara `POST /api/auth/logout` (best-effort — se falhar, segue mesmo assim).
   - Limpa `accessToken` e `user` do store e do localStorage.
   - Redireciona para `/login`.

### Fluxo de admin resetar senha de outro

1. Admin clica "Resetar senha" na linha do usuário (na lista) ou no botão dentro do `UsuarioForm` (modo edit).
2. Abre `ResetSenhaModal` com dois campos: nova_senha + confirmar_nova_senha.
3. Frontend valida match + mínimo 8 chars.
4. Chama `POST /api/users/:id/resetar-senha`.
5. Sucesso → toast "Senha redefinida. O usuário foi deslogado e deverá entrar com a nova senha."
6. Modal fecha.

---

## Tratamento de erros (UX)

| Erro do backend | Apresentação no frontend |
|---|---|
| `400 Email já cadastrado` | Mensagem inline no campo email do form |
| `400 Senha atual incorreta` | Mensagem inline no campo senha_atual |
| `400 Você não pode remover a si mesmo` | Toast vermelho |
| `400 Você não pode desativar a si mesmo` | Toast vermelho |
| `400 Você é o último admin ativo` | Toast vermelho |
| `401 Token inválido` | Logout automático + redirect para `/login` |
| `5xx` | Toast genérico "Erro ao [ação]. Tente novamente." |

---

## Testes

- **Backend (obrigatório)**:
  - `users.service` — criar/editar/remover, validações de último admin, reset de senha
  - `auth.service` — `alterar-senha`: sucesso, senha atual errada (→ 401), revogação do refresh JTI

- **Frontend** — fora de escopo (segue o padrão atual do projeto, sem testes de UI).

---

## Migrations

Nenhuma migration de schema necessária — o model `User` já tem todos os campos. Apenas código novo.

---

## Versionamento e changelog

Bump menor: `v1.32.0`. Entrada no CHANGELOG cobre:

- Backend: módulo `users` + endpoint `/api/auth/alterar-senha`
- Frontend: 5 novas páginas, popover de menu de usuário, item "Usuários" na sidebar
- Logout funcional pela UI

---

## Arquivos-chave (resumo)

**Novos (backend):**
- `backend/src/modules/users/users.service.ts`
- `backend/src/modules/users/users.controller.ts`
- `backend/src/modules/users/users.routes.ts`
- `backend/src/modules/users/users.schemas.ts` (zod)
- `backend/src/modules/users/users.service.test.ts`

**Modificados (backend):**
- `backend/src/index.ts` — registrar rotas de users
- `backend/src/modules/auth/auth.service.ts` — adicionar `alterarSenha`
- `backend/src/modules/auth/auth.controller.ts` — handler `alterarSenha`
- `backend/src/modules/auth/auth.routes.ts` — rota `POST /alterar-senha`
- `backend/src/modules/auth/auth.service.test.ts` — cobertura do novo método

**Novos (frontend):**
- `frontend/src/services/users.ts`
- `frontend/src/types/user.ts`
- `frontend/src/pages/usuarios/UsuariosList.tsx`
- `frontend/src/pages/usuarios/UsuarioForm.tsx`
- `frontend/src/pages/usuarios/ResetSenhaModal.tsx`
- `frontend/src/pages/conta/MinhaConta.tsx`
- `frontend/src/pages/conta/TrocarSenha.tsx`
- `frontend/src/components/UserMenuPopover.tsx`

**Modificados (frontend):**
- `frontend/src/components/Sidebar.tsx`
- `frontend/src/store/authStore.ts`
- `frontend/src/router/index.tsx` (ou onde estão as rotas)
- `frontend/src/lib/icons.ts`
