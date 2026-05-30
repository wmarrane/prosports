# F3 — TipoModalidade.tipo (enum TipoDisputa) — Design

**Data:** 2026-05-30
**Status:** Aprovado para implementação
**Versão alvo:** 1.7.0

## Objetivo

Adicionar à entidade `TipoModalidade` o campo `tipo` (enum `TipoDisputa`) que classifica a modalidade segundo o fluxo de disputa. Esse campo é o discriminador que o F4 (Workspace operacional do Evento) usará para decidir qual UI renderizar.

## Escopo

- **In:** novo enum Postgres + nova coluna em `TipoModalidade` + UI de admin para set/show do campo + helper de labels no frontend.
- **Out:** qualquer lógica de workspace, chaveamento, sorteio, persistência de estado de disputa — tudo isso fica para F4.

## Domínio: os 4 tipos de disputa

| Valor do enum (Postgres / Prisma) | Label UI | Semântica futura no F4 |
|---|---|---|
| `grupos` | "Grupos" | Chaveamento por grupos. Workspace consulta `sistema_disputas_grupos` (qtd_equipes → n grupos + componentes + classificados). |
| `chaves` | "Chaves" | Mata-mata eliminatório direto. Workspace gera bracket a partir da lista de inscritos. |
| `especifico` | "Específico" | Regra customizada por modalidade. Workspace solicita planilha/regra externa. |
| `ordem_entrada` | "Ordem de Entrada" | Lista ordenada de chegada (atletismo, ciclismo). Workspace gera ranking. |

O nome do enum é `TipoDisputa` (não `TipoModalidade`, para não colidir com a entidade). Valores em snake_case (compatível com identificadores SQL).

## Modelagem

### Prisma schema

```prisma
enum TipoDisputa {
  grupos
  chaves
  especifico
  ordem_entrada
}

model TipoModalidade {
  id            Int          @id @default(autoincrement())
  nome          String       @unique
  tipo          TipoDisputa  @default(grupos)
  modalidades   Modalidade[]
  criado_em     DateTime     @default(now())
  atualizado_em DateTime     @updatedAt
}
```

### Migration

Migração `20260530TTTTTT_add_tipo_disputa_to_tipo_modalidade`:

```sql
CREATE TYPE "TipoDisputa" AS ENUM ('grupos', 'chaves', 'especifico', 'ordem_entrada');

ALTER TABLE "TipoModalidade"
  ADD COLUMN "tipo" "TipoDisputa" NOT NULL DEFAULT 'grupos';
```

Registros existentes (no DB dev hoje há 2-3 TipoModalidade) ficam todos como `grupos`. Reclassificação acontece manualmente via UI de admin depois do deploy.

## Backend

### Service

`backend/src/modules/tipos_modalidade/tipos_modalidade.service.ts`:

- `criar({ nome, tipo? })` — `tipo` opcional, default `'grupos'` (delegado ao DB).
- `editar(id, { nome?, tipo? })` — ambos opcionais. **Sem 409 ao trocar tipo** (livre — F4 ainda não persiste estado).
- `listar()` / `buscarPorId()` — retornam o campo `tipo` normalmente (Prisma já inclui na resposta padrão).
- Padrão existente de `mapPrismaError` para `P2002` permanece (unique no nome).

### Controller (Zod)

`tipos_modalidade.controller.ts` schema:

```ts
const TIPO_VALUES = ['grupos','chaves','especifico','ordem_entrada'] as const

const createSchema = z.object({
  nome: z.string().min(1),
  tipo: z.enum(TIPO_VALUES).optional(),
})
const updateSchema = createSchema.partial()
```

### Testes (vitest)

Adiciona ao `tipos_modalidade.service.test.ts`:

1. `criar sem tipo omite o campo do prisma.create (default vai do DB)` — confirma que o service NÃO força tipo.
2. `criar com tipo passa o valor para o prisma.create`.
3. `editar com tipo atualiza`.

Não é necessário testar enum invalido — Zod cuida disso na camada de controller.

## Frontend

### Type

`frontend/src/types/modalidade.ts` — adicionar export:

```ts
export type TipoDisputa = 'grupos' | 'chaves' | 'especifico' | 'ordem_entrada'

export type TipoModalidade = {
  id: number
  nome: string
  tipo: TipoDisputa
  criado_em: string
  atualizado_em: string
}
```

(Atualmente o type `TipoModalidade` está nesse arquivo; só adicionar a coluna nova e o type `TipoDisputa`.)

### Helper de labels

`frontend/src/lib/tipo-disputa.ts` (novo, padrão `evento-status.ts`):

```ts
import type { TipoDisputa } from '../types/modalidade'

export const TIPO_DISPUTA_LABEL: Record<TipoDisputa, string> = {
  grupos: 'Grupos',
  chaves: 'Chaves',
  especifico: 'Específico',
  ordem_entrada: 'Ordem de Entrada',
}

export const TIPO_DISPUTA_VALUES: TipoDisputa[] = ['grupos','chaves','especifico','ordem_entrada']
```

### Service

`frontend/src/services/tipos-modalidade.ts` — atualizar `TipoModalidadePayload` para incluir `tipo?: TipoDisputa`.

### Formulário

`frontend/src/pages/tipos-modalidade/TipoModalidadeForm.tsx`:

- Adiciona estado `tipo` (default `'grupos'`).
- Carrega de `existing.tipo` no edit.
- Renderiza `<select>` com 4 opções (label via `TIPO_DISPUTA_LABEL`).
- Envia `tipo` no payload de criar/editar.

### Listagem

`frontend/src/pages/tipos-modalidade/TiposModalidadeList.tsx`:

- Adiciona coluna "Tipo" entre "Nome" e ações.
- Exibe o label (`TIPO_DISPUTA_LABEL[t.tipo]`) — sem badge colorido (mantém leveza visual, similar ao restante das listas administrativas).

## Risco / efeitos colaterais

- **Modalidade existente** referencia TipoModalidade via FK. Modalidade NÃO ganha campo novo aqui — o tipo é uma propriedade do tipo, não da modalidade individual. F4 vai navegar `modalidade.tipo_modalidade.tipo` para decidir o fluxo.
- **Nenhuma quebra de compatibilidade.** Backend continua aceitando criar TipoModalidade sem `tipo` (default no DB cobre).
- **Reclassificação manual** dos registros existentes pós-deploy é responsabilidade do admin; não há seed automático além do default.

## Release

- `package.json`: `1.6.0` → `1.7.0` (MINOR, feature aditiva).
- `CHANGELOG.md`: bloco `[1.7.0]` com `Added` (campo tipo + helper + select no form + coluna na lista).

## Smoke pós-deploy

1. Login admin.
2. Administração → Tipos de Modalidade → lista mostra coluna Tipo com "Grupos" para registros existentes.
3. Editar um existente → trocar para "Chaves" → salvar → lista atualiza.
4. Criar novo "Atletismo" tipo "Ordem de Entrada" → aparece com label correto.
5. Verificar via DB que enum aplicou: `SELECT enum_range(NULL::"TipoDisputa")` → 4 valores.
