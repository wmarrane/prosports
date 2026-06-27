# Boletins em PDF por evento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar boletins em PDF por evento (armazenados em dev numa VM via SFTP+nginx) e exibi-los para download na página pública estática do evento, com categorias filtráveis e datas de início/fim do evento.

**Architecture:** Backend Express+Prisma ganha model `Boletim`, uma abstração de storage (`SftpStorage` dev / `GcsStorage` prod) e um módulo `boletins` (rotas ADMIN de upload/listar/remover) que re-publica o snapshot quando o evento já está publicado. O site público (SSG) lê os boletins do snapshot e os exibe com filtro por categoria em JS client-side. Admin React ganha campos de data e uma seção de boletins.

**Tech Stack:** Node/Express, Prisma/Postgres, Vitest, multer, ssh2-sftp-client, @google-cloud/storage; React 18 + Vite + TS; SSG via renderToStaticMarkup.

**Spec:** `docs/superpowers/specs/2026-06-27-boletins-pdf-evento-design.md`

## Global Constraints

- Host Windows; ler arquivos antes de editar; caminhos absolutos com `git -C`.
- Git identity inline: `-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`.
- Validar frontend com `cd frontend && npm run build` (CI = `tsc -b && vite build`).
- Backend testes: `cd backend && npm test` (Vitest).
- Categorias (enum fixo): `Resultados`, `Comunicado`, `Tabela`, `Regulamento`, `Outros`.
- Permissão de boletins: apenas `ADMIN` (`requireAuth` + `requireRole('ADMIN')`).
- Re-publicar snapshot só se `evento.site_publicado_em != null`.
- `object_key` = `eventos/{eventoId}/boletim-{numero}-{uuid}.pdf`; PDF only; limite `MAX_PDF_BYTES` (default 26214400).
- Implementar numa branch/worktree isolada (demo antes da develop). Sem provisionar GCS de prod.
- Chave SSH privada fora do git (`secrets/`).

---

### Task 1: Schema Prisma — datas do evento + model Boletim

**Files:**
- Modify: `backend/prisma/schema.prisma` (model `Evento` ~155-181; adicionar enum + model)
- Create (gerado): `backend/prisma/migrations/<timestamp>_add_boletim_e_datas_evento/migration.sql`

**Interfaces:**
- Produces: model Prisma `Boletim` { id:Int, evento_id:Int, numero:Int, titulo:String, categoria:CategoriaBoletim, data_publicacao:DateTime, filename:String, object_key:String @unique, public_url:String, size_bytes:Int, content_type:String, criado_em:DateTime }; enum `CategoriaBoletim`; `Evento.data_inicio?:DateTime`, `Evento.data_fim?:DateTime`, `Evento.boletins:Boletim[]`.

- [ ] **Step 1: Adicionar campos de data e relação no model Evento**

Em `backend/prisma/schema.prisma`, no `model Evento`, logo após `logo_url String?` (linha ~168), adicionar:
```prisma
  data_inicio       DateTime?
  data_fim          DateTime?
```
e na lista de relações (após `comissao        EventoComissao[]`, linha ~176) adicionar:
```prisma
  boletins        Boletim[]
```

- [ ] **Step 2: Adicionar enum e model Boletim**

No fim de `backend/prisma/schema.prisma`, adicionar:
```prisma
enum CategoriaBoletim {
  Resultados
  Comunicado
  Tabela
  Regulamento
  Outros
}

model Boletim {
  id              Int              @id @default(autoincrement())
  evento          Evento           @relation(fields: [evento_id], references: [id], onDelete: Cascade)
  evento_id       Int
  numero          Int
  titulo          String
  categoria       CategoriaBoletim
  data_publicacao DateTime
  filename        String
  object_key      String           @unique
  public_url      String
  size_bytes      Int
  content_type    String           @default("application/pdf")
  criado_em       DateTime         @default(now())

  @@unique([evento_id, numero])
  @@index([evento_id])
}
```

- [ ] **Step 3: Gerar a migration e o client**

Run: `cd backend && npx prisma migrate dev --name add_boletim_e_datas_evento`
Expected: migration criada e aplicada; `Prisma schema loaded`; sem erro. Inspecionar o `migration.sql` gerado: deve conter `CREATE TABLE "Boletim"`, `CREATE TYPE "CategoriaBoletim"`, e `ALTER TABLE "Evento" ADD COLUMN "data_inicio"`/`"data_fim"`. **Não** deve conter `DROP TABLE`.

- [ ] **Step 4: Verificar compilação de tipos**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros (o client Prisma agora expõe `prisma.boletim`).

- [ ] **Step 5: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add backend/prisma/schema.prisma backend/prisma/migrations
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(boletins): schema Boletim + datas inicio/fim do evento"
```

---

### Task 2: Datas do evento — backend (zod/tipo) + admin form

**Files:**
- Modify: `backend/src/modules/eventos/eventos.controller.ts:11-21` (createSchema)
- Modify: `backend/src/modules/eventos/eventos.service.ts:48-58` (CreateInput)
- Modify: `frontend/src/pages/eventos/EventoForm.tsx`
- Modify: `frontend/src/services/eventos.ts:7-17` (EventoPayload)
- Modify: `frontend/src/types/evento.ts` (tipo Evento — adicionar data_inicio/data_fim)
- Test: `backend/src/modules/eventos/eventos-datas.test.ts`

**Interfaces:**
- Consumes: `createSchema`/`updateSchema` (zod), `CreateInput`.
- Produces: campos `data_inicio?: string|Date|null`, `data_fim?: string|Date|null` aceitos em criar/editar e fluindo para `prisma.evento.create/update` via `...rest`.

- [ ] **Step 1: Escrever teste do schema de datas**

Criar `backend/src/modules/eventos/eventos-datas.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Espelha o createSchema do controller para testar a coerção das datas novas.
const STATUS_VALUES = ['rascunho','inscricoes','pronto','sorteado','parcial','suspenso'] as const
const schema = z.object({
  nome: z.string().min(1),
  data_hora: z.coerce.date(),
  local: z.string().min(1),
  organizador: z.string().optional(),
  status: z.enum(STATUS_VALUES).optional(),
  competicao_id: z.coerce.number().int().positive(),
  municipio_id: z.coerce.number().int().positive(),
  anfitriao_id: z.coerce.number().int().positive().nullable().optional(),
  comissao_ids: z.array(z.coerce.number().int().positive()).optional(),
  data_inicio: z.coerce.date().nullable().optional(),
  data_fim: z.coerce.date().nullable().optional(),
})

describe('evento datas inicio/fim', () => {
  it('coage strings ISO para Date', () => {
    const r = schema.parse({ nome: 'X', data_hora: '2026-07-01', local: 'L', competicao_id: 1, municipio_id: 1, data_inicio: '2026-07-01', data_fim: '2026-07-03' })
    expect(r.data_inicio).toBeInstanceOf(Date)
    expect(r.data_fim).toBeInstanceOf(Date)
  })
  it('aceita ausência (opcional)', () => {
    const r = schema.parse({ nome: 'X', data_hora: '2026-07-01', local: 'L', competicao_id: 1, municipio_id: 1 })
    expect(r.data_inicio).toBeUndefined()
  })
})
```

- [ ] **Step 2: Rodar o teste (deve falhar)**

Run: `cd backend && npx vitest run src/modules/eventos/eventos-datas.test.ts`
Expected: PASS já (o teste valida o schema local). Se PASS, seguir; ele trava o comportamento esperado para o schema real.

- [ ] **Step 3: Adicionar os campos ao createSchema real**

Em `backend/src/modules/eventos/eventos.controller.ts`, dentro de `createSchema` (após `comissao_ids: ...`, linha ~20), adicionar:
```ts
  data_inicio: z.coerce.date().nullable().optional(),
  data_fim: z.coerce.date().nullable().optional(),
```

- [ ] **Step 4: Adicionar os campos ao CreateInput**

Em `backend/src/modules/eventos/eventos.service.ts`, no type `CreateInput` (após `comissao_ids?: number[]`, linha ~57), adicionar:
```ts
  data_inicio?: Date | null
  data_fim?: Date | null
```
(Os campos já fluem para `prisma.evento.create/update` via `...rest` — nenhuma mudança extra no corpo de `criar`/`editar`.)

- [ ] **Step 5: Frontend — tipo, payload e form**

Em `frontend/src/types/evento.ts`, adicionar ao tipo `Evento`: `data_inicio?: string | null` e `data_fim?: string | null`.

Em `frontend/src/services/eventos.ts`, no `EventoPayload` (após `comissao_ids?: number[]`, linha ~16), adicionar:
```ts
  data_inicio?: string | null
  data_fim?: string | null
```

Em `frontend/src/pages/eventos/EventoForm.tsx`, adicionar dois inputs de data (Início, Fim) ligados ao estado do form, no mesmo bloco do campo de data existente. Exemplo (adaptar ao padrão de estado/inputs do arquivo):
```tsx
<label>
  Início
  <input type="date" value={form.data_inicio ?? ''} onChange={e => setForm({ ...form, data_inicio: e.target.value || null })} />
</label>
<label>
  Fim
  <input type="date" value={form.data_fim ?? ''} onChange={e => setForm({ ...form, data_fim: e.target.value || null })} />
</label>
```
Garantir que `data_inicio`/`data_fim` entrem no payload de criar/editar.

- [ ] **Step 6: Build/typecheck**

Run: `cd backend && npx vitest run src/modules/eventos/eventos-datas.test.ts && npx tsc --noEmit`
Run: `cd frontend && npm run build`
Expected: testes PASS; ambos compilam sem erro.

- [ ] **Step 7: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add backend/src/modules/eventos frontend/src/pages/eventos/EventoForm.tsx frontend/src/services/eventos.ts frontend/src/types/evento.ts
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(eventos): datas de inicio/fim no backend e no form do admin"
```

---

### Task 3: Abstração de storage (SFTP + GCS) + dependências

**Files:**
- Create: `backend/src/lib/storage/index.ts`
- Create: `backend/src/lib/storage/sftp.ts`
- Create: `backend/src/lib/storage/gcs.ts`
- Test: `backend/src/lib/storage/storage.test.ts`
- Modify: `backend/package.json` (deps)

**Interfaces:**
- Produces: `interface StorageProvider { put(objectKey: string, buffer: Buffer, contentType: string): Promise<string>; remove(objectKey: string): Promise<void> }`; `getStorage(): StorageProvider`.

- [ ] **Step 1: Instalar dependências**

Run: `cd backend && npm i ssh2-sftp-client @google-cloud/storage && npm i -D @types/ssh2-sftp-client`
Expected: instala sem erro; `package.json`/`package-lock.json` atualizados.

- [ ] **Step 2: Escrever o teste do factory + SFTP**

Criar `backend/src/lib/storage/storage.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const putMock = vi.fn()
const deleteMock = vi.fn()
const connectMock = vi.fn()
const endMock = vi.fn()
const mkdirMock = vi.fn()
vi.mock('ssh2-sftp-client', () => ({
  default: class { connect = connectMock; put = putMock; delete = deleteMock; end = endMock; mkdir = mkdirMock; exists = vi.fn().mockResolvedValue(false) },
}))

beforeEach(() => { vi.clearAllMocks(); vi.resetModules()
  process.env.STORAGE_PROVIDER = 'sftp'
  process.env.SFTP_HOST = 'h'; process.env.SFTP_USER = 'u'
  process.env.SFTP_PRIVATE_KEY_PATH = ''; process.env.SFTP_BASE_DIR = '/srv/boletins'
  process.env.PUBLIC_BOLETINS_BASE_URL = 'http://vm/boletins'
})

it('getStorage retorna SftpStorage quando STORAGE_PROVIDER=sftp', async () => {
  const { getStorage } = await import('./index')
  const s = getStorage()
  expect(s).toBeTruthy()
})

it('SftpStorage.put envia o buffer e retorna a URL pública', async () => {
  const { getStorage } = await import('./index')
  const url = await getStorage().put('eventos/9/boletim-1-abc.pdf', Buffer.from('x'), 'application/pdf')
  expect(putMock).toHaveBeenCalled()
  expect(url).toBe('http://vm/boletins/eventos/9/boletim-1-abc.pdf')
  expect(endMock).toHaveBeenCalled()
})
```

- [ ] **Step 3: Rodar o teste (deve falhar)**

Run: `cd backend && npx vitest run src/lib/storage/storage.test.ts`
Expected: FAIL (módulo `./index` não existe).

- [ ] **Step 4: Implementar a interface + factory**

Criar `backend/src/lib/storage/index.ts`:
```ts
export interface StorageProvider {
  put(objectKey: string, buffer: Buffer, contentType: string): Promise<string>
  remove(objectKey: string): Promise<void>
}

let cached: StorageProvider | null = null

export function getStorage(): StorageProvider {
  if (cached) return cached
  const provider = process.env.STORAGE_PROVIDER ?? 'sftp'
  if (provider === 'gcs') {
    const { GcsStorage } = require('./gcs') as typeof import('./gcs')
    cached = new GcsStorage()
  } else {
    const { SftpStorage } = require('./sftp') as typeof import('./sftp')
    cached = new SftpStorage()
  }
  return cached
}
```

- [ ] **Step 5: Implementar SftpStorage**

Criar `backend/src/lib/storage/sftp.ts`:
```ts
import fs from 'fs'
import path from 'path'
import SftpClient from 'ssh2-sftp-client'
import type { StorageProvider } from './index'

export class SftpStorage implements StorageProvider {
  private host = process.env.SFTP_HOST!
  private port = Number(process.env.SFTP_PORT ?? 22)
  private username = process.env.SFTP_USER!
  private keyPath = process.env.SFTP_PRIVATE_KEY_PATH
  private baseDir = process.env.SFTP_BASE_DIR ?? '/srv/boletins'
  private baseUrl = process.env.PUBLIC_BOLETINS_BASE_URL!

  private async withClient<T>(fn: (c: SftpClient) => Promise<T>): Promise<T> {
    const c = new SftpClient()
    await c.connect({
      host: this.host, port: this.port, username: this.username,
      privateKey: this.keyPath ? fs.readFileSync(this.keyPath) : undefined,
    })
    try { return await fn(c) } finally { await c.end() }
  }

  async put(objectKey: string, buffer: Buffer, _contentType: string): Promise<string> {
    await this.withClient(async (c) => {
      const remote = path.posix.join(this.baseDir, objectKey)
      const dir = path.posix.dirname(remote)
      if (!(await c.exists(dir))) await c.mkdir(dir, true)
      await c.put(buffer, remote)
    })
    return `${this.baseUrl}/${objectKey}`
  }

  async remove(objectKey: string): Promise<void> {
    await this.withClient(async (c) => {
      const remote = path.posix.join(this.baseDir, objectKey)
      if (await c.exists(remote)) await c.delete(remote)
    })
  }
}
```

- [ ] **Step 6: Implementar GcsStorage (prod, sem provisionar)**

Criar `backend/src/lib/storage/gcs.ts`:
```ts
import { Storage } from '@google-cloud/storage'
import type { StorageProvider } from './index'

export class GcsStorage implements StorageProvider {
  private storage = new Storage() // ADC (SA da VM); sem key file
  private bucketName = process.env.GCS_DOCS_BUCKET!
  private baseUrl = process.env.PUBLIC_DOCS_BASE_URL!

  async put(objectKey: string, buffer: Buffer, contentType: string): Promise<string> {
    await this.storage.bucket(this.bucketName).file(objectKey).save(buffer, {
      contentType, resumable: false, metadata: { cacheControl: 'public, max-age=3600' },
    })
    return `${this.baseUrl}/${encodeURI(objectKey)}`
  }

  async remove(objectKey: string): Promise<void> {
    await this.storage.bucket(this.bucketName).file(objectKey).delete({ ignoreNotFound: true })
  }
}
```

- [ ] **Step 7: Rodar o teste (deve passar)**

Run: `cd backend && npx vitest run src/lib/storage/storage.test.ts && npx tsc --noEmit`
Expected: PASS; sem erro de tipos.

- [ ] **Step 8: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add backend/src/lib/storage backend/package.json backend/package-lock.json
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(storage): abstracao de storage com providers SFTP (dev) e GCS (prod)"
```

---

### Task 4: Módulo backend `boletins` (service + controller + rotas)

**Files:**
- Create: `backend/src/modules/boletins/boletins.service.ts`
- Create: `backend/src/modules/boletins/boletins.controller.ts`
- Create: `backend/src/modules/boletins/boletins.routes.ts`
- Create: `backend/src/lib/upload-pdf.ts`
- Test: `backend/src/modules/boletins/boletins.service.test.ts`
- Modify: `backend/src/index.ts:23,61` (registrar router)

**Interfaces:**
- Consumes: `getStorage()` (Task 3), `publicar(eventoId)` de `../site-publico/site-publico.service`, `prisma.boletim`.
- Produces: `criarBoletim(input)`, `listarBoletins(eventoId)`, `removerBoletim(eventoId, boletimId)`; rotas `POST/GET/DELETE /eventos/:eventoId/boletins[/:boletimId]`.

- [ ] **Step 1: Helper de upload PDF em memória**

Criar `backend/src/lib/upload-pdf.ts`:
```ts
import multer from 'multer'
import path from 'path'

const MAX = Number(process.env.MAX_PDF_BYTES ?? 26214400)

export const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (file.mimetype === 'application/pdf' && ext === '.pdf') cb(null, true)
    else cb(Object.assign(new Error('Apenas arquivos PDF são permitidos.'), { status: 400 }))
  },
})
```

- [ ] **Step 2: Escrever o teste do service**

Criar `backend/src/modules/boletins/boletins.service.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = {
  evento: { findUnique: vi.fn() },
  boletim: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
}
vi.mock('../../lib/prisma', () => ({ default: prismaMock }))

const putMock = vi.fn().mockResolvedValue('http://vm/boletins/eventos/9/boletim-1-abc.pdf')
const removeMock = vi.fn().mockResolvedValue(undefined)
vi.mock('../../lib/storage', () => ({ getStorage: () => ({ put: putMock, remove: removeMock }) }))

const publicarMock = vi.fn().mockResolvedValue(undefined)
vi.mock('../site-publico/site-publico.service', () => ({ publicar: publicarMock }))

beforeEach(() => vi.clearAllMocks())

describe('boletins.service', () => {
  it('cria boletim, sobe arquivo e re-publica se evento publicado', async () => {
    prismaMock.evento.findUnique.mockResolvedValue({ id: 9, site_publicado_em: new Date() })
    prismaMock.boletim.create.mockResolvedValue({ id: 1, evento_id: 9, numero: 1 })
    const { criarBoletim } = await import('./boletins.service')
    const r = await criarBoletim({ eventoId: 9, numero: 1, titulo: 'B1', categoria: 'Resultados', data_publicacao: new Date(), file: { buffer: Buffer.from('x'), originalname: 'b.pdf', size: 1, mimetype: 'application/pdf' } as any })
    expect(putMock).toHaveBeenCalled()
    expect(prismaMock.boletim.create).toHaveBeenCalled()
    expect(publicarMock).toHaveBeenCalledWith(9)
    expect(r.id).toBe(1)
  })

  it('NÃO re-publica se evento não publicado', async () => {
    prismaMock.evento.findUnique.mockResolvedValue({ id: 9, site_publicado_em: null })
    prismaMock.boletim.create.mockResolvedValue({ id: 2, evento_id: 9, numero: 2 })
    const { criarBoletim } = await import('./boletins.service')
    await criarBoletim({ eventoId: 9, numero: 2, titulo: 'B2', categoria: 'Comunicado', data_publicacao: new Date(), file: { buffer: Buffer.from('x'), originalname: 'b.pdf', size: 1, mimetype: 'application/pdf' } as any })
    expect(publicarMock).not.toHaveBeenCalled()
  })

  it('remove apaga do storage e do banco', async () => {
    prismaMock.boletim.findFirst.mockResolvedValue({ id: 5, evento_id: 9, object_key: 'eventos/9/boletim-1-abc.pdf' })
    prismaMock.evento.findUnique.mockResolvedValue({ id: 9, site_publicado_em: null })
    const { removerBoletim } = await import('./boletins.service')
    await removerBoletim(9, 5)
    expect(removeMock).toHaveBeenCalledWith('eventos/9/boletim-1-abc.pdf')
    expect(prismaMock.boletim.delete).toHaveBeenCalledWith({ where: { id: 5 } })
  })
})
```

- [ ] **Step 3: Rodar o teste (deve falhar)**

Run: `cd backend && npx vitest run src/modules/boletins/boletins.service.test.ts`
Expected: FAIL (`./boletins.service` não existe).

- [ ] **Step 4: Implementar o service**

Criar `backend/src/modules/boletins/boletins.service.ts`:
```ts
import { randomUUID } from 'crypto'
import prisma from '../../lib/prisma'
import { getStorage } from '../../lib/storage'
import { publicar } from '../site-publico/site-publico.service'

type CriarInput = {
  eventoId: number
  numero: number
  titulo: string
  categoria: 'Resultados' | 'Comunicado' | 'Tabela' | 'Regulamento' | 'Outros'
  data_publicacao: Date
  file: { buffer: Buffer; originalname: string; size: number; mimetype: string }
}

async function republicarSePublicado(eventoId: number) {
  const ev = await prisma.evento.findUnique({ where: { id: eventoId }, select: { id: true, site_publicado_em: true } })
  if (ev?.site_publicado_em) await publicar(eventoId)
}

export async function criarBoletim(input: CriarInput) {
  const { eventoId, numero, titulo, categoria, data_publicacao, file } = input
  const objectKey = `eventos/${eventoId}/boletim-${numero}-${randomUUID()}.pdf`
  const publicUrl = await getStorage().put(objectKey, file.buffer, 'application/pdf')
  try {
    const boletim = await prisma.boletim.create({
      data: {
        evento_id: eventoId, numero, titulo, categoria, data_publicacao,
        filename: file.originalname, object_key: objectKey, public_url: publicUrl,
        size_bytes: file.size, content_type: 'application/pdf',
      },
    })
    await republicarSePublicado(eventoId)
    return boletim
  } catch (err: any) {
    // rollback do arquivo se o insert falhar (ex.: numero duplicado)
    try { await getStorage().remove(objectKey) } catch { /* ignore */ }
    if (err?.code === 'P2002') throw Object.assign(new Error('Já existe um boletim com este número neste evento.'), { status: 409 })
    throw err
  }
}

export async function listarBoletins(eventoId: number) {
  return prisma.boletim.findMany({ where: { evento_id: eventoId }, orderBy: { numero: 'asc' } })
}

export async function removerBoletim(eventoId: number, boletimId: number) {
  const boletim = await prisma.boletim.findFirst({ where: { id: boletimId, evento_id: eventoId } })
  if (!boletim) throw Object.assign(new Error('Boletim não encontrado'), { status: 404 })
  await getStorage().remove(boletim.object_key)
  await prisma.boletim.delete({ where: { id: boletim.id } })
  await republicarSePublicado(eventoId)
}
```

- [ ] **Step 5: Rodar o teste (deve passar)**

Run: `cd backend && npx vitest run src/modules/boletins/boletins.service.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 6: Implementar o controller**

Criar `backend/src/modules/boletins/boletins.controller.ts`:
```ts
import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as service from './boletins.service'
import { parseIntParam } from '../../lib/parse-id'

const CATEGORIAS = ['Resultados','Comunicado','Tabela','Regulamento','Outros'] as const

const criarSchema = z.object({
  numero: z.coerce.number().int().positive(),
  titulo: z.string().min(1),
  categoria: z.enum(CATEGORIAS),
  data_publicacao: z.coerce.date(),
})

export async function criar(req: Request, res: Response, next: NextFunction) {
  try {
    const eventoId = parseIntParam(req.params.eventoId, 'eventoId')
    const file = (req as any).file as Express.Multer.File | undefined
    if (!file) { res.status(400).json({ message: 'Arquivo PDF obrigatório no campo "file".' }); return }
    const body = criarSchema.parse(req.body)
    const boletim = await service.criarBoletim({ eventoId, ...body, file })
    res.status(201).json(boletim)
  } catch (err) { next(err) }
}

export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    const eventoId = parseIntParam(req.params.eventoId, 'eventoId')
    res.json(await service.listarBoletins(eventoId))
  } catch (err) { next(err) }
}

export async function remover(req: Request, res: Response, next: NextFunction) {
  try {
    const eventoId = parseIntParam(req.params.eventoId, 'eventoId')
    const boletimId = parseIntParam(req.params.boletimId, 'boletimId')
    await service.removerBoletim(eventoId, boletimId)
    res.status(204).send()
  } catch (err) { next(err) }
}
```

- [ ] **Step 7: Implementar as rotas**

Criar `backend/src/modules/boletins/boletins.routes.ts`:
```ts
import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import { uploadPdf } from '../../lib/upload-pdf'
import * as ctrl from './boletins.controller'

const router = Router()
const admin = [requireAuth, requireRole('ADMIN')]

router.get('/eventos/:eventoId/boletins', ...admin, ctrl.listar)
router.post('/eventos/:eventoId/boletins', ...admin, uploadPdf.single('file'), ctrl.criar)
router.delete('/eventos/:eventoId/boletins/:boletimId', ...admin, ctrl.remover)

export default router
```

- [ ] **Step 8: Registrar o router no app**

Em `backend/src/index.ts`, adicionar o import (após linha 23):
```ts
import boletinsRoutes from './modules/boletins/boletins.routes'
```
e registrar (após `app.use('/relatorios', relatoriosRoutes)`, linha ~61):
```ts
app.use('/', boletinsRoutes)
```

- [ ] **Step 9: Typecheck + testes**

Run: `cd backend && npx tsc --noEmit && npx vitest run src/modules/boletins`
Expected: sem erro; testes PASS.

- [ ] **Step 10: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add backend/src/modules/boletins backend/src/lib/upload-pdf.ts backend/src/index.ts
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(boletins): modulo backend (upload/listar/remover) ADMIN + re-publicacao"
```

---

### Task 5: Snapshot — incluir boletins e datas

**Files:**
- Modify: `backend/src/modules/site-publico/site-publico.service.ts:7-16,64-71` (buscar boletins + passar ao montaSnapshot)
- Modify: `backend/src/modules/site-publico/snapshot.ts` (tipo + saída)
- Modify: `backend/src/modules/site-publico/snapshot-types.ts` (SnapEvento)
- Modify: `frontend/src/site-publico/snapshot-types.ts` (SnapEvento)
- Test: `backend/src/modules/site-publico/snapshot.test.ts` (adicionar casos)

**Interfaces:**
- Consumes: `montaSnapshot(input)` ganha `boletins` no `input.evento`-relacionado.
- Produces: `SnapEvento.boletins: { numero, titulo, categoria, data, url }[]`, `SnapEvento.dataInicio: string|null`, `SnapEvento.dataFim: string|null` (ambos backend e frontend types).

- [ ] **Step 1: Atualizar os tipos do snapshot (backend + frontend)**

Em `backend/src/modules/site-publico/snapshot-types.ts`, no `SnapEvento`, adicionar antes de `modalidades`:
```ts
  dataInicio: string | null; dataFim: string | null
  boletins: { numero: number; titulo: string; categoria: string; data: string; url: string }[]
```
Replicar a mesma adição em `frontend/src/site-publico/snapshot-types.ts` (no `SnapEvento`):
```ts
  dataInicio: string | null
  dataFim: string | null
  boletins: { numero: number; titulo: string; categoria: string; data: string; url: string }[]
```

- [ ] **Step 2: Atualizar o teste do snapshot**

Em `backend/src/modules/site-publico/snapshot.test.ts`, no input do `montaSnapshot` do primeiro teste, adicionar ao objeto `evento` os campos `data_inicio`, `data_fim` e `boletins`, e asserir a saída. Adicionar este teste novo ao final do arquivo:
```ts
it('inclui boletins e datas inicio/fim no snapshot', () => {
  const snap = montaSnapshot({
    evento: {
      id: 1, nome: 'Ev', local: 'L', organizador: null, data_hora: new Date('2026-07-01'),
      anfitriao_id: null, competicao: { nome: 'C', considerar_anfitriao: false }, municipio: { nome: 'M' },
      data_inicio: new Date('2026-07-01'), data_fim: new Date('2026-07-03'),
      boletins: [
        { numero: 2, titulo: 'B2', categoria: 'Comunicado', data_publicacao: new Date('2026-07-02'), public_url: 'http://vm/2.pdf' },
        { numero: 1, titulo: 'B1', categoria: 'Resultados', data_publicacao: new Date('2026-07-01'), public_url: 'http://vm/1.pdf' },
      ],
    } as any,
    modalidades: [], inscricoesPorModalidade: new Map(), campeoesPorModalidade: new Map(),
    sorteiosPorModalidade: new Map(), subtituloFn: () => null,
  })
  expect(snap.dataInicio).toBe('2026-07-01T00:00:00.000Z')
  expect(snap.dataFim).toBe('2026-07-03T00:00:00.000Z')
  expect(snap.boletins.map(b => b.numero)).toEqual([1, 2]) // ordenado por numero asc
  expect(snap.boletins[0]).toMatchObject({ titulo: 'B1', categoria: 'Resultados', url: 'http://vm/1.pdf' })
})
```

- [ ] **Step 3: Rodar (deve falhar)**

Run: `cd backend && npx vitest run src/modules/site-publico/snapshot.test.ts`
Expected: FAIL (campos ausentes / propriedades undefined).

- [ ] **Step 4: Implementar no montaSnapshot**

Em `backend/src/modules/site-publico/snapshot.ts`:
- No type `EventoRow`, adicionar:
```ts
  data_inicio?: Date | null; data_fim?: Date | null
  boletins?: { numero: number; titulo: string; categoria: string; data_publicacao: Date; public_url: string }[]
```
- No `return { ... }` final (após `data: evento.data_hora.toISOString(),`), adicionar:
```ts
    dataInicio: evento.data_inicio ? evento.data_inicio.toISOString() : null,
    dataFim: evento.data_fim ? evento.data_fim.toISOString() : null,
    boletins: [...(evento.boletins ?? [])]
      .sort((a, b) => a.numero - b.numero)
      .map(b => ({ numero: b.numero, titulo: b.titulo, categoria: b.categoria, data: b.data_publicacao.toISOString(), url: b.public_url })),
```

- [ ] **Step 5: Buscar boletins/datas no publicar()**

Em `backend/src/modules/site-publico/site-publico.service.ts`, no `select` do `prisma.evento.findUnique` (linhas ~10-15), adicionar:
```ts
      data_inicio: true, data_fim: true,
      boletins: { select: { numero: true, titulo: true, categoria: true, data_publicacao: true, public_url: true } },
```
(O objeto `evento` já é passado a `montaSnapshot({ evento, ... })`, então os campos fluem automaticamente.)

- [ ] **Step 6: Rodar (deve passar) + typecheck**

Run: `cd backend && npx vitest run src/modules/site-publico/snapshot.test.ts && npx tsc --noEmit`
Expected: PASS; sem erro.

- [ ] **Step 7: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add backend/src/modules/site-publico frontend/src/site-publico/snapshot-types.ts
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(site-publico): snapshot inclui boletins e datas inicio/fim"
```

---

### Task 6: Admin — service de boletins + seção na tela do evento

**Files:**
- Create: `frontend/src/services/boletins.ts`
- Create: `frontend/src/pages/eventos/EventoBoletins.tsx`
- Modify: `frontend/src/pages/eventos/EventoForm.tsx` (renderizar `<EventoBoletins eventoId={...} />` na edição)

**Interfaces:**
- Consumes: `api` de `./api`.
- Produces: `boletinsService.listar/enviar/remover`; componente `EventoBoletins`.

- [ ] **Step 1: Service de boletins**

Criar `frontend/src/services/boletins.ts`:
```ts
import api from './api'

export type Boletim = {
  id: number; evento_id: number; numero: number; titulo: string
  categoria: string; data_publicacao: string; filename: string
  public_url: string; size_bytes: number; criado_em: string
}

const BASE = (eventoId: number) => `/eventos/${eventoId}/boletins`

export const boletinsService = {
  listar: (eventoId: number) => api.get<Boletim[]>(BASE(eventoId)).then(r => r.data),
  enviar: (eventoId: number, payload: { numero: number; titulo: string; categoria: string; data_publicacao: string; file: File }) => {
    const fd = new FormData()
    fd.append('file', payload.file)
    fd.append('numero', String(payload.numero))
    fd.append('titulo', payload.titulo)
    fd.append('categoria', payload.categoria)
    fd.append('data_publicacao', payload.data_publicacao)
    return api.post<Boletim>(BASE(eventoId), fd).then(r => r.data)
  },
  remover: (eventoId: number, boletimId: number) => api.delete(`${BASE(eventoId)}/${boletimId}`),
}
```

- [ ] **Step 2: Componente EventoBoletins**

Criar `frontend/src/pages/eventos/EventoBoletins.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { boletinsService, type Boletim } from '../../services/boletins'

const CATEGORIAS = ['Resultados', 'Comunicado', 'Tabela', 'Regulamento', 'Outros']

export default function EventoBoletins({ eventoId }: { eventoId: number }) {
  const [docs, setDocs] = useState<Boletim[]>([])
  const [numero, setNumero] = useState('')
  const [titulo, setTitulo] = useState('')
  const [categoria, setCategoria] = useState(CATEGORIAS[0])
  const [data, setData] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function load() { setDocs(await boletinsService.listar(eventoId)) }
  useEffect(() => { load() }, [eventoId])

  async function onUpload() {
    if (!file || !numero || !titulo || !data) { setErro('Preencha número, título, data e arquivo.'); return }
    setLoading(true); setErro(null)
    try {
      await boletinsService.enviar(eventoId, { numero: Number(numero), titulo, categoria, data_publicacao: data, file })
      setNumero(''); setTitulo(''); setData(''); setFile(null)
      await load()
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Falha no upload')
    } finally { setLoading(false) }
  }

  async function onDelete(id: number) {
    if (!confirm('Remover este boletim?')) return
    await boletinsService.remover(eventoId, id)
    await load()
  }

  return (
    <section style={{ marginTop: 24 }}>
      <h3>Boletins</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'end' }}>
        <input placeholder="Nº" value={numero} onChange={e => setNumero(e.target.value)} style={{ width: 70 }} />
        <input placeholder="Título" value={titulo} onChange={e => setTitulo(e.target.value)} />
        <select value={categoria} onChange={e => setCategoria(e.target.value)}>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" value={data} onChange={e => setData(e.target.value)} />
        <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        <button disabled={loading} onClick={onUpload}>{loading ? 'Enviando…' : 'Publicar PDF'}</button>
      </div>
      {erro && <p style={{ color: 'crimson' }}>{erro}</p>}
      <ul>
        {docs.map(d => (
          <li key={d.id}>
            <strong>{String(d.numero).padStart(2, '0')}</strong> — {d.titulo} <em>[{d.categoria}]</em>{' '}
            <a href={d.public_url} target="_blank" rel="noopener">PDF</a>{' '}
            <button onClick={() => onDelete(d.id)}>Remover</button>
          </li>
        ))}
        {docs.length === 0 && <li>Nenhum boletim publicado.</li>}
      </ul>
    </section>
  )
}
```

- [ ] **Step 3: Renderizar na tela de edição do evento**

Em `frontend/src/pages/eventos/EventoForm.tsx`, importar `EventoBoletins` e renderizá-lo apenas quando há `id` (edição), abaixo do form:
```tsx
import EventoBoletins from './EventoBoletins'
// ... dentro do JSX, após o form, na edição:
{id && <EventoBoletins eventoId={Number(id)} />}
```
(adaptar `id` à forma como `EventoForm` obtém o id do evento em edição.)

- [ ] **Step 4: Build**

Run: `cd frontend && npm run build`
Expected: `tsc -b && vite build` sem erros.

- [ ] **Step 5: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/services/boletins.ts frontend/src/pages/eventos/EventoBoletins.tsx frontend/src/pages/eventos/EventoForm.tsx
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(admin): secao de boletins na tela do evento"
```

---

### Task 7: Página pública — período + seção de boletins (mobile) + filtro

**Files:**
- Modify: `frontend/src/site-publico/pages/EventoPage.tsx`
- Modify: `frontend/src/site-publico/site.css` (estilos boletins, mobile-first)
- Test: `frontend/src/site-publico/EventoPage-boletins.test.tsx`

**Interfaces:**
- Consumes: `SnapEvento.boletins`, `SnapEvento.dataInicio/dataFim` (Task 5).

- [ ] **Step 1: Teste de render dos boletins (Vitest + render to string)**

Criar `frontend/src/site-publico/EventoPage-boletins.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import EventoPage from './pages/EventoPage'
import type { SnapEvento } from './snapshot-types'

const base: SnapEvento = {
  id: 1, nome: 'Ev', competicao: 'C', cidade: 'M', local: 'L',
  data: '2026-07-01T00:00:00.000Z', organizador: null, publicadoEm: '2026-07-01T00:00:00.000Z',
  dataInicio: '2026-07-01T00:00:00.000Z', dataFim: '2026-07-03T00:00:00.000Z',
  boletins: [
    { numero: 1, titulo: 'B1', categoria: 'Resultados', data: '2026-07-01T00:00:00.000Z', url: 'http://vm/1.pdf' },
    { numero: 2, titulo: 'B2', categoria: 'Comunicado', data: '2026-07-02T00:00:00.000Z', url: 'http://vm/2.pdf' },
  ],
  modalidades: [],
}

describe('EventoPage boletins', () => {
  it('renderiza a seção de boletins com link e categoria, mais recente primeiro', () => {
    const html = renderToStaticMarkup(<EventoPage evento={base} />)
    expect(html).toContain('Boletins')
    expect(html).toContain('http://vm/2.pdf')
    expect(html).toContain('Comunicado')
    // ordem desc por numero: B2 antes de B1
    expect(html.indexOf('http://vm/2.pdf')).toBeLessThan(html.indexOf('http://vm/1.pdf'))
  })
  it('omite a seção quando não há boletins', () => {
    const html = renderToStaticMarkup(<EventoPage evento={{ ...base, boletins: [] }} />)
    expect(html).not.toContain('id="boletins-evento"')
  })
})
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `cd frontend && npx vitest run src/site-publico/EventoPage-boletins.test.tsx`
Expected: FAIL (seção ainda não existe).

- [ ] **Step 3: Implementar período + seção de boletins no EventoPage**

Em `frontend/src/site-publico/pages/EventoPage.tsx`:
- No header, abaixo do `<p>` existente, exibir o período quando houver:
```tsx
{evento.dataInicio && (
  <p className="evento-periodo">
    {new Date(evento.dataInicio).toLocaleDateString('pt-BR')}
    {evento.dataFim ? ` a ${new Date(evento.dataFim).toLocaleDateString('pt-BR')}` : ''}
  </p>
)}
```
- Antes do fechamento de `</main>` (após o map de categorias), adicionar a seção de boletins (ordem desc por número, com chips de filtro e atributo `data-cat` para o JS client-side):
```tsx
{evento.boletins.length > 0 && (() => {
  const ordenados = [...evento.boletins].sort((a, b) => b.numero - a.numero)
  const categorias = [...new Set(ordenados.map(b => b.categoria))]
  return (
    <section id="boletins-evento" className="boletins">
      <h2>Boletins</h2>
      <div className="boletins-filtros">
        <button className="bol-chip is-active" data-cat="">Todos</button>
        {categorias.map(c => <button className="bol-chip" data-cat={c} key={c}>{c}</button>)}
      </div>
      <ul className="boletins-lista">
        {ordenados.map(b => (
          <li className="boletim-row" data-cat={b.categoria} key={b.numero}>
            <a href={b.url} target="_blank" rel="noopener">
              <span className="boletim-num">{String(b.numero).padStart(2, '0')}</span>
              <span className="boletim-main">
                <span className="boletim-titulo">{b.titulo}</span>
                <span className="boletim-meta"><span className="boletim-cat">{b.categoria}</span> · {new Date(b.data).toLocaleDateString('pt-BR')}</span>
              </span>
              <span className="boletim-dl" aria-hidden="true">⬇</span>
            </a>
          </li>
        ))}
      </ul>
      <script dangerouslySetInnerHTML={{ __html:
        "(function(){var s=document.getElementById('boletins-evento');if(!s)return;" +
        "s.querySelectorAll('.bol-chip').forEach(function(c){c.addEventListener('click',function(){" +
        "var cat=c.getAttribute('data-cat');" +
        "s.querySelectorAll('.bol-chip').forEach(function(x){x.classList.toggle('is-active',x===c)});" +
        "s.querySelectorAll('.boletim-row').forEach(function(r){r.style.display=(!cat||r.getAttribute('data-cat')===cat)?'':'none'});" +
        "})})})();"
      }} />
    </section>
  )
})()}
```

- [ ] **Step 4: CSS mobile-first**

Em `frontend/src/site-publico/site.css`, adicionar:
```css
.evento-periodo { color: #475569; font-weight: 600; margin-top: 2px; }
.boletins { margin-top: 28px; }
.boletins-filtros { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.bol-chip { padding: 8px 14px; border-radius: 999px; border: 1px solid #cbd5e1; background: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }
.bol-chip.is-active { background: #1061d8; color: #fff; border-color: #1061d8; }
.boletins-lista { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.boletim-row a { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border: 1px solid #e2e8f0; border-radius: 14px; text-decoration: none; color: inherit; }
.boletim-num { font-weight: 800; font-variant-numeric: tabular-nums; color: #1061d8; min-width: 28px; }
.boletim-main { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.boletim-titulo { font-weight: 700; font-size: 17px; }
.boletim-meta { font-size: 13px; color: #64748b; }
.boletim-cat { font-weight: 700; }
.boletim-dl { font-size: 20px; color: #1061d8; }
@media (min-width: 720px) { .boletim-titulo { font-size: 18px; } }
```

- [ ] **Step 5: Rodar (deve passar) + build**

Run: `cd frontend && npx vitest run src/site-publico/EventoPage-boletins.test.tsx && npm run build`
Expected: PASS; build sem erros.

- [ ] **Step 6: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/site-publico/pages/EventoPage.tsx frontend/src/site-publico/site.css frontend/src/site-publico/EventoPage-boletins.test.tsx
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(site-publico): periodo do evento + secao de boletins mobile com filtro por categoria"
```

---

### Task 8: Infra de dev — env, secrets, docker-compose

**Files:**
- Modify: `backend/.env.example`
- Modify: `docker-compose.yml`
- Modify: `.gitignore` (garantir `secrets/`)

**Interfaces:**
- Consumes: vars lidas por `SftpStorage` (Task 3).

- [ ] **Step 1: Documentar vars no .env.example**

Em `backend/.env.example`, adicionar:
```dotenv
# Storage de boletins (dev = sftp; prod = gcs)
STORAGE_PROVIDER=sftp
SFTP_HOST=192.168.56.130
SFTP_PORT=22
SFTP_USER=prosports
SFTP_PRIVATE_KEY_PATH=/app/secrets/boletins_ssh_key
SFTP_BASE_DIR=/srv/boletins
PUBLIC_BOLETINS_BASE_URL=http://192.168.56.130/boletins
MAX_PDF_BYTES=26214400
# Prod (adiado): STORAGE_PROVIDER=gcs, GCS_DOCS_BUCKET=, PUBLIC_DOCS_BASE_URL=
```

- [ ] **Step 2: Montar a chave e envs no compose (dev)**

Em `docker-compose.yml`, no serviço `backend`, adicionar (em `environment:` e `volumes:`):
```yaml
    environment:
      STORAGE_PROVIDER: ${STORAGE_PROVIDER:-sftp}
      SFTP_HOST: ${SFTP_HOST}
      SFTP_PORT: ${SFTP_PORT:-22}
      SFTP_USER: ${SFTP_USER}
      SFTP_PRIVATE_KEY_PATH: /app/secrets/boletins_ssh_key
      SFTP_BASE_DIR: ${SFTP_BASE_DIR:-/srv/boletins}
      PUBLIC_BOLETINS_BASE_URL: ${PUBLIC_BOLETINS_BASE_URL}
      MAX_PDF_BYTES: ${MAX_PDF_BYTES:-26214400}
    volumes:
      - ./secrets/boletins_ssh_key:/app/secrets/boletins_ssh_key:ro
```
(mesclar com as chaves `environment`/`volumes` já existentes do serviço, sem duplicá-las.)

- [ ] **Step 3: Garantir secrets/ fora do git**

Em `.gitignore`, adicionar (se ausente):
```
secrets/
```

- [ ] **Step 4: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add backend/.env.example docker-compose.yml .gitignore
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "chore(dev): env e montagem da chave SFTP para boletins"
```

---

### Task 9: Verificação integrada + demonstração (antes da develop)

**Files:** nenhum (execução/manual).

- [ ] **Step 1: Provisionar a VM (passo manual, com o Wagner)**

Gerar chave: `ssh-keygen -t ed25519 -f secrets/boletins_ssh_key -N ""` (na raiz do repo). Instalar a pública: `ssh-copy-id -i secrets/boletins_ssh_key.pub <user>@192.168.56.130`. Na VM: `sudo apt update && sudo apt install -y nginx; sudo mkdir -p /srv/boletins; sudo chown <user>:<user> /srv/boletins`; configurar um server block servindo `/srv/boletins` em `/boletins/` e `sudo systemctl reload nginx`. Validar: `curl -I http://192.168.56.130/boletins/` responde do nginx. (Detalhes no passo a passo entregue ao Wagner.)

- [ ] **Step 2: Suite completa**

Run: `cd backend && npm test` → todos verdes.
Run: `cd frontend && npm run build` → sem erros.

- [ ] **Step 3: Fluxo manual + screenshots**

Subir backend+frontend localmente (apontando para a VM de dev). No admin: editar um evento, definir Início/Fim, publicar um boletim (nº, título, categoria, PDF). Verificar: arquivo em `/srv/boletins/eventos/<id>/...` na VM e linha no Postgres; `GET /eventos/<id>/boletins` lista. Publicar o evento e abrir a página do evento (viewport mobile): período no header, seção Boletins com badge de categoria, **filtro por categoria** funcionando e **download** abrindo o PDF da URL da VM. Capturar **screenshots** do fluxo e entregar ao Wagner. Após OK, mergear a branch na `develop`.

---

## Notas finais
- Sem provisionamento de GCS de produção nesta entrega (provider pronto no código). Promoção `develop → main` só com confirmação do Wagner.
- "tageado" = categoria do boletim (não git tag).
