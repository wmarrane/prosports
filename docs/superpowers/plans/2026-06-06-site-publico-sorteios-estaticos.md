# Site público estático + gerador de páginas de sorteio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar (manualmente, por evento) páginas HTML estáticas de sorteios + um site institucional no Firebase Hosting free tier, sem o público tocar o banco de dados.

**Architecture:** Ao "Publicar evento", o backend congela um snapshot JSON imutável (commitado no repo via GitHub API) e dispara um `repository_dispatch`. Um workflow roda um SSG (dentro de `frontend/`, reusando os componentes React de sorteio + Tailwind/tokens) que lê os snapshots e renderiza HTML estático, publicado num segundo site Firebase (www.eventosmontana.com.br).

**Tech Stack:** Node 24 / Express / Prisma (backend), React 18 + Vite + Tailwind (frontend/SSG via `renderToStaticMarkup`), Vitest, GitHub Actions, Firebase Hosting.

**Spec:** `docs/superpowers/specs/2026-06-06-site-publico-sorteios-estaticos-design.md`

---

## Nota de localização do SSG (decisão de implementação)

O SSG vive **dentro de `frontend/`** (não em um pacote `public-site/` separado), para reusar `tailwind.config`, `postcss`, tokens e os componentes `sorteio-result/` via imports relativos normais. Saída em `frontend/dist-site/`. Snapshots ficam em `frontend/public-site-snapshots/` (lidos no build). O segundo target Firebase aponta para `frontend/dist-site`.

## Contrato do snapshot (component-ready)

Diferente do contrato name/club do handoff: como reusamos os componentes React (que são **id-based**), o snapshot guarda IDs + dados mínimos prontos pros componentes.

```ts
// frontend/src/site-publico/snapshot-types.ts
export type SnapParticipante = { id: number; nome: string; subtitulo: string | null }
export type SnapCampeao = { participanteId: number; posicao: number }

export type SnapModalidade = {
  id: number
  nome: string
  grupo: string | null          // categoria; null => derivar no render
  tipo: 'grupos' | 'chaves' | 'ordem_entrada' | 'especifico'
  status: 'sorteado' | 'aguardando'
  seed: string | null
  anfitriaoId: number | null
  participantes: SnapParticipante[]
  campeoes: SnapCampeao[]
  cabecasPids: number[]         // seeds vindas das regras (precomputado no backend)
  resultado: unknown | null     // JSON cru do engine (slots/matchesGraph | grupos | ordem)
}

export type SnapEvento = {
  id: number
  nome: string
  competicao: string
  esporte: string
  cidade: string
  local: string
  data: string                  // ISO
  organizador: string | null
  publicadoEm: string           // ISO
  modalidades: SnapModalidade[]
}
```

---

# FASE 1 — Backend: snapshot + publicar/despublicar + trigger

### Task 1: Migração Prisma — `site_publicado_em` em Evento

**Files:**
- Modify: `backend/prisma/schema.prisma` (model `Evento`)
- Create: `backend/prisma/migrations/<timestamp>_evento_site_publicado/migration.sql` (gerado)

- [ ] **Step 1: Editar o schema**

No model `Evento` (após `logo_url String?`), adicionar:

```prisma
  site_publicado_em DateTime?
```

- [ ] **Step 2: Gerar a migração (sem aplicar em prod)**

Run: `cd backend && npx prisma migrate dev --name evento_site_publicado --create-only`
Expected: cria a pasta de migração com o `ALTER TABLE "Evento" ADD COLUMN "site_publicado_em" TIMESTAMP(3);`

- [ ] **Step 3: Inspecionar o migration.sql gerado**

Run: `cd backend && type prisma\migrations\*evento_site_publicado*\migration.sql` (PowerShell: `Get-Content`)
Expected: contém apenas o `ADD COLUMN`. **Confirmar que NÃO há `DROP TABLE`/`DROP COLUMN`** (drift). Se houver, parar e investigar.

- [ ] **Step 4: Aplicar no dev**

Run: `cd backend && npx prisma migrate dev`
Expected: "Database is now in sync" + client regenerado.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(site-publico): coluna site_publicado_em no Evento"
```

---

### Task 2: Snapshot builder (função pura, testável)

**Files:**
- Create: `backend/src/modules/site-publico/snapshot.ts`
- Create: `backend/src/modules/site-publico/snapshot.test.ts`

A regra de cabeças reusa a lógica do `applyAnfitriaoRule` já existente em `backend/src/modules/sorteios/sorteios.service.ts` (exportada). Confirmar que está exportada (está: `export function applyAnfitriaoRule`).

- [ ] **Step 1: Escrever o teste falho**

```ts
// backend/src/modules/site-publico/snapshot.test.ts
import { describe, it, expect } from 'vitest'
import { montaSnapshot } from './snapshot'

const baseEvento = {
  id: 10, nome: 'Jogos 2026',
  competicao: { nome: 'Jogos Regionais', considerar_anfitriao: false },
  municipio: { nome: 'São Manuel' },
  local: 'Ginásio', organizador: 'Montana', data_hora: new Date('2026-05-10T12:00:00Z'),
  anfitriao_id: null,
}

const modalidadeGrupos = {
  id: 1, nome: 'Futsal Masculino', sigla: 'FUT',
  tipo_modalidade: { tipo: 'grupos' as const },
}

it('monta snapshot de modalidade com grupos sorteada', () => {
  const snap = montaSnapshot({
    evento: baseEvento as any,
    modalidades: [modalidadeGrupos as any],
    inscricoesPorModalidade: new Map([[1, [
      { participante: { id: 100, nome: 'Tigres', subtitulo: 'Interior' } },
      { participante: { id: 101, nome: 'Lobos', subtitulo: 'Capital' } },
    ]]]) as any,
    campeoesPorModalidade: new Map([[1, [
      { participante_id: 100, posicao: 1 },
    ]]]) as any,
    sorteiosPorModalidade: new Map([[1, {
      tipo: 'grupos', seed: 'ABCD-1234',
      resultado: { regra_id: 5, classificados_por_grupo: 2, grupos: [{ letra: 'A', participantes: [100, 101] }] },
    }]]) as any,
    subtituloFn: (p: any) => p.subtitulo ?? null,
  })

  expect(snap.id).toBe(10)
  expect(snap.cidade).toBe('São Manuel')
  expect(snap.competicao).toBe('Jogos Regionais')
  const m = snap.modalidades[0]
  expect(m.tipo).toBe('grupos')
  expect(m.status).toBe('sorteado')
  expect(m.seed).toBe('ABCD-1234')
  expect(m.participantes).toEqual([
    { id: 100, nome: 'Tigres', subtitulo: 'Interior' },
    { id: 101, nome: 'Lobos', subtitulo: 'Capital' },
  ])
  expect(m.campeoes).toEqual([{ participanteId: 100, posicao: 1 }])
  expect(m.cabecasPids).toEqual([100]) // 1 grupo => 1 cabeça (campeão inscrito)
  expect((m.resultado as any).grupos[0].letra).toBe('A')
})

it('marca modalidade sem sorteio como aguardando', () => {
  const snap = montaSnapshot({
    evento: baseEvento as any,
    modalidades: [{ id: 2, nome: 'Vôlei', sigla: 'VOL', tipo_modalidade: { tipo: 'chaves' } } as any],
    inscricoesPorModalidade: new Map([[2, []]]) as any,
    campeoesPorModalidade: new Map() as any,
    sorteiosPorModalidade: new Map() as any,
    subtituloFn: () => null,
  })
  const m = snap.modalidades[0]
  expect(m.status).toBe('aguardando')
  expect(m.seed).toBeNull()
  expect(m.resultado).toBeNull()
  expect(m.cabecasPids).toEqual([])
})
```

- [ ] **Step 2: Rodar o teste (deve falhar)**

Run: `cd backend && npx vitest run src/modules/site-publico/snapshot.test.ts`
Expected: FAIL — "Cannot find module './snapshot'".

- [ ] **Step 3: Implementar**

```ts
// backend/src/modules/site-publico/snapshot.ts
import { applyAnfitriaoRule } from '../sorteios/sorteios.service'
import type {
  SnapEvento, SnapModalidade, SnapParticipante, SnapCampeao,
} from './snapshot-types'

type EventoRow = {
  id: number; nome: string; local: string; organizador: string | null
  data_hora: Date; anfitriao_id: number | null
  competicao: { nome: string; considerar_anfitriao: boolean }
  municipio: { nome: string }
}
type ModalidadeRow = { id: number; nome: string; tipo_modalidade: { tipo: string } }
type InscricaoRow = { participante: { id: number; nome: string; subtitulo: string | null } }
type CampeaoRow = { participante_id: number; posicao: number }
type SorteioRow = { tipo: string; seed: string; resultado: unknown }

export type MontaSnapshotInput = {
  evento: EventoRow
  modalidades: ModalidadeRow[]
  inscricoesPorModalidade: Map<number, InscricaoRow[]>
  campeoesPorModalidade: Map<number, CampeaoRow[]>
  sorteiosPorModalidade: Map<number, SorteioRow>
  subtituloFn: (p: { id: number; nome: string; subtitulo: string | null }) => string | null
}

function calcCabecas(
  tipo: string,
  resultado: any,
  campeoesPidsInscritos: number[],
  anfitriaoPid: number | null,
  anfitriaoInscrito: boolean,
  consideraAnfitriao: boolean,
): number[] {
  if (tipo === 'grupos') {
    const qtd = (resultado?.grupos ?? []).length
    if (qtd === 0) return []
    const finais = applyAnfitriaoRule({
      campeoesPidsInscritos, anfitriaoPid, anfitriaoInscrito, consideraAnfitriao,
      tipo: 'grupos', quantidadeGrupos: qtd,
    })
    return finais.slice(0, qtd)
  }
  if (tipo === 'chaves') {
    const finais = applyAnfitriaoRule({
      campeoesPidsInscritos, anfitriaoPid, anfitriaoInscrito, consideraAnfitriao, tipo: 'chaves',
    })
    return finais.slice(0, 4)
  }
  return []
}

export function montaSnapshot(input: MontaSnapshotInput): SnapEvento {
  const { evento, modalidades, inscricoesPorModalidade, campeoesPorModalidade, sorteiosPorModalidade, subtituloFn } = input

  const modalidadesSnap: SnapModalidade[] = modalidades.map((mod) => {
    const inscricoes = inscricoesPorModalidade.get(mod.id) ?? []
    const campeoes = campeoesPorModalidade.get(mod.id) ?? []
    const sorteio = sorteiosPorModalidade.get(mod.id) ?? null

    const participantes: SnapParticipante[] = inscricoes.map((i) => ({
      id: i.participante.id,
      nome: i.participante.nome,
      subtitulo: subtituloFn(i.participante),
    }))
    const campeoesSnap: SnapCampeao[] = [...campeoes]
      .sort((a, b) => a.posicao - b.posicao)
      .map((c) => ({ participanteId: c.participante_id, posicao: c.posicao }))

    const inscritosSet = new Set(participantes.map((p) => p.id))
    const anfitriaoPid = evento.anfitriao_id
    const anfitriaoInscrito = anfitriaoPid !== null && inscritosSet.has(anfitriaoPid)
    const consideraAnfitriao = evento.competicao.considerar_anfitriao
    const campeoesInscritosPids = campeoesSnap
      .map((c) => c.participanteId)
      .filter((pid) => inscritosSet.has(pid))

    const tipo = mod.tipo_modalidade.tipo as SnapModalidade['tipo']
    const cabecasPids = sorteio
      ? calcCabecas(tipo, sorteio.resultado as any, campeoesInscritosPids, anfitriaoPid, anfitriaoInscrito, consideraAnfitriao)
      : []

    return {
      id: mod.id,
      nome: mod.nome,
      grupo: null,
      tipo,
      status: sorteio ? 'sorteado' : 'aguardando',
      seed: sorteio?.seed ?? null,
      anfitriaoId: anfitriaoPid,
      participantes,
      campeoes: campeoesSnap,
      cabecasPids,
      resultado: sorteio?.resultado ?? null,
    }
  })

  return {
    id: evento.id,
    nome: evento.nome,
    competicao: evento.competicao.nome,
    esporte: evento.competicao.nome,
    cidade: evento.municipio.nome,
    local: evento.local,
    data: evento.data_hora.toISOString(),
    organizador: evento.organizador,
    publicadoEm: new Date().toISOString(),
    modalidades: modalidadesSnap,
  }
}
```

Também criar o arquivo de tipos compartilhado (o SSG no frontend terá uma cópia própria — ver Task 7; aqui o backend tem a sua):

```ts
// backend/src/modules/site-publico/snapshot-types.ts
export type SnapParticipante = { id: number; nome: string; subtitulo: string | null }
export type SnapCampeao = { participanteId: number; posicao: number }
export type SnapModalidade = {
  id: number; nome: string; grupo: string | null
  tipo: 'grupos' | 'chaves' | 'ordem_entrada' | 'especifico'
  status: 'sorteado' | 'aguardando'
  seed: string | null; anfitriaoId: number | null
  participantes: SnapParticipante[]; campeoes: SnapCampeao[]
  cabecasPids: number[]; resultado: unknown | null
}
export type SnapEvento = {
  id: number; nome: string; competicao: string; esporte: string
  cidade: string; local: string; data: string; organizador: string | null
  publicadoEm: string; modalidades: SnapModalidade[]
}
```

> **Nota:** confirmar que `applyAnfitriaoRule` aceita o objeto-param mostrado (`{ campeoesPidsInscritos, anfitriaoPid, anfitriaoInscrito, consideraAnfitriao, tipo, quantidadeGrupos }`) — é a assinatura atual em `sorteios.service.ts`. E que `Competicao` tem `considerar_anfitriao` (tem).

- [ ] **Step 4: Rodar o teste (deve passar)**

Run: `cd backend && npx vitest run src/modules/site-publico/snapshot.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/site-publico/snapshot.ts backend/src/modules/site-publico/snapshot-types.ts backend/src/modules/site-publico/snapshot.test.ts
git commit -m "feat(site-publico): montaSnapshot (evento+modalidades+resultado -> JSON imutavel)"
```

---

### Task 3: Cliente GitHub (commit/delete arquivo + repository_dispatch)

**Files:**
- Create: `backend/src/modules/site-publico/github.ts`
- Create: `backend/src/modules/site-publico/github.test.ts`

Env usados (process.env direto, padrão do projeto): `GITHUB_PAT`, `GITHUB_REPO` (ex.: `wmarrane/prosports`), `GITHUB_SNAPSHOT_BRANCH` (default `develop`).

- [ ] **Step 1: Escrever o teste falho**

```ts
// backend/src/modules/site-publico/github.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { putSnapshot, deleteSnapshot, dispatchBuild } from './github'

const realFetch = globalThis.fetch
beforeEach(() => {
  process.env.GITHUB_PAT = 'tok'
  process.env.GITHUB_REPO = 'owner/repo'
  process.env.GITHUB_SNAPSHOT_BRANCH = 'develop'
})
afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks() })

it('putSnapshot cria arquivo novo (sem sha) com conteudo base64', async () => {
  const calls: any[] = []
  globalThis.fetch = vi.fn(async (url: any, opts: any) => {
    calls.push({ url: String(url), opts })
    if (opts.method === 'GET') return new Response('', { status: 404 })
    return new Response(JSON.stringify({ content: { sha: 'newsha' } }), { status: 201 })
  }) as any

  await putSnapshot(10, { hello: 'world' })

  const put = calls.find((c) => c.opts.method === 'PUT')
  expect(put.url).toContain('/contents/frontend/public-site-snapshots/evento-10.json')
  const body = JSON.parse(put.opts.body)
  expect(body.branch).toBe('develop')
  expect(Buffer.from(body.content, 'base64').toString('utf8')).toContain('"hello"')
  expect(body.sha).toBeUndefined()
})

it('putSnapshot envia sha quando arquivo ja existe', async () => {
  globalThis.fetch = vi.fn(async (url: any, opts: any) => {
    if (opts.method === 'GET') return new Response(JSON.stringify({ sha: 'oldsha' }), { status: 200 })
    return new Response(JSON.stringify({ content: { sha: 'newsha' } }), { status: 200 })
  }) as any
  let putBody: any
  const spy = globalThis.fetch as any
  await putSnapshot(10, { a: 1 })
  putBody = JSON.parse(spy.mock.calls.find((c: any) => c[1].method === 'PUT')[1].body)
  expect(putBody.sha).toBe('oldsha')
})

it('dispatchBuild faz POST em /dispatches com event_type', async () => {
  let url = '', body: any
  globalThis.fetch = vi.fn(async (u: any, o: any) => { url = String(u); body = JSON.parse(o.body); return new Response('', { status: 204 }) }) as any
  await dispatchBuild()
  expect(url).toContain('/dispatches')
  expect(body.event_type).toBe('publicar-site')
})
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `cd backend && npx vitest run src/modules/site-publico/github.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

```ts
// backend/src/modules/site-publico/github.ts
const API = 'https://api.github.com'

function cfg() {
  const pat = process.env.GITHUB_PAT
  const repo = process.env.GITHUB_REPO
  const branch = process.env.GITHUB_SNAPSHOT_BRANCH ?? 'develop'
  if (!pat || !repo) {
    throw Object.assign(new Error('GITHUB_PAT/GITHUB_REPO não configurados'), { status: 500 })
  }
  return { pat, repo, branch }
}

function headers(pat: string) {
  return {
    Authorization: `Bearer ${pat}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  }
}

function snapshotPath(eventoId: number) {
  return `frontend/public-site-snapshots/evento-${eventoId}.json`
}

async function getSha(repo: string, path: string, branch: string, pat: string): Promise<string | undefined> {
  const r = await fetch(`${API}/repos/${repo}/contents/${path}?ref=${branch}`, {
    method: 'GET', headers: headers(pat),
  })
  if (r.status === 404) return undefined
  if (!r.ok) throw Object.assign(new Error(`GitHub getSha ${r.status}`), { status: 502 })
  const json = (await r.json()) as { sha: string }
  return json.sha
}

export async function putSnapshot(eventoId: number, snapshot: unknown): Promise<void> {
  const { pat, repo, branch } = cfg()
  const path = snapshotPath(eventoId)
  const sha = await getSha(repo, path, branch, pat)
  const content = Buffer.from(JSON.stringify(snapshot, null, 2), 'utf8').toString('base64')
  const body: Record<string, unknown> = {
    message: `chore(site): snapshot evento ${eventoId} [skip auto-bump]`,
    content, branch,
  }
  if (sha) body.sha = sha
  const r = await fetch(`${API}/repos/${repo}/contents/${path}`, {
    method: 'PUT', headers: headers(pat), body: JSON.stringify(body),
  })
  if (!r.ok) throw Object.assign(new Error(`GitHub putSnapshot ${r.status}`), { status: 502 })
}

export async function deleteSnapshot(eventoId: number): Promise<void> {
  const { pat, repo, branch } = cfg()
  const path = snapshotPath(eventoId)
  const sha = await getSha(repo, path, branch, pat)
  if (!sha) return
  const r = await fetch(`${API}/repos/${repo}/contents/${path}`, {
    method: 'DELETE', headers: headers(pat),
    body: JSON.stringify({ message: `chore(site): remove snapshot evento ${eventoId} [skip auto-bump]`, sha, branch }),
  })
  if (!r.ok) throw Object.assign(new Error(`GitHub deleteSnapshot ${r.status}`), { status: 502 })
}

export async function dispatchBuild(): Promise<void> {
  const { pat, repo } = cfg()
  const r = await fetch(`${API}/repos/${repo}/dispatches`, {
    method: 'POST', headers: headers(pat),
    body: JSON.stringify({ event_type: 'publicar-site' }),
  })
  if (!r.ok) throw Object.assign(new Error(`GitHub dispatch ${r.status}`), { status: 502 })
}
```

- [ ] **Step 4: Rodar (deve passar)**

Run: `cd backend && npx vitest run src/modules/site-publico/github.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/site-publico/github.ts backend/src/modules/site-publico/github.test.ts
git commit -m "feat(site-publico): cliente GitHub (snapshot commit/delete + dispatch)"
```

---

### Task 4: Service publicar/despublicar (orquestração)

**Files:**
- Create: `backend/src/modules/site-publico/site-publico.service.ts`
- Create: `backend/src/modules/site-publico/site-publico.service.test.ts`

- [ ] **Step 1: Escrever o teste falho**

```ts
// backend/src/modules/site-publico/site-publico.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    evento: { findUnique: vi.fn(), update: vi.fn() },
    modalidade: { findMany: vi.fn() },
    inscricao: { findMany: vi.fn() },
    campeaoAnterior: { findMany: vi.fn() },
    sorteio: { findMany: vi.fn() },
  },
}))
vi.mock('./github', () => ({
  putSnapshot: vi.fn(async () => {}),
  deleteSnapshot: vi.fn(async () => {}),
  dispatchBuild: vi.fn(async () => {}),
}))

import prisma from '../../lib/prisma'
import * as github from './github'
import * as service from './site-publico.service'

const mp = prisma as any
beforeEach(() => {
  vi.clearAllMocks()
  mp.evento.findUnique.mockResolvedValue({
    id: 10, nome: 'Jogos', local: 'Gin', organizador: 'M', data_hora: new Date('2026-05-10T12:00:00Z'),
    anfitriao_id: null, competicao_id: 7,
    competicao: { nome: 'Regionais', considerar_anfitriao: false, subtitulo_campos: [] },
    municipio: { nome: 'São Manuel' },
  })
  mp.modalidade.findMany.mockResolvedValue([{ id: 1, nome: 'Futsal', sigla: 'F', tipo_modalidade: { tipo: 'grupos' } }])
  mp.inscricao.findMany.mockResolvedValue([{ modalidade_id: 1, participante: { id: 100, nome: 'Tigres', subtitulo: null } }])
  mp.campeaoAnterior.findMany.mockResolvedValue([])
  mp.sorteio.findMany.mockResolvedValue([{ modalidade_id: 1, tipo: 'grupos', seed: 'S', resultado: { grupos: [{ letra: 'A', participantes: [100] }] } }])
  mp.evento.update.mockResolvedValue({})
})

it('publicar monta snapshot, commita, dispara e marca publicado', async () => {
  await service.publicar(10)
  expect(github.putSnapshot).toHaveBeenCalledTimes(1)
  const [eid, snap] = (github.putSnapshot as any).mock.calls[0]
  expect(eid).toBe(10)
  expect(snap.modalidades[0].status).toBe('sorteado')
  expect(github.dispatchBuild).toHaveBeenCalledTimes(1)
  expect(mp.evento.update).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: 10 }, data: expect.objectContaining({ site_publicado_em: expect.any(Date) }),
  }))
})

it('publicar 404 se evento inexistente', async () => {
  mp.evento.findUnique.mockResolvedValue(null)
  await expect(service.publicar(999)).rejects.toMatchObject({ status: 404 })
})

it('despublicar remove snapshot, dispara e limpa', async () => {
  await service.despublicar(10)
  expect(github.deleteSnapshot).toHaveBeenCalledWith(10)
  expect(github.dispatchBuild).toHaveBeenCalledTimes(1)
  expect(mp.evento.update).toHaveBeenCalledWith({ where: { id: 10 }, data: { site_publicado_em: null } })
})
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `cd backend && npx vitest run src/modules/site-publico/site-publico.service.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

```ts
// backend/src/modules/site-publico/site-publico.service.ts
import prisma from '../../lib/prisma'
import { montaSnapshot } from './snapshot'
import { putSnapshot, deleteSnapshot, dispatchBuild } from './github'
import { composeSubtituloLine } from '../../lib/compose-subtitulo'

export async function publicar(eventoId: number): Promise<void> {
  const evento = await prisma.evento.findUnique({
    where: { id: eventoId },
    select: {
      id: true, nome: true, local: true, organizador: true, data_hora: true,
      anfitriao_id: true, competicao_id: true,
      competicao: { select: { nome: true, considerar_anfitriao: true, subtitulo_campos: true } },
      municipio: { select: { nome: true } },
    },
  })
  if (!evento) throw Object.assign(new Error('Evento não encontrado'), { status: 404 })

  const modalidades = await prisma.modalidade.findMany({
    where: { competicao_id: evento.competicao_id },
    select: { id: true, nome: true, sigla: true, tipo_modalidade: { select: { tipo: true } } },
    orderBy: { nome: 'asc' },
  })

  const [inscricoes, campeoes, sorteios] = await Promise.all([
    prisma.inscricao.findMany({
      where: { evento_id: eventoId },
      select: { modalidade_id: true, participante: { select: { id: true, nome: true, subtitulo: true, municipio: true, inspetoria: true, delegacia: true } } },
      orderBy: { criado_em: 'asc' },
    }),
    prisma.campeaoAnterior.findMany({
      where: { evento_id: eventoId },
      select: { modalidade_id: true, participante_id: true, posicao: true },
    }),
    prisma.sorteio.findMany({
      where: { evento_id: eventoId },
      select: { modalidade_id: true, tipo: true, seed: true, resultado: true },
    }),
  ])

  const inscricoesPorModalidade = new Map<number, any[]>()
  for (const i of inscricoes) {
    const arr = inscricoesPorModalidade.get(i.modalidade_id) ?? []
    arr.push(i); inscricoesPorModalidade.set(i.modalidade_id, arr)
  }
  const campeoesPorModalidade = new Map<number, any[]>()
  for (const c of campeoes) {
    const arr = campeoesPorModalidade.get(c.modalidade_id) ?? []
    arr.push(c); campeoesPorModalidade.set(c.modalidade_id, arr)
  }
  const sorteiosPorModalidade = new Map<number, any>()
  for (const s of sorteios) sorteiosPorModalidade.set(s.modalidade_id, s)

  const campos = (evento.competicao.subtitulo_campos as string[]) ?? []
  const snapshot = montaSnapshot({
    evento: evento as any,
    modalidades: modalidades as any,
    inscricoesPorModalidade,
    campeoesPorModalidade,
    sorteiosPorModalidade,
    subtituloFn: (p: any) => composeSubtituloLine(p, campos),
  })

  await putSnapshot(eventoId, snapshot)
  await dispatchBuild()
  await prisma.evento.update({ where: { id: eventoId }, data: { site_publicado_em: new Date() } })
}

export async function despublicar(eventoId: number): Promise<void> {
  await deleteSnapshot(eventoId)
  await dispatchBuild()
  await prisma.evento.update({ where: { id: eventoId }, data: { site_publicado_em: null } })
}
```

> **Nota:** `composeSubtituloLine` existe no frontend (`frontend/src/lib/compose-subtitulo`). Verificar se há equivalente no backend; se não houver, criar `backend/src/lib/compose-subtitulo.ts` portando a mesma função (entrada: participante com municipio/inspetoria/delegacia + lista de campos; saída: string|null). Reusar a lógica exata do frontend para paridade. Se a função do frontend só usa campos simples, portar 1:1.

- [ ] **Step 4: Rodar (deve passar)**

Run: `cd backend && npx vitest run src/modules/site-publico/site-publico.service.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/site-publico/site-publico.service.ts backend/src/modules/site-publico/site-publico.service.test.ts backend/src/lib/compose-subtitulo.ts
git commit -m "feat(site-publico): service publicar/despublicar (snapshot + dispatch + flag)"
```

---

### Task 5: Controller + rotas

**Files:**
- Create: `backend/src/modules/site-publico/site-publico.controller.ts`
- Modify: `backend/src/modules/eventos/eventos.routes.ts` (adicionar 2 rotas admin)

- [ ] **Step 1: Implementar o controller**

```ts
// backend/src/modules/site-publico/site-publico.controller.ts
import type { Request, Response, NextFunction } from 'express'
import * as service from './site-publico.service'

export async function publicar(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id)
    await service.publicar(id)
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function despublicar(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id)
    await service.despublicar(id)
    res.json({ ok: true })
  } catch (err) { next(err) }
}
```

- [ ] **Step 2: Adicionar as rotas em `eventos.routes.ts`**

No topo, importar:

```ts
import * as sitePublico from '../site-publico/site-publico.controller'
```

E adicionar (seguindo o padrão `admin = [requireAuth, requireRole('ADMIN')]` do projeto — usar o array `admin` já existente no arquivo; se não existir, definir `const admin = [requireAuth, requireRole('ADMIN')]`):

```ts
router.post('/:id/publicar', ...admin, sitePublico.publicar)
router.post('/:id/despublicar', ...admin, sitePublico.despublicar)
```

- [ ] **Step 3: Typecheck do backend**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Rodar a suíte do módulo**

Run: `cd backend && npx vitest run src/modules/site-publico`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/site-publico/site-publico.controller.ts backend/src/modules/eventos/eventos.routes.ts
git commit -m "feat(site-publico): rotas POST /eventos/:id/publicar e /despublicar (admin)"
```

---

### Task 6: Frontend — botão "Publicar evento"

**Files:**
- Modify: `frontend/src/services/eventos.ts` (2 métodos)
- Modify: a página de detalhe/edição do evento (`frontend/src/pages/eventos/EventoForm.tsx` ou a lista `EventosList.tsx` — usar a que tem ações por evento; confirmar onde ficam ações de evento)
- Test: `frontend/src/services/eventos.publicar.test.ts` (se houver setup de teste de service; senão, validar via typecheck)

- [ ] **Step 1: Adicionar métodos no service**

Em `frontend/src/services/eventos.ts`, dentro do objeto `eventosService`:

```ts
  publicar: (id: number) => api.post(`/eventos/${id}/publicar`).then(r => r.data),
  despublicar: (id: number) => api.post(`/eventos/${id}/despublicar`).then(r => r.data),
```

- [ ] **Step 2: Adicionar o botão + mutation**

Na página de ações do evento, adicionar uma mutation react-query e botões "Publicar no site"/"Despublicar" conforme `evento.site_publicado_em`:

```tsx
const { mutate: publicar, isPending: publicando } = useMutation({
  mutationFn: () => eventosService.publicar(evento.id),
  onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['eventos'] }); alert('Publicação disparada. O site será atualizado em ~1-2 min.') },
  onError: (e: any) => alert(e?.response?.data?.message ?? 'Erro ao publicar.'),
})
// análogo para despublicar -> eventosService.despublicar(evento.id)
```

```tsx
{evento.site_publicado_em ? (
  <button onClick={() => despublicar()} disabled={despublicando} className="cw-btn cw-btn-ghost">Despublicar do site</button>
) : (
  <button onClick={() => publicar()} disabled={publicando} className="cw-btn cw-btn-primary">Publicar no site</button>
)}
```

Adicionar `site_publicado_em: string | null` ao type `Evento` do frontend (`frontend/src/types/evento.ts`).

- [ ] **Step 3: Typecheck do frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/eventos.ts frontend/src/types/evento.ts frontend/src/pages/eventos
git commit -m "feat(site-publico): botao Publicar/Despublicar evento no admin"
```

---

# FASE 2 — SSG: render estático reusando React

### Task 7: Tipos do snapshot + fixtures no frontend

**Files:**
- Create: `frontend/src/site-publico/snapshot-types.ts` (cópia do contrato — mesma forma do backend)
- Create: `frontend/src/site-publico/__fixtures__/evento-grupos.json`
- Create: `frontend/src/site-publico/__fixtures__/evento-chaves.json`

- [ ] **Step 1: Criar os tipos**

Copiar exatamente o bloco `SnapParticipante/SnapCampeao/SnapModalidade/SnapEvento` da seção "Contrato do snapshot" deste plano para `frontend/src/site-publico/snapshot-types.ts`.

- [ ] **Step 2: Criar fixture de grupos**

```json
// frontend/src/site-publico/__fixtures__/evento-grupos.json
{
  "id": 10, "nome": "Jogos Regionais 2026", "competicao": "Jogos Regionais",
  "esporte": "Jogos Regionais", "cidade": "São Manuel", "local": "Ginásio Central",
  "data": "2026-05-10T12:00:00.000Z", "organizador": "Montana Eventos",
  "publicadoEm": "2026-06-06T18:00:00.000Z",
  "modalidades": [{
    "id": 1, "nome": "Futsal Masculino", "grupo": null, "tipo": "grupos",
    "status": "sorteado", "seed": "DE5B-8022-5193-ED3B", "anfitriaoId": null,
    "participantes": [
      { "id": 100, "nome": "Tigres do Vale", "subtitulo": "Interior" },
      { "id": 101, "nome": "Os Lobos", "subtitulo": "Capital" },
      { "id": 102, "nome": "Vendaval", "subtitulo": "Serra" },
      { "id": 103, "nome": "União Azul", "subtitulo": "Litoral" }
    ],
    "campeoes": [{ "participanteId": 100, "posicao": 1 }],
    "cabecasPids": [100],
    "resultado": { "regra_id": 5, "classificados_por_grupo": 2, "grupos": [{ "letra": "A", "participantes": [100, 101, 102, 103] }] }
  }]
}
```

- [ ] **Step 3: Criar fixture de chaves**

```json
// frontend/src/site-publico/__fixtures__/evento-chaves.json
{
  "id": 11, "nome": "Copa Chaves 2026", "competicao": "Copa", "esporte": "Copa",
  "cidade": "Bauru", "local": "Arena", "data": "2026-06-01T12:00:00.000Z",
  "organizador": "Montana Eventos", "publicadoEm": "2026-06-06T18:00:00.000Z",
  "modalidades": [{
    "id": 2, "nome": "Tênis", "grupo": null, "tipo": "chaves",
    "status": "sorteado", "seed": "AAAA-BBBB-CCCC-DDDD", "anfitriaoId": null,
    "participantes": [
      { "id": 200, "nome": "Ana", "subtitulo": null },
      { "id": 201, "nome": "Bia", "subtitulo": null },
      { "id": 202, "nome": "Cris", "subtitulo": null },
      { "id": 203, "nome": "Duda", "subtitulo": null }
    ],
    "campeoes": [], "cabecasPids": [],
    "resultado": {
      "size": 4, "slots": [200, 201, 202, 203], "byePositions": [],
      "matchesGraph": {
        "matches": [
          { "id": "J1", "round": 1, "top": "P1", "bottom": "P2" },
          { "id": "J2", "round": 1, "top": "P3", "bottom": "P4" },
          { "id": "J3", "round": 2, "top": "V:J1", "bottom": "V:J2" }
        ],
        "final": "J3", "thirdPlace": null
      }
    }
  }]
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/site-publico/snapshot-types.ts frontend/src/site-publico/__fixtures__
git commit -m "feat(site-publico): tipos do snapshot + fixtures (grupos/chaves)"
```

---

### Task 8: Componente que renderiza o sorteio de uma modalidade (reuso React)

**Files:**
- Create: `frontend/src/site-publico/components/ModalidadeSorteio.tsx`
- Create: `frontend/src/site-publico/components/ModalidadeSorteio.test.tsx`

Reusa `SorteioGrupos`, `SorteioChaves`, `SorteioOrdem` de `frontend/src/components/sorteio-result/`. Constrói os Maps a partir do snapshot.

- [ ] **Step 1: Escrever o teste falho**

```tsx
// frontend/src/site-publico/components/ModalidadeSorteio.test.tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ModalidadeSorteio from './ModalidadeSorteio'
import grupos from '../__fixtures__/evento-grupos.json'
import chaves from '../__fixtures__/evento-chaves.json'
import type { SnapModalidade } from '../snapshot-types'

it('renderiza grupos com nome do participante e letra do grupo', () => {
  const html = renderToStaticMarkup(<ModalidadeSorteio modalidade={grupos.modalidades[0] as SnapModalidade} />)
  expect(html).toContain('Tigres do Vale')
  expect(html).toContain('Grupo')
})

it('renderiza chaves com os jogos', () => {
  const html = renderToStaticMarkup(<ModalidadeSorteio modalidade={chaves.modalidades[0] as SnapModalidade} />)
  expect(html).toContain('Ana')
  expect(html).toContain('Bia')
})

it('renderiza estado aguardando quando sem resultado', () => {
  const m = { ...(chaves.modalidades[0] as SnapModalidade), status: 'aguardando', resultado: null }
  const html = renderToStaticMarkup(<ModalidadeSorteio modalidade={m} />)
  expect(html).toContain('Aguardando sorteio')
})
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `cd frontend && npx vitest run src/site-publico/components/ModalidadeSorteio.test.tsx`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

```tsx
// frontend/src/site-publico/components/ModalidadeSorteio.tsx
import SorteioGrupos from '../../components/sorteio-result/SorteioGrupos'
import SorteioChaves from '../../components/sorteio-result/SorteioChaves'
import SorteioOrdem from '../../components/sorteio-result/SorteioOrdem'
import type { Participante } from '../../types/participante'
import type { SnapModalidade } from '../snapshot-types'

function buildMaps(m: SnapModalidade) {
  const participantesById = new Map<number, Participante>()
  for (const p of m.participantes) {
    participantesById.set(p.id, { id: p.id, nome: p.nome, subtitulo: p.subtitulo } as Participante)
  }
  const campeoesByParticipanteId = new Map<number, number>()
  for (const c of m.campeoes) campeoesByParticipanteId.set(c.participanteId, c.posicao)
  const subtituloLine = (p: Participante) => participantesById.get(p.id)?.subtitulo ?? null
  return { participantesById, campeoesByParticipanteId, subtituloLine }
}

export default function ModalidadeSorteio({ modalidade }: { modalidade: SnapModalidade }) {
  if (modalidade.status !== 'sorteado' || !modalidade.resultado) {
    return <div style={{ padding: 16, color: 'var(--t3)', fontStyle: 'italic' }}>Aguardando sorteio</div>
  }
  const { participantesById, campeoesByParticipanteId, subtituloLine } = buildMaps(modalidade)
  const anfitriaoPid = modalidade.anfitriaoId ?? null
  const cabecasPids = new Set(modalidade.cabecasPids)

  if (modalidade.tipo === 'grupos') {
    return (
      <SorteioGrupos
        resultado={modalidade.resultado as any}
        participantesById={participantesById}
        large
        campeoesByParticipanteId={campeoesByParticipanteId}
        anfitriaoPid={anfitriaoPid}
        subtituloLine={subtituloLine}
      />
    )
  }
  if (modalidade.tipo === 'chaves') {
    return (
      <SorteioChaves
        resultado={modalidade.resultado as any}
        participantesById={participantesById}
        large
        campeoesByParticipanteId={campeoesByParticipanteId}
        anfitriaoPid={anfitriaoPid}
        subtituloLine={subtituloLine}
        cabecasPids={cabecasPids}
      />
    )
  }
  if (modalidade.tipo === 'ordem_entrada') {
    return (
      <SorteioOrdem
        resultado={modalidade.resultado as any}
        participantesById={participantesById}
        large
        anfitriaoPid={anfitriaoPid}
        subtituloLine={subtituloLine}
      />
    )
  }
  return <div style={{ padding: 16, color: 'var(--t3)' }}>Emparceiramento específico</div>
}
```

- [ ] **Step 4: Rodar (deve passar)**

Run: `cd frontend && npx vitest run src/site-publico/components/ModalidadeSorteio.test.tsx`
Expected: PASS (3 testes). Se o vitest do frontend não tiver ambiente jsdom configurado, este teste usa `renderToStaticMarkup` (server) e não precisa de DOM — deve rodar no ambiente node padrão.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/site-publico/components/ModalidadeSorteio.tsx frontend/src/site-publico/components/ModalidadeSorteio.test.tsx
git commit -m "feat(site-publico): ModalidadeSorteio reusa componentes de sorteio do painel"
```

---

### Task 9: Páginas (institucional + evento) como componentes React

**Files:**
- Create: `frontend/src/site-publico/components/SiteNav.tsx`
- Create: `frontend/src/site-publico/components/EventoCard.tsx`
- Create: `frontend/src/site-publico/pages/EventoPage.tsx`
- Create: `frontend/src/site-publico/pages/IndexPage.tsx`
- Create: `frontend/src/site-publico/pages/EventosPage.tsx`
- Create: `frontend/src/site-publico/pages/SobrePage.tsx`
- Create: `frontend/src/site-publico/pages/EventoPage.test.tsx`

**Fonte de verdade do markup/estilo:** os arquivos hi-fi do handoff em `personaladmin/handoff/design_handoff_site_institucional/site/` (`index.html`, `eventos.html`, `sobre.html`, `evento-EV-*.html`) + `site.css`. Portar a estrutura para JSX mantendo classes/estilos; **não inventar layout novo**. O botão "Entrar" aponta para `https://newprosports.web.app/login`.

- [ ] **Step 1: SiteNav** — nav sticky com `Início · Eventos · Sobre` + botão Entrar.

```tsx
// frontend/src/site-publico/components/SiteNav.tsx
const LOGIN_URL = 'https://newprosports.web.app/login'
export default function SiteNav({ active }: { active: 'inicio' | 'eventos' | 'sobre' }) {
  return (
    <nav className="site-nav">
      <a href="/index.html" className="site-brand">Montana Eventos</a>
      <div className="site-nav-links">
        <a href="/index.html" aria-current={active === 'inicio' ? 'page' : undefined}>Início</a>
        <a href="/eventos.html" aria-current={active === 'eventos' ? 'page' : undefined}>Eventos</a>
        <a href="/sobre.html" aria-current={active === 'sobre' ? 'page' : undefined}>Sobre</a>
        <a className="btn btn-primary" href={LOGIN_URL}>Entrar</a>
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: EventoCard** — card com contadores (modalidades / inscritos / sorteadas), link para `/evento-<id>.html`.

```tsx
// frontend/src/site-publico/components/EventoCard.tsx
import type { SnapEvento } from '../snapshot-types'
export default function EventoCard({ evento }: { evento: SnapEvento }) {
  const total = evento.modalidades.length
  const inscritos = evento.modalidades.reduce((s, m) => s + m.participantes.length, 0)
  const sorteadas = evento.modalidades.filter(m => m.status === 'sorteado').length
  return (
    <a className="evento-card" href={`/evento-${evento.id}.html`}>
      <h3>{evento.nome}</h3>
      <p className="evento-meta">{evento.cidade} · {new Date(evento.data).toLocaleDateString('pt-BR')}</p>
      <div className="evento-counts">
        <span>{total} modalidades</span><span>{inscritos} inscritos</span><span>{sorteadas} sorteadas</span>
      </div>
    </a>
  )
}
```

- [ ] **Step 3: EventoPage** — por modalidade: inscritos + campeões + `<ModalidadeSorteio>`, com acordeão `<details>` e agrupamento por categoria (porte os mecanismos de escala do handoff: `<details>` aberto se `total ≤ 10`). Escrever o teste primeiro:

```tsx
// frontend/src/site-publico/pages/EventoPage.test.tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import EventoPage from './EventoPage'
import grupos from '../__fixtures__/evento-grupos.json'
import type { SnapEvento } from '../snapshot-types'

it('renderiza nome do evento, modalidade e seed', () => {
  const html = renderToStaticMarkup(<EventoPage evento={grupos as SnapEvento} />)
  expect(html).toContain('Jogos Regionais 2026')
  expect(html).toContain('Futsal Masculino')
  expect(html).toContain('DE5B-8022-5193-ED3B')
  expect(html).toContain('Tigres do Vale')
})
```

Implementar `EventoPage` renderizando, por modalidade, um `<details>` com: cabeçalho (nome, tipo, status, seed), lista de inscritos, campeões (se houver) e `<ModalidadeSorteio>`. Categoria = `modalidade.grupo` ou prefixo antes de `·` no nome. `<details open>` quando `evento.modalidades.length <= 10`.

```tsx
// frontend/src/site-publico/pages/EventoPage.tsx
import SiteNav from '../components/SiteNav'
import ModalidadeSorteio from '../components/ModalidadeSorteio'
import type { SnapEvento, SnapModalidade } from '../snapshot-types'

function categoriaDe(m: SnapModalidade): string {
  if (m.grupo) return m.grupo
  const idx = m.nome.indexOf('·')
  return idx > 0 ? m.nome.slice(0, idx).trim() : m.nome.split(' ')[0]
}

export default function EventoPage({ evento }: { evento: SnapEvento }) {
  const abrir = evento.modalidades.length <= 10
  const cats = new Map<string, SnapModalidade[]>()
  for (const m of evento.modalidades) {
    const c = categoriaDe(m); const arr = cats.get(c) ?? []; arr.push(m); cats.set(c, arr)
  }
  return (
    <>
      <SiteNav active="eventos" />
      <main className="evento-page">
        <header className="evento-header">
          <h1>{evento.nome}</h1>
          <p>{evento.cidade} · {evento.local} · {new Date(evento.data).toLocaleDateString('pt-BR')}</p>
        </header>
        {[...cats.entries()].map(([cat, mods]) => (
          <section className="cat-section" key={cat}>
            <h2 className="cat-head">{cat} <span>{mods.length}</span></h2>
            {mods.map((m) => (
              <details className="mod-acc" open={abrir} key={m.id} id={`mod-${m.id}`}>
                <summary>
                  <strong>{m.nome}</strong>
                  <span className="mod-meta">{m.tipo} · {m.participantes.length} inscritos · {m.status}</span>
                  {m.seed && <span className="mod-seed">semente {m.seed}</span>}
                </summary>
                <div className="mod-body">
                  <ModalidadeSorteio modalidade={m} />
                  <section className="inscritos">
                    <h4>Inscritos ({m.participantes.length})</h4>
                    <ul>{m.participantes.map(p => <li key={p.id}>{p.nome}{p.subtitulo ? ` — ${p.subtitulo}` : ''}</li>)}</ul>
                  </section>
                  {m.campeoes.length > 0 && (
                    <section className="campeoes">
                      <h4>Campeões do ano anterior</h4>
                      <ul>{m.campeoes.map(c => {
                        const p = m.participantes.find(x => x.id === c.participanteId)
                        return <li key={c.participanteId}>{c.posicao}º {p?.nome ?? '—'}</li>
                      })}</ul>
                    </section>
                  )}
                </div>
              </details>
            ))}
          </section>
        ))}
      </main>
    </>
  )
}
```

- [ ] **Step 4: IndexPage / EventosPage / SobrePage** — portar de `index.html`/`eventos.html`/`sobre.html`. `IndexPage` e `EventosPage` recebem `eventos: SnapEvento[]`; `EventosPage` agrupa por ano (`new Date(e.data).getFullYear()`). `SobrePage` é estática (copy do handoff). Cada uma renderiza `<SiteNav>` + conteúdo + footer. (Markup detalhado: seguir os arquivos do handoff; lógica de agrupamento abaixo.)

```tsx
// trecho-chave de EventosPage.tsx
const porAno = new Map<number, SnapEvento[]>()
for (const e of eventos) { const y = new Date(e.data).getFullYear(); const a = porAno.get(y) ?? []; a.push(e); porAno.set(y, a) }
const anos = [...porAno.keys()].sort((a, b) => b - a)
```

- [ ] **Step 5: Rodar testes**

Run: `cd frontend && npx vitest run src/site-publico`
Expected: PASS (ModalidadeSorteio + EventoPage).

- [ ] **Step 6: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/site-publico
git commit -m "feat(site-publico): paginas React (nav, card, evento, index, eventos, sobre)"
```

---

### Task 10: Script SSR de build (renderiza HTML + CSS)

**Files:**
- Create: `frontend/scripts/build-site-publico.tsx`
- Create: `frontend/src/site-publico/html-shell.ts`
- Create: `frontend/src/site-publico/site.css` (porte de `personaladmin/handoff/.../site/site.css`)

O script: lê snapshots de `frontend/public-site-snapshots/*.json`, renderiza cada página via `renderToStaticMarkup`, embrulha num shell HTML que inclui os CSS (tokens + theme + site.css + Tailwind compilado), e grava em `frontend/dist-site/`.

- [ ] **Step 1: html-shell**

```ts
// frontend/src/site-publico/html-shell.ts
export function htmlShell(opts: { title: string; body: string; cssHref: string }): string {
  return `<!doctype html>
<html lang="pt-BR" data-theme="light">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${opts.title}</title>
<link rel="stylesheet" href="${opts.cssHref}" />
</head>
<body>${opts.body}</body>
</html>`
}
```

- [ ] **Step 2: Script de build**

```tsx
// frontend/scripts/build-site-publico.tsx
import { readdirSync, readFileSync, mkdirSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import IndexPage from '../src/site-publico/pages/IndexPage'
import EventosPage from '../src/site-publico/pages/EventosPage'
import SobrePage from '../src/site-publico/pages/SobrePage'
import EventoPage from '../src/site-publico/pages/EventoPage'
import { htmlShell } from '../src/site-publico/html-shell'
import type { SnapEvento } from '../src/site-publico/snapshot-types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SNAP_DIR = join(ROOT, 'public-site-snapshots')
const OUT = join(ROOT, 'dist-site')
const CSS_HREF = '/site-bundle.css'

function loadSnapshots(): SnapEvento[] {
  if (!existsSync(SNAP_DIR)) return []
  return readdirSync(SNAP_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(SNAP_DIR, f), 'utf8')) as SnapEvento)
    .sort((a, b) => +new Date(b.data) - +new Date(a.data))
}

function emit(name: string, title: string, el: React.ReactElement) {
  const body = renderToStaticMarkup(el)
  writeFileSync(join(OUT, name), htmlShell({ title, body, cssHref: CSS_HREF }), 'utf8')
}

function main() {
  const eventos = loadSnapshots()
  mkdirSync(OUT, { recursive: true })
  emit('index.html', 'Montana Eventos', React.createElement(IndexPage, { eventos }))
  emit('eventos.html', 'Eventos · Montana', React.createElement(EventosPage, { eventos }))
  emit('sobre.html', 'Sobre · Montana', React.createElement(SobrePage))
  for (const ev of eventos) {
    emit(`evento-${ev.id}.html`, `${ev.nome} · Montana`, React.createElement(EventoPage, { evento: ev }))
  }
  // CSS bundle: concatena tokens + theme + site.css (Tailwind via Task 11)
  console.log(`Gerados ${eventos.length} eventos + 3 páginas em ${OUT}`)
}
main()
```

- [ ] **Step 3: Commit**

```bash
git add frontend/scripts/build-site-publico.tsx frontend/src/site-publico/html-shell.ts frontend/src/site-publico/site.css
git commit -m "feat(site-publico): script SSR de build + shell HTML"
```

---

### Task 11: CSS bundle (Tailwind + tokens) e npm script de build

**Files:**
- Create: `frontend/tailwind.site.config.js` (content = componentes do painel reusados + site-publico)
- Create: `frontend/src/site-publico/site-entry.css` (`@tailwind` + imports de tokens/theme/site)
- Modify: `frontend/package.json` (script `build:site`)

Os componentes reusam classes Tailwind (`bg-[var(--card-bg-2)]`, `text-xl`, etc.). O CSS final precisa conter as utilidades Tailwind usadas por esses componentes + as variáveis de tokens.

- [ ] **Step 1: Tailwind config do site**

```js
// frontend/tailwind.site.config.js
import base from './tailwind.config.js'
export default {
  ...base,
  content: [
    './src/site-publico/**/*.{ts,tsx}',
    './src/components/sorteio-result/**/*.{ts,tsx}',
    './src/components/CampeaoBadge.tsx',
    './src/components/AnfitriaoBadge.tsx',
  ],
}
```

> Confirmar o nome real do arquivo Tailwind do frontend (`tailwind.config.js`/`.ts`/`.cjs`) e ajustar o import. Se o projeto usa Tailwind v4 (config no CSS), adaptar: criar um CSS de entrada com `@import "tailwindcss"` + `@source` apontando para os mesmos diretórios.

- [ ] **Step 2: CSS de entrada**

```css
/* frontend/src/site-publico/site-entry.css */
@import '../../src/styles/tokens.css';        /* ajustar caminho real dos tokens */
@import '../../src/styles/prosports-theme.css';
@tailwind base;
@tailwind components;
@tailwind utilities;
@import './site.css';
```

> Ajustar os caminhos de `tokens.css`/`prosports-theme.css` para os reais do projeto (procurar onde o `frontend` importa esses tokens hoje — provavelmente em `src/index.css` ou `src/main.tsx`).

- [ ] **Step 3: npm script**

Em `frontend/package.json`, adicionar:

```json
    "build:site": "npx tailwindcss -c tailwind.site.config.js -i src/site-publico/site-entry.css -o dist-site/site-bundle.css --minify && tsx scripts/build-site-publico.tsx"
```

> Confirmar que `tsx` está disponível (devDependency). Se não, usar `node --import tsx scripts/build-site-publico.tsx` ou compilar via `vite-node`. Se o frontend usa Tailwind v4, trocar o comando por `npx @tailwindcss/cli`.

- [ ] **Step 4: Rodar o build com fixtures**

Copiar as fixtures para a pasta de snapshots e rodar:

Run (PowerShell):
```powershell
cd frontend
mkdir public-site-snapshots -Force
Copy-Item src/site-publico/__fixtures__/*.json public-site-snapshots/
npm run build:site
```
Expected: imprime "Gerados 2 eventos + 3 páginas"; `dist-site/` contém `index.html`, `eventos.html`, `sobre.html`, `evento-10.html`, `evento-11.html`, `site-bundle.css`.

- [ ] **Step 5: Verificar visualmente**

Abrir `frontend/dist-site/evento-10.html` no navegador (ou via Playwright/preview). Confirmar: nome do evento, grupo A com Tigres do Vale destacado como cabeça (cor warn), seed visível, estilos aplicados.

- [ ] **Step 6: Commit**

```bash
git add frontend/tailwind.site.config.js frontend/src/site-publico/site-entry.css frontend/package.json
git commit -m "feat(site-publico): bundle CSS (tailwind+tokens) e script build:site"
```

---

# FASE 3 — Pipeline + hosting

### Task 12: Segundo target Firebase

**Files:**
- Modify: `frontend/firebase.json`
- Modify: `frontend/.firebaserc`

- [ ] **Step 1: firebase.json — dois sites**

Trocar o objeto `hosting` por um array com os dois sites (admin existente + público novo). O site público **não** tem o rewrite SPA:

```json
{
  "hosting": [
    {
      "target": "admin",
      "public": "dist",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [{ "source": "**", "destination": "/index.html" }],
      "headers": [
        { "source": "**/*.@(js|css|woff2|svg|png|jpg|jpeg|gif|ico)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
        { "source": "index.html", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] }
      ]
    },
    {
      "target": "publico",
      "public": "dist-site",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "headers": [
        { "source": "**/*.@(js|css|woff2|svg|png|jpg|jpeg|gif|ico)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
        { "source": "**/*.html", "headers": [{ "key": "Cache-Control", "value": "public, max-age=300" }] }
      ]
    }
  ]
}
```

- [ ] **Step 2: .firebaserc — mapear targets**

```json
{
  "projects": { "default": "newprosports" },
  "targets": {
    "newprosports": {
      "hosting": {
        "admin": ["newprosports"],
        "publico": ["SITE_ID_PUBLICO"]
      }
    }
  }
}
```

> `SITE_ID_PUBLICO` é o ID do segundo site Firebase (criado no checklist de produção, Task 14). Até existir, deixar documentado; o deploy do site público só funciona após criar o site.

- [ ] **Step 3: Commit**

```bash
git add frontend/firebase.json frontend/.firebaserc
git commit -m "feat(site-publico): segundo target Firebase (admin + publico)"
```

> **Atenção:** o `deploy-main.yml` atual roda `firebase deploy --only hosting`. Com dois targets, mudar para `--only hosting:admin` para o admin não tentar publicar o site público sem build. Fazer essa troca em `deploy-main.yml` (linha do deploy do frontend).

---

### Task 13: Workflow build-site-publico

**Files:**
- Create: `.github/workflows/build-site-publico.yml`
- Modify: `.github/workflows/deploy-main.yml` (frontend deploy → `--only hosting:admin`)

- [ ] **Step 1: Criar o workflow**

```yaml
# .github/workflows/build-site-publico.yml
name: Build Site Público

on:
  repository_dispatch:
    types: [publicar-site]
  workflow_dispatch:

jobs:
  build-deploy:
    runs-on: ubuntu-latest
    environment: production
    permissions:
      contents: read
      id-token: write
    steps:
      - name: Checkout
        uses: actions/checkout@v6
        with:
          ref: develop   # snapshots vivem na develop

      - name: Setup Node 24
        uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Instalar deps
        run: cd frontend && npm ci

      - name: Build do site público
        run: cd frontend && npm run build:site

      - name: Autenticar GCP via WIF (Firebase)
        uses: google-github-actions/auth@v3
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SA_FIREBASE }}

      - name: Instalar Firebase CLI
        run: npm install -g firebase-tools

      - name: Deploy Firebase Hosting (público)
        working-directory: ./frontend
        run: firebase deploy --only hosting:publico --project ${{ secrets.GCP_PROJECT }} --non-interactive
```

- [ ] **Step 2: Ajustar deploy-main.yml**

Na step "Deploy Firebase Hosting" do job `deploy-frontend`, trocar:
`firebase deploy --only hosting ...` → `firebase deploy --only hosting:admin ...`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/build-site-publico.yml .github/workflows/deploy-main.yml
git commit -m "feat(site-publico): workflow build+deploy do site publico (dispatch)"
```

- [ ] **Step 4: Validar disparo manual**

Após merge em develop e criação do site Firebase (Task 14), rodar:
Run: `gh workflow run "Build Site Público"`
Expected: run verde; `dist-site` publicado no site público.

---

### Task 14: Checklist de produção (manual — fora do código)

Não é commit; é runbook. Marcar cada item ao concluir.

- [ ] Criar o segundo site no Firebase Hosting (projeto `newprosports`): `firebase hosting:sites:create <SITE_ID_PUBLICO>` e preencher `SITE_ID_PUBLICO` no `.firebaserc`.
- [ ] `firebase target:apply hosting publico <SITE_ID_PUBLICO>` (ou já refletido no `.firebaserc`).
- [ ] Adicionar custom domain `www.eventosmontana.com.br` no console do site público + configurar DNS (registros A/TXT) no registrar do domínio.
- [ ] Gerar PAT fine-grained (escopo: Contents read/write + Dispatch no repo `wmarrane/prosports`); cadastrar como secrets de produção no backend: `GITHUB_PAT`, `GITHUB_REPO=wmarrane/prosports`, `GITHUB_SNAPSHOT_BRANCH=develop`. Atualizar o `.env` de prod (gerado no `deploy-main.yml` job `deploy-backend`) para incluir essas 3 variáveis.
- [ ] Trocar `logo-montana.png` pelo vetor/logo oficial; preencher placeholders de imagem do handoff (home/sobre).
- [ ] Implementar menu mobile (o handoff só esconde links < 860px) — opcional pós-MVP.

---

## Self-Review (preenchido)

**Spec coverage:**
- Publicar manual → Task 4/5/6 ✓
- Snapshot imutável → Task 2 ✓; commit no repo via GitHub API → Task 3 ✓
- repository_dispatch → Task 3/4 ✓; workflow → Task 13 ✓
- SSG reusando React → Task 8/9/10/11 ✓
- Segundo site Firebase + domínio → Task 12/14 ✓
- "Entrar" → login admin → Task 9 (SiteNav) ✓
- Estados sem sorteio → Task 8 ✓
- Escala (categorias, `<details>`) → Task 9 ✓ (busca/filtro/lazy-render JS: ver Gap abaixo)
- Migração `site_publicado_em` → Task 1 ✓
- Testes backend + SSG → Tasks 2/3/4/8/9 ✓

**Gaps conscientes (YAGNI no MVP, documentados):**
- Busca/filtro client-side e lazy-render via `<template>` (handoff, p/ eventos 60+ modalidades) **não** estão no MVP — o acordeão `<details>` fechado já mantém a página utilizável. Adicionar depois se houver evento grande real. (Marcar como melhoria futura.)
- Menu mobile: item de checklist pós-MVP.

**Type consistency:** `SnapEvento`/`SnapModalidade` idênticos entre backend (Task 2) e frontend (Task 7). `montaSnapshot` input bate com o que `site-publico.service` monta (Task 4). Componentes recebem `modalidade: SnapModalidade` (Task 8/9). `resultado` casteado para os tipos do frontend (`GruposResultado`/`ChavesResultado`/`OrdemResultado`) nos componentes existentes.

**Pontos a confirmar no início da execução (não placeholders — verificações):**
1. `applyAnfitriaoRule` está exportado e com a assinatura por-objeto (sorteios.service.ts).
2. Nome/caminho real do Tailwind config e dos arquivos de tokens no frontend; versão do Tailwind (v3 vs v4) — ajustar Task 11.
3. Existência de `composeSubtituloLine` no backend (senão portar — Task 4).
4. Onde ficam as ações por evento no admin (EventosList vs EventoForm) — Task 6.
5. `eventos.routes.ts` já define `admin` array — Task 5.
