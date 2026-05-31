---
title: Subtítulo do participante — campos parametrizáveis
date: 2026-05-31
status: aprovado
---

# Subtítulo parametrizável por Competição — Design

## Objetivo

Substituir o boolean `Competicao.adicionar_subtitulo` por uma lista ordenada de campos do Participante que serão exibidos como "linha de info adicional" nas telas de sorteio/inscrições, separados por ` | `.

## Escopo

Inclui:
- Coluna nova `Competicao.subtitulo_campos: String[]` (substitui `adicionar_subtitulo`).
- Migration que preserva o comportamento atual (`adicionar_subtitulo=true` → `['subtitulo']`; `false` → `[]`).
- Utilitário front `composeSubtituloLine(participante, campos)`.
- UI no `CompeticaoForm`: checkboxes + reorder por setas + preview ao vivo.
- Refatoração dos componentes de sorteio (`SorteioOrdem`, `SorteioGrupos`, `SorteioChaves`, `CampeaoSlot`, `BracketTree`) trocando `mostrarSubtitulo: boolean` por `subtituloLine: (participante) => string | null`.
- Atualização dos 5 pages que derivam essa info (EventoInscricoes, CongressoStep × 3, ImportInscricoesModal, Relatorio).

Fora de escopo:
- Drag-and-drop para reorder (usa setas ↑↓ por simplicidade).
- Telas globais (ParticipantesList, ParticipanteForm, ParticipanteSelect) — continuam mostrando subtítulo sempre como hoje.
- Configurar tipografia/cor da linha por competição (segue o padrão atual).

---

## Decisões tomadas

| Pergunta | Decisão |
|---|---|
| Quais campos disponíveis? | Subtítulo, Município (nome/UF), Inspetoria, Delegacia |
| Ordem | Configurável pelo usuário (setas ↑↓) |
| Campo vazio no participante | Omitir silenciosamente (sem `||` duplo) |
| Manter `adicionar_subtitulo` para compat? | Não — droppar após migration |

---

## Backend

### Schema (Prisma)

```prisma
model Competicao {
  // ...
  // adicionar_subtitulo Boolean @default(false)  // REMOVIDO
  subtitulo_campos String[] @default([])
  // ...
}
```

### Migration

Arquivo: `backend/prisma/migrations/<timestamp>_competicao_subtitulo_campos/migration.sql`

```sql
ALTER TABLE "Competicao" ADD COLUMN "subtitulo_campos" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Preserva comportamento atual
UPDATE "Competicao" SET "subtitulo_campos" = ARRAY['subtitulo']
WHERE "adicionar_subtitulo" = true;

ALTER TABLE "Competicao" DROP COLUMN "adicionar_subtitulo";
```

### Validação (zod)

```ts
const CAMPOS_VALIDOS = ['subtitulo', 'municipio', 'inspetoria', 'delegacia'] as const

const createSchema = z.object({
  // ...
  subtitulo_campos: z.array(z.enum(CAMPOS_VALIDOS))
    .max(4)
    .refine(arr => new Set(arr).size === arr.length, { message: 'Campos duplicados' })
    .default([]),
})
```

### Service

Nenhuma lógica adicional — apenas persiste e retorna o array.

### Testes (vitest)

- `competicoes.service.test.ts`:
  - Criar com `subtitulo_campos: ['subtitulo', 'municipio']` → persiste corretamente.
  - Editar para `[]` → limpa.
  - Rejeitar enum inválido (`subtitulo_campos: ['foo']` → erro zod).
  - Rejeitar duplicatas (`['subtitulo', 'subtitulo']` → erro zod).

---

## Frontend

### Novo utilitário

`frontend/src/lib/compose-subtitulo.ts`:

```ts
import type { Participante } from '../types/participante'

type Campo = 'subtitulo' | 'municipio' | 'inspetoria' | 'delegacia'

export function composeSubtituloLine(
  participante: Pick<Participante, 'subtitulo' | 'municipio' | 'inspetoria' | 'delegacia'>,
  campos: Campo[],
): string | null {
  const partes: string[] = []
  for (const c of campos) {
    let v: string | null = null
    if (c === 'subtitulo') v = participante.subtitulo || null
    else if (c === 'municipio' && participante.municipio) v = `${participante.municipio.nome}/${participante.municipio.uf}`
    else if (c === 'inspetoria' && participante.inspetoria) v = participante.inspetoria.nome
    else if (c === 'delegacia' && participante.delegacia) v = participante.delegacia.nome
    if (v) partes.push(v)
  }
  return partes.length > 0 ? partes.join(' | ') : null
}
```

Testes (vitest):
- Array vazio → null
- Campo único com valor → retorna o valor
- Múltiplos campos com valores → junta com ` | ` na ordem
- Valor ausente é omitido (sem `||` duplo)
- Ordem preservada conforme array de campos

### CompeticaoForm

Substituir o checkbox atual por uma seção "Linha de exibição do participante":

```
[ ] Subtítulo
[ ] Município (nome/UF)
[ ] Inspetoria
[ ] Delegacia

Quando algum item marcado: lista ordenável de chips com setas ↑↓
Preview: "Clube XYZ | Campinas/SP | Inspetoria Sul"

Quando nada marcado:
"Nenhuma informação adicional será exibida."
```

State: `const [campos, setCampos] = useState<Campo[]>(existing?.subtitulo_campos ?? [])`

Submit: `payload.subtitulo_campos = campos`

### Componentes de sorteio

Trocar prop `mostrarSubtitulo: boolean` por:

```ts
subtituloLine?: (p: Participante) => string | null
```

Quando não passada, default = `() => null` (omite linha).

Componentes afetados:
- `SorteioOrdem.tsx`
- `SorteioGrupos.tsx`
- `SorteioChaves.tsx`
- `CampeaoSlot.tsx`
- `BracketTree.tsx` (interno via `SorteioChaves`)

### Pages

Substituir derivação `mostrarSubtitulo = evento.competicao.adicionar_subtitulo` por:

```ts
const campos = evento?.competicao?.subtitulo_campos ?? []
const subtituloLine = (p: Participante) => composeSubtituloLine(p, campos)
```

E passar `subtituloLine` em vez de `mostrarSubtitulo` para os componentes.

Pages afetadas:
- `EventoInscricoes.tsx` (chips de inscritos + sorteios + campeões)
- `CongressoStepParticipantes.tsx`
- `CongressoStepSorteio.tsx` (incluindo modal de grupo expandido)
- `CongressoStepCampeoes.tsx`
- `ImportInscricoesModal.tsx` — se `'subtitulo'` está em campos, template CSV tem 4 colunas; senão, 3
- `Relatorio.tsx` — CSV exporta coluna `subtitulo` se está em campos; idem para `municipio`, `inspetoria`, `delegacia` (replicar o mesmo controle)

### Telas globais (sem mudança)

- `ParticipantesList` — continua mostrando subtítulo na coluna (cadastro nacional, sem competição).
- `ParticipanteForm` — admin sempre pode editar.
- `ParticipanteSelect` — dropdown reutilizado em vários lugares.

---

## Tratamento de erros (UX)

- Enum inválido vindo da API: zod rejeita no backend; frontend recebe 400 e mostra erro genérico.
- Reorder de chip sem itens: as setas ficam disabled.
- Preview com dados de exemplo: hardcoded ("João Silva", "Clube XYZ", "Campinas/SP", "Inspetoria Sul", "Delegacia Centro").

---

## Migrations e versionamento

- Bump: `v1.33.0` (minor; mudança de schema, mas zero downtime via UPDATE inline).
- Sem rollback automático — migration drop column é destrutiva. Caso precise rollback, recriar coluna e popular `adicionar_subtitulo = (subtitulo_campos LIKE '%subtitulo%')`.

---

## Arquivos-chave

**Novos:**
- `backend/prisma/migrations/<timestamp>_competicao_subtitulo_campos/migration.sql`
- `frontend/src/lib/compose-subtitulo.ts`
- `frontend/src/lib/compose-subtitulo.test.ts` (se houver vitest no front; senão skip)

**Modificados (backend):**
- `backend/prisma/schema.prisma`
- `backend/src/modules/competicoes/competicoes.service.ts` (schema zod inline ou em `.schemas.ts`)
- `backend/src/modules/competicoes/competicoes.service.test.ts`

**Modificados (frontend):**
- `frontend/src/types/competicao.ts`
- `frontend/src/pages/competicoes/CompeticaoForm.tsx`
- `frontend/src/components/sorteio-result/SorteioOrdem.tsx`
- `frontend/src/components/sorteio-result/SorteioGrupos.tsx`
- `frontend/src/components/sorteio-result/SorteioChaves.tsx`
- `frontend/src/components/sorteio-result/BracketTree.tsx`
- `frontend/src/components/CampeaoSlot.tsx`
- `frontend/src/pages/eventos/EventoInscricoes.tsx`
- `frontend/src/pages/congresso/CongressoStepParticipantes.tsx`
- `frontend/src/pages/congresso/CongressoStepSorteio.tsx`
- `frontend/src/pages/congresso/CongressoStepCampeoes.tsx`
- `frontend/src/components/import/ImportInscricoesModal.tsx`
- `frontend/src/pages/Relatorio.tsx`
