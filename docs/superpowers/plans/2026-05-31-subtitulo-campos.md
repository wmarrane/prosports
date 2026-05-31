# Subtítulo parametrizável por Competição — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir `Competicao.adicionar_subtitulo: boolean` por `Competicao.subtitulo_campos: String[]` (ordenado), com UI no form da competição para selecionar e reordenar quais campos do Participante (`subtitulo`, `municipio`, `inspetoria`, `delegacia`) compõem a linha exibida nos sorteios/inscrições, separados por ` | `.

**Architecture:** Migration Prisma converte boolean atual para array (`true` → `['subtitulo']`). Frontend ganha um utilitário `composeSubtituloLine(participante, campos)` que omite campos vazios. Componentes de sorteio recebem uma callback `subtituloLine: (p) => string | null` em vez do antigo flag boolean. Páginas que consomem evento.competicao derivam a callback e propagam.

**Tech Stack:** Prisma + Postgres + Express + Zod (backend); React + Vite + TypeScript + Tanstack Query (frontend); Vitest para testes.

**Spec:** `docs/superpowers/specs/2026-05-31-subtitulo-campos-design.md`

**Padrões importantes do projeto:**
- Backend: services lançam `Object.assign(new Error('msg'), { status: N })`. Tests com Vitest, mock prisma via `vi.mock('../../lib/prisma', ...)`.
- Frontend: services em `frontend/src/services/`, types em `frontend/src/types/`, componentes seguem padrão de cards seccionados.
- Use absolute Windows paths com backslashes em todas as ferramentas de arquivo.
- Telas globais (ParticipantesList, ParticipanteForm, ParticipanteSelect) **NÃO mudam** — continuam mostrando subtítulo sempre.

---

## Backend

### Task 1: Schema Prisma + migration de dados

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260531190000_competicao_subtitulo_campos/migration.sql`

- [ ] **Step 1: Editar schema.prisma — substituir coluna**

Alterar o model `Competicao`:

```prisma
model Competicao {
  id                       Int                      @id @default(autoincrement())
  nome                     String                   @unique
  estados                  String[]
  subtitulo_campos         String[]                 @default([])
  modalidades              Modalidade[]
  eventos                  Evento[]
  sistema_disputas_grupos  SistemaDisputasGrupos[]
  criado_em                DateTime                 @default(now())
  atualizado_em            DateTime                 @updatedAt
}
```

Remover a linha `adicionar_subtitulo Boolean @default(false)`.

- [ ] **Step 2: Criar migration manual com preservação de dados**

Criar arquivo `backend/prisma/migrations/20260531190000_competicao_subtitulo_campos/migration.sql` com o conteúdo:

```sql
-- Adiciona nova coluna de campos parametrizáveis (default: vazio)
ALTER TABLE "Competicao" ADD COLUMN "subtitulo_campos" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Preserva comportamento atual: competições com adicionar_subtitulo=true
-- passam a usar apenas o subtítulo
UPDATE "Competicao" SET "subtitulo_campos" = ARRAY['subtitulo']
WHERE "adicionar_subtitulo" = true;

-- Remove coluna antiga
ALTER TABLE "Competicao" DROP COLUMN "adicionar_subtitulo";
```

- [ ] **Step 3: Regenerar Prisma Client local**

```
cd backend && npx prisma generate
```

Esperado: `✔ Generated Prisma Client`.

- [ ] **Step 4: Commit**

```
git add backend/prisma/schema.prisma backend/prisma/migrations/20260531190000_competicao_subtitulo_campos/
git commit -m "feat(competicoes): schema subtitulo_campos String[] (substitui adicionar_subtitulo)"
```

DO NOT push.

---

### Task 2: Atualizar service + controller (zod)

**Files:**
- Modify: `backend/src/modules/competicoes/competicoes.service.ts`
- Modify: `backend/src/modules/competicoes/competicoes.controller.ts`

- [ ] **Step 1: Atualizar `competicoes.service.ts`**

Substituir o arquivo inteiro por:

```typescript
import prisma from '../../lib/prisma'
import { SIGLAS_VALIDAS } from '../municipios/uf'

export const CAMPOS_VALIDOS = ['subtitulo', 'municipio', 'inspetoria', 'delegacia'] as const
export type CampoSubtitulo = typeof CAMPOS_VALIDOS[number]

function validateUfs(estados: string[]) {
  for (const uf of estados) {
    if (!SIGLAS_VALIDAS.has(uf)) {
      throw Object.assign(new Error(`UF inválida: '${uf}'`), { status: 400 })
    }
  }
}

function validateCampos(campos: string[]) {
  for (const c of campos) {
    if (!CAMPOS_VALIDOS.includes(c as CampoSubtitulo)) {
      throw Object.assign(new Error(`Campo inválido: '${c}'`), { status: 400 })
    }
  }
  if (new Set(campos).size !== campos.length) {
    throw Object.assign(new Error('subtitulo_campos não pode ter duplicatas'), { status: 400 })
  }
}

async function mapPrismaError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw Object.assign(new Error('Já existe uma competição com este nome.'), { status: 409 })
    }
    throw err
  }
}

export async function listar() {
  return prisma.competicao.findMany({
    orderBy: { nome: 'asc' },
    include: {
      _count: { select: { modalidades: true, eventos: true } },
    },
  })
}

export async function buscarPorId(id: number) {
  const item = await prisma.competicao.findUnique({ where: { id } })
  if (!item) throw Object.assign(new Error('Competição não encontrada'), { status: 404 })
  return item
}

export async function criar(input: {
  nome: string
  estados: string[]
  subtitulo_campos?: string[]
}) {
  validateUfs(input.estados)
  const campos = input.subtitulo_campos ?? []
  validateCampos(campos)
  const data = {
    nome: input.nome,
    estados: input.estados,
    subtitulo_campos: campos,
  }
  return mapPrismaError(() => prisma.competicao.create({ data }))
}

export async function editar(
  id: number,
  input: Partial<{ nome: string; estados: string[]; subtitulo_campos: string[] }>
) {
  if (input.estados !== undefined) validateUfs(input.estados)
  if (input.subtitulo_campos !== undefined) validateCampos(input.subtitulo_campos)
  return mapPrismaError(() => prisma.competicao.update({ where: { id }, data: input }))
}

export async function remover(id: number) {
  const [modalidades, eventos] = await Promise.all([
    prisma.modalidade.count({ where: { competicao_id: id } }),
    prisma.evento.count({ where: { competicao_id: id } }),
  ])
  const motivos: string[] = []
  if (modalidades > 0) motivos.push('modalidades')
  if (eventos > 0) motivos.push('eventos')
  if (motivos.length > 0) {
    throw Object.assign(
      new Error(`Remova os ${motivos.join(' e ')} vinculados antes de excluir esta competição.`),
      { status: 409 }
    )
  }
  return prisma.competicao.delete({ where: { id } })
}
```

- [ ] **Step 2: Atualizar `competicoes.controller.ts`**

Substituir o bloco de schemas (linhas 5-11):

```typescript
const CAMPOS_VALIDOS = ['subtitulo', 'municipio', 'inspetoria', 'delegacia'] as const

const createSchema = z.object({
  nome: z.string().min(1),
  estados: z.array(z.string().length(2)).min(1, 'Selecione ao menos uma UF'),
  subtitulo_campos: z.array(z.enum(CAMPOS_VALIDOS))
    .max(4)
    .refine(arr => new Set(arr).size === arr.length, { message: 'Campos duplicados' })
    .optional()
    .default([]),
})

const updateSchema = createSchema.partial()
```

- [ ] **Step 3: Typecheck**

```
cd backend && npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```
git add backend/src/modules/competicoes/competicoes.service.ts backend/src/modules/competicoes/competicoes.controller.ts
git commit -m "feat(competicoes): service+controller aceita subtitulo_campos com validacao"
```

DO NOT push.

---

### Task 3: Atualizar testes de competicoes.service

**Files:**
- Modify: `backend/src/modules/competicoes/competicoes.service.test.ts`

- [ ] **Step 1: Substituir os 2 testes de `adicionar_subtitulo` por novos para `subtitulo_campos`**

Localizar os testes nas linhas 43-57 e substituí-los por:

```typescript
  it('criar persiste subtitulo_campos vazio por default', async () => {
    mockPrisma.competicao.create.mockResolvedValue({ id: 1 })
    await service.criar({ nome: 'Copa Brasil', estados: ['SP', 'RJ'] })
    expect(mockPrisma.competicao.create).toHaveBeenCalledWith({
      data: { nome: 'Copa Brasil', estados: ['SP', 'RJ'], subtitulo_campos: [] },
    })
  })

  it('criar persiste subtitulo_campos com lista ordenada', async () => {
    mockPrisma.competicao.create.mockResolvedValue({ id: 1 })
    await service.criar({
      nome: 'Copa',
      estados: ['MG'],
      subtitulo_campos: ['subtitulo', 'municipio', 'inspetoria'],
    })
    expect(mockPrisma.competicao.create).toHaveBeenCalledWith({
      data: {
        nome: 'Copa',
        estados: ['MG'],
        subtitulo_campos: ['subtitulo', 'municipio', 'inspetoria'],
      },
    })
  })

  it('criar rejeita campo invalido em subtitulo_campos', async () => {
    await expect(
      service.criar({ nome: 'Copa', estados: ['SP'], subtitulo_campos: ['foo'] })
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('foo') })
    expect(mockPrisma.competicao.create).not.toHaveBeenCalled()
  })

  it('criar rejeita duplicatas em subtitulo_campos', async () => {
    await expect(
      service.criar({
        nome: 'Copa',
        estados: ['SP'],
        subtitulo_campos: ['subtitulo', 'subtitulo'],
      })
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('duplicatas') })
    expect(mockPrisma.competicao.create).not.toHaveBeenCalled()
  })

  it('editar valida subtitulo_campos quando presente', async () => {
    await expect(
      service.editar(1, { subtitulo_campos: ['inspetoria', 'xyz'] })
    ).rejects.toMatchObject({ status: 400 })
    expect(mockPrisma.competicao.update).not.toHaveBeenCalled()
  })

  it('editar aceita subtitulo_campos vazio', async () => {
    mockPrisma.competicao.update.mockResolvedValue({ id: 1 })
    await service.editar(1, { subtitulo_campos: [] })
    expect(mockPrisma.competicao.update).toHaveBeenCalledWith({
      where: { id: 1 }, data: { subtitulo_campos: [] },
    })
  })
```

- [ ] **Step 2: Rodar testes**

```
cd backend && npx vitest run src/modules/competicoes/competicoes.service.test.ts --reporter=verbose
```

Esperado: todos os testes (originais inalterados + 6 novos) passando.

- [ ] **Step 3: Commit**

```
git add backend/src/modules/competicoes/competicoes.service.test.ts
git commit -m "test(competicoes): cobre subtitulo_campos (lista, ordem, duplicatas, vazio)"
```

DO NOT push.

---

## Frontend — Util + Types

### Task 4: Util `compose-subtitulo.ts` (TDD)

**Files:**
- Create: `frontend/src/lib/compose-subtitulo.ts`
- Create: `frontend/src/lib/compose-subtitulo.test.ts`

- [ ] **Step 1: Verificar se vitest está disponível no frontend**

```
cd frontend && npx vitest --version 2>&1 | head -3
```

Se não estiver instalado, pular Step 1-4 (testes) e ir direto para implementar (Step 5). Anote a decisão no commit.

- [ ] **Step 2: Escrever testes falhantes** (se vitest existe)

`frontend/src/lib/compose-subtitulo.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { composeSubtituloLine } from './compose-subtitulo'

const fullP = {
  subtitulo: 'Clube XYZ',
  municipio: { nome: 'Campinas', uf: 'SP' },
  inspetoria: { id: 1, nome: 'Inspetoria Sul', criado_em: '', atualizado_em: '' },
  delegacia: { id: 1, nome: 'Delegacia Centro', criado_em: '', atualizado_em: '' },
}

describe('composeSubtituloLine', () => {
  it('retorna null quando campos vazios', () => {
    expect(composeSubtituloLine(fullP as any, [])).toBeNull()
  })

  it('retorna campo único quando só um selecionado', () => {
    expect(composeSubtituloLine(fullP as any, ['subtitulo'])).toBe('Clube XYZ')
  })

  it('junta múltiplos campos na ordem com " | "', () => {
    expect(composeSubtituloLine(fullP as any, ['subtitulo', 'municipio'])).toBe('Clube XYZ | Campinas/SP')
  })

  it('preserva ordem do array', () => {
    expect(composeSubtituloLine(fullP as any, ['municipio', 'subtitulo'])).toBe('Campinas/SP | Clube XYZ')
  })

  it('omite silenciosamente campos vazios/null', () => {
    const p = { ...fullP, subtitulo: null }
    expect(composeSubtituloLine(p as any, ['subtitulo', 'municipio'])).toBe('Campinas/SP')
  })

  it('retorna null se TODOS os campos selecionados são vazios', () => {
    const p = { subtitulo: null, municipio: null, inspetoria: null, delegacia: null }
    expect(composeSubtituloLine(p as any, ['subtitulo', 'inspetoria'])).toBeNull()
  })

  it('omite inspetoria/delegacia quando relação é null', () => {
    const p = { ...fullP, inspetoria: null }
    expect(composeSubtituloLine(p as any, ['subtitulo', 'inspetoria', 'delegacia']))
      .toBe('Clube XYZ | Delegacia Centro')
  })

  it('formata municipio como nome/UF', () => {
    expect(composeSubtituloLine(fullP as any, ['municipio'])).toBe('Campinas/SP')
  })
})
```

- [ ] **Step 3: Rodar testes** (esperado falhar)

```
cd frontend && npx vitest run src/lib/compose-subtitulo.test.ts --reporter=verbose
```

Esperado: FAIL ("Cannot find module './compose-subtitulo'").

- [ ] **Step 4: Implementar `compose-subtitulo.ts`**

`frontend/src/lib/compose-subtitulo.ts`:

```typescript
import type { Participante } from '../types/participante'

export type CampoSubtitulo = 'subtitulo' | 'municipio' | 'inspetoria' | 'delegacia'

type ParticipanteLike = Pick<
  Participante,
  'subtitulo' | 'municipio' | 'inspetoria' | 'delegacia'
>

/**
 * Compõe a "linha de info adicional" de um participante, juntando os campos
 * selecionados na ordem definida, separados por ` | `. Campos vazios/null
 * são omitidos silenciosamente. Retorna `null` se nenhum campo compõe.
 */
export function composeSubtituloLine(
  p: ParticipanteLike,
  campos: CampoSubtitulo[],
): string | null {
  const partes: string[] = []
  for (const c of campos) {
    let v: string | null = null
    if (c === 'subtitulo') v = p.subtitulo || null
    else if (c === 'municipio' && p.municipio) v = `${p.municipio.nome}/${p.municipio.uf}`
    else if (c === 'inspetoria' && p.inspetoria) v = p.inspetoria.nome
    else if (c === 'delegacia' && p.delegacia) v = p.delegacia.nome
    if (v) partes.push(v)
  }
  return partes.length > 0 ? partes.join(' | ') : null
}
```

- [ ] **Step 5: Rodar testes** (esperado passar, se vitest existe)

```
cd frontend && npx vitest run src/lib/compose-subtitulo.test.ts --reporter=verbose
```

Esperado: 8 testes passando.

Se vitest não existe: rodar typecheck no lugar: `cd frontend && npx tsc --noEmit`.

- [ ] **Step 6: Commit**

```
git add frontend/src/lib/compose-subtitulo.ts frontend/src/lib/compose-subtitulo.test.ts
git commit -m "feat(util): composeSubtituloLine — junta campos na ordem com pipe"
```

DO NOT push.

---

### Task 5: Atualizar type `Competicao` no frontend

**Files:**
- Modify: `frontend/src/types/competicao.ts`

- [ ] **Step 1: Substituir o arquivo**

`frontend/src/types/competicao.ts`:

```typescript
export type CampoSubtitulo = 'subtitulo' | 'municipio' | 'inspetoria' | 'delegacia'

export type Competicao = {
  id: number
  nome: string
  estados: string[]
  subtitulo_campos: CampoSubtitulo[]
  criado_em: string
  atualizado_em: string
  _count?: {
    modalidades: number
    eventos: number
  }
}
```

- [ ] **Step 2: Typecheck** (vai falhar nos callsites de `adicionar_subtitulo` — esperado, será corrigido nas próximas tasks)

```
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Esperado: erros nos arquivos que ainda usam `adicionar_subtitulo`. NÃO commitar ainda (será incluído junto com CompeticaoForm em Task 6).

---

### Task 6: Atualizar `CompeticaoForm.tsx` (UI nova)

**Files:**
- Modify: `frontend/src/pages/competicoes/CompeticaoForm.tsx`

- [ ] **Step 1: Atualizar imports e estado**

Trocar:
```typescript
import { Check, X, Trophy } from '../../lib/icons'
```

Por:
```typescript
import { Check, X, Trophy } from '../../lib/icons'
import { ChevronUp, ChevronDown } from 'lucide-react'
import type { CampoSubtitulo } from '../../types/competicao'
import { composeSubtituloLine } from '../../lib/compose-subtitulo'

const CAMPOS_LABELS: Record<CampoSubtitulo, string> = {
  subtitulo: 'Subtítulo',
  municipio: 'Município (nome/UF)',
  inspetoria: 'Inspetoria',
  delegacia: 'Delegacia',
}
const CAMPOS_ORDEM: CampoSubtitulo[] = ['subtitulo', 'municipio', 'inspetoria', 'delegacia']
```

Substituir o state `adicionarSubtitulo`:
```typescript
const [adicionarSubtitulo, setAdicionarSubtitulo] = useState(false)
```
por:
```typescript
const [campos, setCampos] = useState<CampoSubtitulo[]>([])
```

- [ ] **Step 2: Atualizar `useEffect` que carrega `existing`**

Trocar:
```typescript
setAdicionarSubtitulo(existing.adicionar_subtitulo)
```
por:
```typescript
setCampos(existing.subtitulo_campos ?? [])
```

- [ ] **Step 3: Atualizar `mutate: salvar`**

Trocar:
```typescript
const payload = { nome, estados, adicionar_subtitulo: adicionarSubtitulo }
```
por:
```typescript
const payload = { nome, estados, subtitulo_campos: campos }
```

- [ ] **Step 4: Adicionar helpers de toggle e reorder**

Após a função `selecionarRegiao` (linha ~68), adicionar:
```typescript
function toggleCampo(c: CampoSubtitulo) {
  setCampos(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
}
function moverCampo(c: CampoSubtitulo, dir: -1 | 1) {
  setCampos(prev => {
    const i = prev.indexOf(c)
    const j = i + dir
    if (i < 0 || j < 0 || j >= prev.length) return prev
    const arr = [...prev]
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    return arr
  })
}
```

- [ ] **Step 5: Substituir o "Card: Configurações" (linhas 223-267)**

Localizar o bloco `{/* Card: Configurações */}` e substituir o `<section>...</section>` inteiro por:

```typescript
      {/* Card: Configurações */}
      <section
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-xl)',
          padding: 24,
          marginBottom: isEdit ? 0 : 16,
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div className="mb-4">
          <div className="eyebrow">Opções</div>
          <h3 className="sec-title" style={{ fontSize: 17 }}>
            Linha de exibição do participante
          </h3>
          <p className="text-xs text-[var(--t3)] mt-1">
            Selecione e ordene os campos que aparecerão ao lado do nome do participante nos sorteios.
          </p>
        </div>

        {/* Checkboxes de seleção */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginBottom: 16 }}>
          {CAMPOS_ORDEM.map(c => {
            const ativo = campos.includes(c)
            return (
              <label key={c} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px',
                background: ativo ? 'var(--brand-50)' : 'var(--card-bg-2)',
                border: `1px solid ${ativo ? 'var(--brand-500)' : 'var(--card-border)'}`,
                borderRadius: 'var(--radius-lg)',
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}>
                <input
                  type="checkbox"
                  checked={ativo}
                  onChange={() => toggleCampo(c)}
                  className="rounded border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--brand-500)] focus:ring-[var(--brand-500)]"
                />
                <span className="text-sm font-medium text-[var(--t1)]">{CAMPOS_LABELS[c]}</span>
              </label>
            )
          })}
        </div>

        {/* Reorder + preview */}
        {campos.length > 0 ? (
          <>
            <div className="eyebrow mb-2">Ordem de exibição</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {campos.map((c, i) => (
                <div key={c} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px',
                  background: 'var(--card-bg-2)',
                  border: '1px solid var(--card-border)',
                  borderRadius: 'var(--radius-md)',
                }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--t4)', minWidth: 20 }}>
                    {i + 1}.
                  </span>
                  <span className="text-sm flex-1 text-[var(--t1)]">{CAMPOS_LABELS[c]}</span>
                  <button
                    type="button"
                    onClick={() => moverCampo(c, -1)}
                    disabled={i === 0}
                    className="p-1 text-[var(--t3)] hover:text-[var(--brand-500)] disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Mover para cima"
                  ><ChevronUp size={16} /></button>
                  <button
                    type="button"
                    onClick={() => moverCampo(c, 1)}
                    disabled={i === campos.length - 1}
                    className="p-1 text-[var(--t3)] hover:text-[var(--brand-500)] disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Mover para baixo"
                  ><ChevronDown size={16} /></button>
                </div>
              ))}
            </div>
            <div style={{
              padding: '10px 14px',
              background: 'var(--brand-50)',
              border: '1px solid var(--brand-500)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
            }}>
              <span className="text-[var(--t3)] mr-2">Preview:</span>
              <b className="text-[var(--brand-700)]">João Silva</b>
              <span className="text-[var(--t2)] ml-2">
                {composeSubtituloLine(
                  {
                    subtitulo: 'Clube XYZ',
                    municipio: { nome: 'Campinas', uf: 'SP' } as any,
                    inspetoria: { nome: 'Inspetoria Sul' } as any,
                    delegacia: { nome: 'Delegacia Centro' } as any,
                  },
                  campos
                )}
              </span>
            </div>
          </>
        ) : (
          <p className="text-xs text-[var(--t4)] italic">
            Nenhuma informação adicional será exibida ao lado do nome.
          </p>
        )}
      </section>
```

- [ ] **Step 6: Typecheck**

```
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Esperado: ainda há erros em outros callsites (CampeaoSlot, SorteioOrdem, etc.) — será resolvido em tasks 7-11. O CompeticaoForm em si deve estar OK.

- [ ] **Step 7: Commit**

```
git add frontend/src/types/competicao.ts frontend/src/pages/competicoes/CompeticaoForm.tsx
git commit -m "feat(competicoes): UI de subtitulo_campos com reorder + preview"
```

DO NOT push.

---

### Task 7: Componentes de sorteio — trocar `mostrarSubtitulo` por `subtituloLine`

**Files:**
- Modify: `frontend/src/components/sorteio-result/SorteioOrdem.tsx`
- Modify: `frontend/src/components/sorteio-result/SorteioGrupos.tsx`
- Modify: `frontend/src/components/sorteio-result/SorteioChaves.tsx`
- Modify: `frontend/src/components/sorteio-result/BracketTree.tsx`
- Modify: `frontend/src/components/CampeaoSlot.tsx`

- [ ] **Step 1: Atualizar `SorteioOrdem.tsx`**

Substituir o arquivo inteiro por:

```typescript
import type { OrdemResultado } from '../../types/sorteio'
import type { Participante } from '../../types/participante'

type Props = {
  resultado: OrdemResultado
  participantesById: Map<number, Participante>
  large?: boolean
  subtituloLine?: (p: Participante) => string | null
}

export default function SorteioOrdem({ resultado, participantesById, large = false, subtituloLine }: Props) {
  const cardPad = large ? 'p-6' : 'p-4'
  const itemSpacing = large ? 'space-y-3' : 'space-y-1.5'
  const itemClass = large ? 'text-xl text-[var(--t1)]' : 'text-sm text-[var(--t1)]'
  const indexClass = large
    ? 'font-mono text-lg font-bold text-[var(--brand-500)] w-10 text-right'
    : 'font-mono text-sm font-bold text-[var(--brand-500)] w-8 text-right'
  const subClass = large ? 'text-base text-[var(--t3)] ml-2' : 'text-xs text-[var(--t3)] ml-1'

  return (
    <div className={`bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-xl ${cardPad}`}>
      <ol className={itemSpacing}>
        {resultado.ordem.map((pid, idx) => {
          const p = participantesById.get(pid)
          const linha = p && subtituloLine ? subtituloLine(p) : null
          return (
            <li key={pid} className={`flex items-center gap-3 ${itemClass}`}>
              <span className={indexClass}>{idx + 1}.</span>
              {p
                ? <span>{p.nome}{linha ? <span className={subClass}>— {linha}</span> : null}</span>
                : <span className="text-[var(--t4)]">—</span>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
```

- [ ] **Step 2: Atualizar `SorteioGrupos.tsx`**

Localizar o tipo `Props`:
```typescript
type Props = {
  ...
  mostrarSubtitulo?: boolean
}
```
trocar `mostrarSubtitulo?: boolean` por `subtituloLine?: (p: Participante) => string | null`.

Localizar a função `export default function SorteioGrupos(...)`: trocar `mostrarSubtitulo = false` no destructuring por `subtituloLine`.

Localizar a linha:
```typescript
{mostrarSubtitulo && p?.subtitulo && <span className={subItemClass}>— {p.subtitulo}</span>}
```
substituir por:
```typescript
{p && (() => { const l = subtituloLine?.(p); return l ? <span className={subItemClass}>— {l}</span> : null })()}
```

- [ ] **Step 3: Atualizar `SorteioChaves.tsx` (Props principal + SlotRender + MatchCard)**

**3a.** No `Props` (linha ~6-12), trocar `mostrarSubtitulo?: boolean` por `subtituloLine?: (p: Participante) => string | null`.

**3b.** No `SlotRenderProps` (linha ~64-71), trocar `mostrarSubtitulo?: boolean` por `subtituloLine?: (p: Participante) => string | null`.

**3c.** Na função `SlotRender`, trocar o destructuring `mostrarSubtitulo = false` por `subtituloLine`. Localizar:
```typescript
{mostrarSubtitulo && p.subtitulo && <span style={{ fontSize: '0.85em', color: 'var(--t3)', marginLeft: 4 }}>— {p.subtitulo}</span>}
```
substituir por:
```typescript
{(() => { const l = subtituloLine?.(p); return l ? <span style={{ fontSize: '0.85em', color: 'var(--t3)', marginLeft: 4 }}>— {l}</span> : null })()}
```

**3d.** No `MatchCardProps`, trocar `mostrarSubtitulo?: boolean` por `subtituloLine?: (p: Participante) => string | null`.

**3e.** Na função `MatchCard`, no destructuring trocar `mostrarSubtitulo = false` por `subtituloLine`. Atualizar as 2 chamadas a `<SlotRender>`:
```typescript
mostrarSubtitulo={mostrarSubtitulo}
```
substituir por:
```typescript
subtituloLine={subtituloLine}
```

**3f.** Na função `SorteioChaves`, no destructuring trocar `mostrarSubtitulo = false` por `subtituloLine`. Atualizar a chamada a `<MatchCard>`:
```typescript
mostrarSubtitulo={mostrarSubtitulo}
```
substituir por:
```typescript
subtituloLine={subtituloLine}
```

**3g.** Localizar (próximo à linha 191):
```typescript
{mostrarSubtitulo && participante.subtitulo && <span className={subClass}>— {participante.subtitulo}</span>}
```
substituir por:
```typescript
{(() => { const l = subtituloLine?.(participante); return l ? <span className={subClass}>— {l}</span> : null })()}
```

- [ ] **Step 4: Atualizar `BracketTree.tsx`**

Verificar se BracketTree usa `mostrarSubtitulo`. Rodar:

```
grep -n "mostrarSubtitulo" /c/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend/src/components/sorteio-result/BracketTree.tsx
```

Se houver matches (não havia em 1.32.x mas pode ter sido adicionado em SorteioChaves wrapper), aplicar o mesmo padrão: trocar prop e usar `subtituloLine?.(p)`. Se não houver matches, pular este step.

- [ ] **Step 5: Atualizar `CampeaoSlot.tsx`**

Localizar o tipo `Props`:
```typescript
type Props = {
  ...
  mostrarSubtitulo?: boolean
}
```
trocar `mostrarSubtitulo?: boolean` por:
```typescript
subtituloLine?: (p: { subtitulo: string | null; municipio: any; inspetoria: any; delegacia: any }) => string | null
```

Na função (linha 18), trocar destructuring `mostrarSubtitulo = false` por `subtituloLine`.

Localizar (linha 28-30):
```typescript
{mostrarSubtitulo && campeao.participante.subtitulo && (
  <div className="text-xs text-[var(--t3)] mt-0.5">{campeao.participante.subtitulo}</div>
)}
```
substituir por:
```typescript
{(() => { const l = subtituloLine?.(campeao.participante as any); return l ? (
  <div className="text-xs text-[var(--t3)] mt-0.5">{l}</div>
) : null })()}
```

- [ ] **Step 6: Typecheck**

```
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Esperado: erros remanescentes apenas nos pages (que ainda passam `mostrarSubtitulo`). Componentes em si devem compilar.

- [ ] **Step 7: Commit**

```
git add frontend/src/components/sorteio-result/ frontend/src/components/CampeaoSlot.tsx
git commit -m "feat(sorteio): componentes recebem subtituloLine callback (substitui mostrarSubtitulo)"
```

DO NOT push.

---

### Task 8: Atualizar `EventoInscricoes.tsx`

**Files:**
- Modify: `frontend/src/pages/eventos/EventoInscricoes.tsx`

- [ ] **Step 1: Atualizar imports**

Após a linha 13 (último import), adicionar:
```typescript
import { composeSubtituloLine } from '../../lib/compose-subtitulo'
```

- [ ] **Step 2: Substituir derivação de `mostrarSubtitulo`**

Localizar (linha 126):
```typescript
const mostrarSubtitulo = evento?.competicao?.adicionar_subtitulo ?? false
```
substituir por:
```typescript
const camposSubtitulo = evento?.competicao?.subtitulo_campos ?? []
const subtituloLine = (p: any) => composeSubtituloLine(p, camposSubtitulo)
```

- [ ] **Step 3: Atualizar chip de inscritos (linhas 536-548)**

Localizar:
```typescript
{((mostrarSubtitulo && i.participante.subtitulo) || i.participante.municipio) && (
  <div
    className="text-[var(--t4)] mt-0.5"
    style={{
      fontSize: 11,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }}
  >
    {mostrarSubtitulo ? (i.participante.subtitulo ?? '') : ''}
    {mostrarSubtitulo && i.participante.subtitulo && i.participante.municipio && ' · '}
    {i.participante.municipio
      ? `${i.participante.municipio.nome}/${i.participante.municipio.uf}`
      : ''}
  </div>
)}
```

substituir por:
```typescript
{(() => {
  const linha = subtituloLine(i.participante)
  const mun = i.participante.municipio ? `${i.participante.municipio.nome}/${i.participante.municipio.uf}` : ''
  // Se a linha já inclui municipio (campo selecionado), não duplicar.
  const incluiMunicipio = camposSubtitulo.includes('municipio')
  const partes = [linha, !incluiMunicipio ? mun : ''].filter(Boolean)
  return partes.length > 0 ? (
    <div
      className="text-[var(--t4)] mt-0.5"
      style={{
        fontSize: 11,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {partes.join(' · ')}
    </div>
  ) : null
})()}
```

- [ ] **Step 4: Atualizar chamadas a `<SorteioOrdem>`, `<SorteioGrupos>`, `<SorteioChaves>`, `<CampeaoSlot>`**

Buscar `mostrarSubtitulo={mostrarSubtitulo}` no arquivo e substituir TODAS por `subtituloLine={subtituloLine}`.

Comando para validar:
```
grep -n "mostrarSubtitulo" /c/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend/src/pages/eventos/EventoInscricoes.tsx
```
Esperado após substituições: nenhum match.

- [ ] **Step 5: Typecheck**

```
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Esperado: apenas erros nos pages Congresso/Import/Relatorio (próximas tasks).

- [ ] **Step 6: Commit**

```
git add frontend/src/pages/eventos/EventoInscricoes.tsx
git commit -m "feat(inscricoes): usa subtituloLine derivado de subtitulo_campos"
```

DO NOT push.

---

### Task 9: Atualizar pages do Modo Congresso

**Files:**
- Modify: `frontend/src/pages/congresso/CongressoStepParticipantes.tsx`
- Modify: `frontend/src/pages/congresso/CongressoStepSorteio.tsx`
- Modify: `frontend/src/pages/congresso/CongressoStepCampeoes.tsx`

- [ ] **Step 1: `CongressoStepParticipantes.tsx`**

Adicionar import perto dos demais (linha 5-7):
```typescript
import { composeSubtituloLine } from '../../lib/compose-subtitulo'
```

Localizar (linha 50):
```typescript
const mostrarSubtitulo = competicao?.adicionar_subtitulo ?? false
```
substituir por:
```typescript
const camposSubtitulo = competicao?.subtitulo_campos ?? []
```

Localizar (linha 117-119):
```typescript
{mostrarSubtitulo && i.participante.subtitulo && (
  <span className="cw-prow-club">{i.participante.subtitulo}</span>
)}
```
substituir por:
```typescript
{(() => {
  const l = composeSubtituloLine(i.participante, camposSubtitulo)
  return l ? <span className="cw-prow-club">{l}</span> : null
})()}
```

- [ ] **Step 2: `CongressoStepSorteio.tsx`**

Adicionar import:
```typescript
import { composeSubtituloLine } from '../../lib/compose-subtitulo'
```

Localizar (linha 48):
```typescript
const mostrarSubtitulo = competicao?.adicionar_subtitulo ?? false
```
substituir por:
```typescript
const camposSubtitulo = competicao?.subtitulo_campos ?? []
const subtituloLine = (p: any) => composeSubtituloLine(p, camposSubtitulo)
```

Localizar (~linhas 332-340) — chamadas aos componentes `<SorteioGrupos>`, `<SorteioChaves>`, `<SorteioOrdem>`:
- Trocar todas as ocorrências de `mostrarSubtitulo={mostrarSubtitulo}` por `subtituloLine={subtituloLine}`.

Localizar a modal de grupo expandido (~linha 479):
```typescript
{mostrarSubtitulo && p?.subtitulo && <span style={{ fontSize: '0.7em', color: DIM, marginLeft: 12 }}>— {p.subtitulo}</span>}
```
substituir por:
```typescript
{(() => { const l = p ? subtituloLine(p) : null; return l ? <span style={{ fontSize: '0.7em', color: DIM, marginLeft: 12 }}>— {l}</span> : null })()}
```

- [ ] **Step 3: `CongressoStepCampeoes.tsx`**

Adicionar import:
```typescript
import { composeSubtituloLine } from '../../lib/compose-subtitulo'
```

Localizar (linha 50):
```typescript
const mostrarSubtitulo = competicao?.adicionar_subtitulo ?? false
```
substituir por:
```typescript
const camposSubtitulo = competicao?.subtitulo_campos ?? []
```

Localizar (linha 123):
```typescript
{mostrarSubtitulo && c.participante.subtitulo && (
```

Substituir o bloco do subtítulo (até `)}` correspondente) por:
```typescript
{(() => {
  const l = composeSubtituloLine(c.participante, camposSubtitulo)
  return l ? <div>{l}</div> : null
})()}
```

(O JSX exato do `<div>` que envolve subtitulo era simples; preservar a className/style original do bloco substituído.)

- [ ] **Step 4: Validar zero matches restantes**

```
grep -n "mostrarSubtitulo\|adicionar_subtitulo" /c/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend/src/pages/congresso/
```
Esperado: nenhum match.

- [ ] **Step 5: Typecheck**

```
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Esperado: erros restantes apenas em Import/Relatorio.

- [ ] **Step 6: Commit**

```
git add frontend/src/pages/congresso/
git commit -m "feat(congresso): pages usam composeSubtituloLine"
```

DO NOT push.

---

### Task 10: ImportInscricoesModal — template dinâmico

**Files:**
- Modify: `frontend/src/components/import/ImportInscricoesModal.tsx`

- [ ] **Step 1: Substituir derivação `mostrarSubtitulo`**

Localizar (linha 49):
```typescript
const mostrarSubtitulo = evento?.competicao?.adicionar_subtitulo ?? false
```
substituir por:
```typescript
const camposSubtitulo = evento?.competicao?.subtitulo_campos ?? []
const incluiSubtitulo = camposSubtitulo.includes('subtitulo')
```

- [ ] **Step 2: Atualizar `template` (linhas 51-69)**

Localizar `const template = mostrarSubtitulo ? {...} : {...}` e trocar a condicional para usar `incluiSubtitulo`:

```typescript
const template = incluiSubtitulo
  ? {
      filename: 'modelo_inscricoes.csv',
      headers: ['nome', 'subtitulo', 'municipio_uf', 'municipio_nome'],
      exampleRows: [
        ['João Silva', 'Clube Atlético', 'SP', 'São Paulo'],
        ['Maria Souza', '', 'RJ', 'Rio de Janeiro'],
        ['Pedro Oliveira', 'Equipe Sub-15', 'MG', 'Belo Horizonte'],
      ],
    }
  : {
      filename: 'modelo_inscricoes.csv',
      headers: ['nome', 'municipio_uf', 'municipio_nome'],
      exampleRows: [
        ['João Silva', 'SP', 'São Paulo'],
        ['Maria Souza', 'RJ', 'Rio de Janeiro'],
        ['Pedro Oliveira', 'MG', 'Belo Horizonte'],
      ],
    }
```

- [ ] **Step 3: Atualizar preview JSX (linhas 229-247)**

Substituir TODAS as ocorrências de `mostrarSubtitulo` por `incluiSubtitulo` neste arquivo. Comando para validar:
```
grep -n "mostrarSubtitulo" /c/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend/src/components/import/ImportInscricoesModal.tsx
```
Esperado após substituições: nenhum match.

- [ ] **Step 4: Typecheck**

```
cd frontend && npx tsc --noEmit 2>&1 | head -10
```

Esperado: apenas erros em Relatorio.tsx (próxima task) e CompeticoesList.tsx (Task 12).

- [ ] **Step 5: Commit**

```
git add frontend/src/components/import/ImportInscricoesModal.tsx
git commit -m "feat(import): template CSV reflete subtitulo_campos"
```

DO NOT push.

---

### Task 11: Relatorio.tsx — colunas dinâmicas no CSV

**Files:**
- Modify: `frontend/src/pages/Relatorio.tsx`

- [ ] **Step 1: Inspecionar trecho atual da exportação**

Abrir o arquivo e localizar a função que monta `headers` e `rows`. Procurar:
```
grep -n "participante_subtitulo\|subtitulo\|adicionar_subtitulo\|mostrarSubtitulo" /c/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend/src/pages/Relatorio.tsx
```

- [ ] **Step 2: Atualizar derivação e includes condicionais**

Onde houver:
```typescript
const mostrarSubtitulo = evento.competicao?.adicionar_subtitulo ?? false
```
substituir por:
```typescript
const camposSubtitulo = evento.competicao?.subtitulo_campos ?? []
const incluiSubtitulo = camposSubtitulo.includes('subtitulo')
```

E onde houver controles condicionais `mostrarSubtitulo ? [...] : []`, trocar por `incluiSubtitulo ? [...] : []`.

Comando para validar zero ocorrências:
```
grep -n "mostrarSubtitulo\|adicionar_subtitulo" /c/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend/src/pages/Relatorio.tsx
```
Esperado: nenhum match.

- [ ] **Step 3: Typecheck**

```
cd frontend && npx tsc --noEmit 2>&1 | head -10
```

Esperado: apenas erro restante em CompeticoesList.tsx (próxima task).

- [ ] **Step 4: Commit**

```
git add frontend/src/pages/Relatorio.tsx
git commit -m "feat(relatorio): CSV omite coluna subtitulo conforme subtitulo_campos"
```

DO NOT push.

---

### Task 12: CompeticoesList.tsx — badge "com subtítulo"

**Files:**
- Modify: `frontend/src/pages/competicoes/CompeticoesList.tsx`

- [ ] **Step 1: Atualizar o badge**

Localizar (linha 187-191):
```typescript
{c.adicionar_subtitulo && (
  <span style={{ fontSize: 11, color: 'var(--t4)', fontStyle: 'italic' }}>
    com subtítulo
  </span>
)}
```

substituir por:
```typescript
{c.subtitulo_campos && c.subtitulo_campos.length > 0 && (
  <span style={{ fontSize: 11, color: 'var(--t4)', fontStyle: 'italic' }} title={`Campos: ${c.subtitulo_campos.join(' | ')}`}>
    {c.subtitulo_campos.length === 1 ? '1 campo extra' : `${c.subtitulo_campos.length} campos extras`}
  </span>
)}
```

- [ ] **Step 2: Typecheck final**

```
cd frontend && npx tsc --noEmit
```

Esperado: **sem erros**.

- [ ] **Step 3: Build do frontend**

```
cd frontend && npm run build
```

Esperado: build OK.

- [ ] **Step 4: Commit**

```
git add frontend/src/pages/competicoes/CompeticoesList.tsx
git commit -m "feat(competicoes): badge da lista mostra count de campos extras"
```

DO NOT push.

---

### Task 13: Release v1.33.0 + smoke test

**Files:**
- Modify: `package.json` (raiz)
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Bumpar versão para `1.33.0`**

Em `package.json` raiz:
```json
  "version": "1.33.0",
```

- [ ] **Step 2: Adicionar entrada no CHANGELOG.md**

No topo das entradas:
```markdown
## [1.33.0] - 2026-05-31

### Added (Subtítulo parametrizável por Competição)
- **Schema**: `Competicao.subtitulo_campos: String[]` substitui o boolean `adicionar_subtitulo`. Migration preserva comportamento atual (`true` → `['subtitulo']`).
- **Backend**: zod valida enum (`subtitulo | municipio | inspetoria | delegacia`), rejeita duplicatas e máx 4 itens.
- **Frontend**: novo utilitário `composeSubtituloLine(participante, campos)` junta valores na ordem definida com ` | `, omite vazios silenciosamente.
- **CompeticaoForm**: nova seção "Linha de exibição do participante" com checkboxes + setas ↑↓ para reordenar + preview ao vivo.
- **Componentes de sorteio** (`SorteioOrdem`, `SorteioGrupos`, `SorteioChaves`, `CampeaoSlot`): trocam prop `mostrarSubtitulo: boolean` por `subtituloLine: (p) => string | null`.
- **Pages**: `EventoInscricoes`, `CongressoStep × 3`, `ImportInscricoesModal`, `Relatorio` derivam `subtituloLine` de `evento.competicao.subtitulo_campos` e propagam.
- **CompeticoesList**: badge "com subtítulo" virou contador "X campos extras" com tooltip listando os campos.
- **Telas globais** (ParticipantesList, ParticipanteForm, ParticipanteSelect): sem mudança, continuam mostrando subtítulo sempre.

### Migration
- `adicionar_subtitulo = true` → `subtitulo_campos = ['subtitulo']`
- `adicionar_subtitulo = false` → `subtitulo_campos = []`
- Coluna `adicionar_subtitulo` removida.
```

- [ ] **Step 3: Rodar todos os testes do backend**

```
cd backend && npx vitest run --reporter=dot
```

Esperado: todos passando.

- [ ] **Step 4: Build do frontend (sanity)**

```
cd frontend && npm run build
```

Esperado: build OK.

- [ ] **Step 5: Commit + push**

```
git add package.json CHANGELOG.md
git commit -m "chore: v1.33.0 — subtitulo_campos parametrizavel por competicao"
git push origin develop
```

Esperado: push aciona o CI/CD; em ~3-5 min o deploy estará no ar em `http://192.168.56.113:8080`.

- [ ] **Step 6: Smoke test manual (após deploy)**

1. Editar uma Competição existente. Verificar que a UI mostra os campos selecionados (se já tinha `adicionar_subtitulo=true`, deve mostrar checkbox "Subtítulo" marcado).
2. Adicionar "Município" e "Inspetoria"; reordenar via ↑/↓; salvar.
3. Ir em Eventos → Inscrições da modalidade dessa competição → conferir que o chip de inscrito mostra `Subtítulo | Município/UF | Inspetoria`.
4. Realizar sorteio → conferir que SorteioGrupos/Chaves/Ordem renderizam a linha composta.
5. Modo Congresso → Sorteio → conferir linha composta nos cards.
6. Importar CSV: se `subtitulo` está nos campos, template tem 4 colunas; se não, 3.
7. Relatório: conferir que CSV omite/inclui `participante_subtitulo` conforme configuração.

---

## Self-review

**Spec coverage:**

| Spec item | Tarefa |
|---|---|
| Schema: `Competicao.subtitulo_campos: String[]` | Task 1 |
| Migration preservando comportamento | Task 1 |
| Backend zod: enum + sem duplicatas + max 4 | Task 2 |
| Backend service valida campos | Task 2 |
| Tests backend (criar, editar, enum inválido, duplicatas) | Task 3 |
| Frontend util `composeSubtituloLine` | Task 4 |
| Tests util (8 cenários) | Task 4 |
| Type `Competicao` atualizado | Task 5 |
| CompeticaoForm com checkbox + reorder + preview | Task 6 |
| Componentes sorteio recebem callback | Task 7 |
| `EventoInscricoes` deriva e propaga | Task 8 |
| Pages Congresso atualizados | Task 9 |
| `ImportInscricoesModal` template dinâmico | Task 10 |
| `Relatorio` CSV dinâmico | Task 11 |
| `CompeticoesList` badge atualizado | Task 12 |
| Release v1.33.0 + CHANGELOG + smoke | Task 13 |

**Placeholders:** revisado — sem "TBD", todas as funções referenciadas (`composeSubtituloLine`, `toggleCampo`, `moverCampo`, `CAMPOS_LABELS`) estão definidas em alguma task.

**Type consistency:**
- `CampoSubtitulo` exportado tanto de `frontend/src/types/competicao.ts` (Task 5) quanto inferido de `'subtitulo' | 'municipio' | 'inspetoria' | 'delegacia'` em `compose-subtitulo.ts` (Task 4) — consistente.
- `subtitulo_campos: CampoSubtitulo[]` no type bate com o Prisma `String[]` (Task 1) e zod `z.enum(CAMPOS_VALIDOS)` (Task 2).
- Callback `subtituloLine: (p) => string | null` consistente em todos os componentes (Task 7) e callers (Tasks 8-9).

**Riscos conhecidos:**

1. **Migration destrutiva**: drop column `adicionar_subtitulo` não tem rollback automático. Se precisar, recriar via SQL: `ALTER TABLE "Competicao" ADD COLUMN "adicionar_subtitulo" BOOLEAN DEFAULT false; UPDATE "Competicao" SET "adicionar_subtitulo" = ('subtitulo' = ANY(subtitulo_campos));`. Documentar no PR.
2. **CongressoStepCampeoes.tsx** (Task 9 Step 3) — assumi um JSX simples envolvendo subtitulo. Se a estrutura real for diferente (ex.: classe específica), preservar a classe ao substituir.
3. **Frontend vitest** (Task 4) — se vitest não está instalado, pular testes e adicionar nota no commit. Build typecheck (`tsc --noEmit`) é o gate mínimo.
4. **EventoInscricoes chip** (Task 8 Step 3) — o chip historicamente combinava `subtitulo` + `municipio` com `·`. A nova lógica usa a linha composta + opcionalmente o município (se não estiver em camposSubtitulo). Pode resultar em layout sutilmente diferente. Validar no smoke test.
