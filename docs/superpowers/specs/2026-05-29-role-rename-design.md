# Spec: Rename Role.DELEGACAO → Role.PARTICIPANTE

Data: 2026-05-29
Status: aprovado para implementação (executar direto, sem subagent)

## Objetivo

Renomear o valor do enum `Role` de `DELEGACAO` para `PARTICIPANTE`, alinhando com a nomeação atual da entidade Participante (Role.DELEGACAO virou débito após a feature `2026-05-28-participantes-design`). Bump PATCH para `1.4.1`.

## Escopo

3 arquivos + 1 migration nova:

| Arquivo | Mudança |
|---|---|
| `backend/prisma/schema.prisma:13` | `DELEGACAO` → `PARTICIPANTE` no enum Role |
| `backend/prisma/migrations/<ts>_rename_role_delegacao_to_participante/migration.sql` | `ALTER TYPE "Role" RENAME VALUE 'DELEGACAO' TO 'PARTICIPANTE';` |
| `frontend/src/types/auth.ts:1` | string union literal `'DELEGACAO'` → `'PARTICIPANTE'` |
| `package.json` (root) | `1.4.0` → `1.4.1` |
| `CHANGELOG.md` | Novo bloco `## [1.4.1] - 2026-05-29` (Changed) |

Fora de escopo: migration histórica `20260528043504_add_user_auth/migration.sql` permanece com `'DELEGACAO'` (registro do que foi aplicado).

## Decisões de design

| # | Decisão | Justificativa |
|---|---|---|
| 1 | Migration manual com `ALTER TYPE RENAME VALUE` | Postgres ≥10 suporta in-place; preserva qualquer User com role atual |
| 2 | PATCH (1.4.1) | Cleanup interno sem mudança visível ao usuário |
| 3 | Não editar migrations históricas | Registro imutável do que foi aplicado em produção |
| 4 | Skip subagent + writing-plans | Mudança trivial (4 edits), implementar inline |

## Verificações pós-mudança

- `cd backend && npx tsc --noEmit` → clean (nenhum consumer importa o tipo Role do @prisma/client).
- `cd backend && npx vitest run` → 66 testes seguem passando.
- `cd frontend && npx tsc --noEmit && npm run build` → clean.
- `grep -rn "DELEGACAO" backend/src frontend/src` → 0 hits.

## Riscos

| Risco | Mitigação |
|---|---|
| User com role='DELEGACAO' no banco | `ALTER TYPE RENAME VALUE` preserva automaticamente; dev seed só tem ADMIN |
| Migration histórica entrar em conflito | Sequência funciona: migration antiga cria enum com DELEGACAO, nova renomeia para PARTICIPANTE |
| Prisma `migrate dev` quebrar pelo non-TTY | Não roda local; CI aplica via `migrate deploy` com SQL manual |
