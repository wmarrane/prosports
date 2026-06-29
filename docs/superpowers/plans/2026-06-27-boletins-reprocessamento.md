# Boletins — classificação por data+hora + reprocessamento (substituir) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Classificar o "Último boletim" (e a ordem das listas) por um carimbo real de publicação/processamento (`atualizado_em`), e permitir **reprocessar (substituir)** um boletim existente (mesmo número), trazendo-o de volta ao topo.

**Architecture:** Novo campo `atualizado_em @updatedAt` no `Boletim`; endpoint `PUT` para substituir (PDF opcional + campos); snapshot carrega `atualizadoEm`; público e admin ordenam por `atualizado_em` desc (desempate `numero` desc). Telas seguem exibindo só a data editorial.

**Tech Stack:** Node/Express/Prisma/Postgres/Vitest; React 18 + Vite + TS; SSG; lucide-react.

**Spec:** `docs/superpowers/specs/2026-06-27-boletins-reprocessamento-design.md`

## Global Constraints

- Carimbo de classificação = `Boletim.atualizado_em` (`@updatedAt`). Ordenação público+admin: `atualizado_em` desc, desempate `numero` desc. Telas exibem só a **data** (`data_publicacao`) via `dataPtBr` (UTC).
- Reprocessar = **substituir o mesmo boletim** (número fixo). PDF **opcional**. Pelo menos um de {file, titulo, categoria, data_publicacao} deve vir.
- Categorias (enum): `Oficial, Regulamento, Resultados, Convocacao, ComunicadoErrata`.
- Rotas boletins montadas em `/eventos` (router usa paths `/:eventoId/boletins...`). ADMIN-only (`requireAuth`+`requireRole('ADMIN')`).
- Host Windows; ler antes de editar; caminhos absolutos com `git -C`. Git identity inline (`-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`). Dev: poucos boletins; prod: feature não deployada. Abortar migration se Prisma propor reset destrutivo. Não pushar (controller faz commit local; o controlador do SDD cuida do merge).
- Verificar: backend `npx vitest run` + `npx tsc --noEmit`; frontend `npm run build` e `npm run build:site`.

---

### Task 1: Prisma — campo `atualizado_em`

**Files:**
- Modify: `backend/prisma/schema.prisma` (model `Boletim`)
- Create (gerado): `backend/prisma/migrations/<ts>_boletim_atualizado_em/migration.sql`

**Interfaces:**
- Produces: `Boletim.atualizado_em: DateTime` (auto via `@updatedAt`).

- [ ] **Step 1: Adicionar o campo**

Em `backend/prisma/schema.prisma`, no model `Boletim`, após `criado_em DateTime @default(now())`, adicionar:
```prisma
  atualizado_em   DateTime         @updatedAt
```

- [ ] **Step 2: Gerar a migration**

Run: `cd backend && npx prisma migrate dev --name boletim_atualizado_em`
Expected: aplica sem reset; `migration.sql` faz `ALTER TABLE "Boletim" ADD COLUMN "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP` (Prisma adiciona com default para linhas existentes). NÃO deve conter `DROP TABLE`. Se propuser reset → abortar e reportar BLOCKED.

- [ ] **Step 3: Typecheck**

Run: `cd backend && npx tsc --noEmit && npx vitest run src/modules/boletins`
Expected: sem erros; testes existentes passam (o client agora expõe `atualizado_em`).

- [ ] **Step 4: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add backend/prisma
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(boletins): campo atualizado_em (carimbo de publicacao/reprocessamento)"
```

---

### Task 2: Backend — substituir boletim (service + controller + rota)

**Files:**
- Modify: `backend/src/modules/boletins/boletins.service.ts`
- Modify: `backend/src/modules/boletins/boletins.controller.ts`
- Modify: `backend/src/modules/boletins/boletins.routes.ts`
- Modify: `backend/src/modules/boletins/boletins.service.test.ts`

**Interfaces:**
- Consumes: `getStorage()`, `publicar()` (já usados no módulo).
- Produces: `substituirBoletim(eventoId, boletimId, { titulo?, categoria?, data_publicacao?, file? })`; rota `PUT /eventos/:eventoId/boletins/:boletimId`.

- [ ] **Step 1: Testes do service (substituir)**

Em `backend/src/modules/boletins/boletins.service.test.ts`, adicionar (os mocks de prisma/storage/publicar já existem no arquivo — reusar; o mock de `prisma.boletim` precisa de `update` e `findFirst`):
```ts
describe('substituirBoletim', () => {
  it('substitui com novo PDF: sobe novo, remove antigo, atualiza e re-publica se publicado', async () => {
    prismaMock.boletim.findFirst.mockResolvedValue({ id: 5, evento_id: 9, numero: 3, object_key: 'eventos/9/boletim-3-old.pdf' })
    prismaMock.boletim.update.mockResolvedValue({ id: 5, evento_id: 9, numero: 3 })
    prismaMock.evento.findUnique.mockResolvedValue({ id: 9, site_publicado_em: new Date() })
    const { substituirBoletim } = await import('./boletins.service')
    await substituirBoletim(9, 5, { titulo: 'Novo', file: { buffer: Buffer.from('x'), originalname: 'n.pdf', size: 2, mimetype: 'application/pdf' } as any })
    expect(putMock).toHaveBeenCalled()
    expect(removeMock).toHaveBeenCalledWith('eventos/9/boletim-3-old.pdf')
    expect(prismaMock.boletim.update).toHaveBeenCalled()
    expect(publicarMock).toHaveBeenCalledWith(9)
  })
  it('substitui só campos (sem arquivo): não mexe no storage', async () => {
    prismaMock.boletim.findFirst.mockResolvedValue({ id: 5, evento_id: 9, numero: 3, object_key: 'k' })
    prismaMock.boletim.update.mockResolvedValue({ id: 5 })
    prismaMock.evento.findUnique.mockResolvedValue({ id: 9, site_publicado_em: null })
    const { substituirBoletim } = await import('./boletins.service')
    await substituirBoletim(9, 5, { titulo: 'Corrigido' })
    expect(putMock).not.toHaveBeenCalled()
    expect(removeMock).not.toHaveBeenCalled()
    expect(publicarMock).not.toHaveBeenCalled()
  })
  it('404 se o boletim não existe', async () => {
    prismaMock.boletim.findFirst.mockResolvedValue(null)
    const { substituirBoletim } = await import('./boletins.service')
    await expect(substituirBoletim(9, 999, { titulo: 'x' })).rejects.toMatchObject({ status: 404 })
  })
})
```
Garantir que o mock de `prisma.boletim` no topo do arquivo inclua `update: vi.fn()` e `findFirst: vi.fn()` (adicionar se faltar).

- [ ] **Step 2: Rodar (deve falhar)**

Run: `cd backend && npx vitest run src/modules/boletins/boletins.service.test.ts`
Expected: FAIL (`substituirBoletim` não existe).

- [ ] **Step 3: Implementar `substituirBoletim`**

Em `backend/src/modules/boletins/boletins.service.ts`, adicionar:
```ts
type SubstituirInput = {
  titulo?: string
  categoria?: CategoriaBoletim
  data_publicacao?: Date
  file?: { buffer: Buffer; originalname: string; size: number; mimetype: string }
}

export async function substituirBoletim(eventoId: number, boletimId: number, input: SubstituirInput) {
  const boletim = await prisma.boletim.findFirst({ where: { id: boletimId, evento_id: eventoId } })
  if (!boletim) throw Object.assign(new Error('Boletim não encontrado'), { status: 404 })

  const data: Record<string, unknown> = {}
  if (input.titulo !== undefined) data.titulo = input.titulo
  if (input.categoria !== undefined) data.categoria = input.categoria
  if (input.data_publicacao !== undefined) data.data_publicacao = input.data_publicacao

  let novoObjectKey: string | null = null
  if (input.file) {
    novoObjectKey = `eventos/${eventoId}/boletim-${boletim.numero}-${randomUUID()}.pdf`
    const url = await getStorage().put(novoObjectKey, input.file.buffer, 'application/pdf')
    data.object_key = novoObjectKey
    data.public_url = url
    data.filename = input.file.originalname
    data.size_bytes = input.file.size
  }

  try {
    const atualizado = await prisma.boletim.update({ where: { id: boletim.id }, data })
    if (input.file) { try { await getStorage().remove(boletim.object_key) } catch { /* ignore */ } }
    await republicarSePublicado(eventoId)
    return atualizado
  } catch (err) {
    if (novoObjectKey) { try { await getStorage().remove(novoObjectKey) } catch { /* ignore */ } }
    throw err
  }
}
```

- [ ] **Step 4: Controller `substituir`**

Em `backend/src/modules/boletins/boletins.controller.ts`, adicionar:
```ts
const substituirSchema = z.object({
  titulo: z.string().min(1).optional(),
  categoria: z.enum(CATEGORIAS).optional(),
  data_publicacao: z.coerce.date().optional(),
})

export async function substituir(req: Request, res: Response, next: NextFunction) {
  try {
    const eventoId = parseIntParam(req.params.eventoId, 'eventoId')
    const boletimId = parseIntParam(req.params.boletimId, 'boletimId')
    const file = (req as any).file as Express.Multer.File | undefined
    const body = substituirSchema.parse(req.body)
    if (!file && body.titulo === undefined && body.categoria === undefined && body.data_publicacao === undefined) {
      res.status(400).json({ message: 'Nada para atualizar.' }); return
    }
    const boletim = await service.substituirBoletim(eventoId, boletimId, { ...body, file })
    res.json(boletim)
  } catch (err) { next(err) }
}
```

- [ ] **Step 5: Rota PUT**

Em `backend/src/modules/boletins/boletins.routes.ts`, após a linha do `delete`, adicionar:
```ts
router.put('/:eventoId/boletins/:boletimId', ...admin, uploadPdf.single('file'), ctrl.substituir)
```

- [ ] **Step 6: Rodar (deve passar) + suite + tsc**

Run: `cd backend && npx vitest run src/modules/boletins && npx tsc --noEmit`
Expected: PASS; sem erros.

- [ ] **Step 7: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add backend/src/modules/boletins
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(boletins): endpoint PUT para substituir/reprocessar boletim (PDF opcional)"
```

---

### Task 3: Snapshot — `atualizadoEm`

**Files:**
- Modify: `backend/src/modules/site-publico/snapshot-types.ts`
- Modify: `frontend/src/site-publico/snapshot-types.ts`
- Modify: `backend/src/modules/site-publico/snapshot.ts`
- Modify: `backend/src/modules/site-publico/site-publico.service.ts`
- Modify: `backend/src/modules/site-publico/snapshot.test.ts`

**Interfaces:**
- Produces: `SnapEvento.boletins[]` ganha `atualizadoEm: string`.

- [ ] **Step 1: Tipos (backend + frontend)**

Nos dois `snapshot-types.ts`, no `boletins` de `SnapEvento`, adicionar `atualizadoEm: string`:
```ts
boletins: { numero: number; titulo: string; categoria: string; data: string; url: string; tamanho: number; atualizadoEm: string }[]
```

- [ ] **Step 2: Teste do snapshot**

Em `backend/src/modules/site-publico/snapshot.test.ts`, no boletim do input adicionar `atualizado_em` e asserir o mapeamento. Nos dois boletins do input do teste "inclui boletins...", adicionar `atualizado_em: new Date('2026-07-02T10:00:00Z')` (no de numero 2) e `atualizado_em: new Date('2026-07-01T10:00:00Z')` (no de numero 1); e adicionar a asserção:
```ts
expect(snap.boletins[0]).toMatchObject({ titulo: 'B1', tamanho: 1024, atualizadoEm: '2026-07-01T10:00:00.000Z' })
```

- [ ] **Step 3: Rodar (deve falhar)**

Run: `cd backend && npx vitest run src/modules/site-publico/snapshot.test.ts`
Expected: FAIL (`atualizadoEm` undefined).

- [ ] **Step 4: montaSnapshot + select**

Em `backend/src/modules/site-publico/snapshot.ts`: no type `EventoRow.boletins`, adicionar `atualizado_em: Date`; no `.map(b => ({...}))` dos boletins, adicionar `atualizadoEm: b.atualizado_em.toISOString()`.

Em `backend/src/modules/site-publico/site-publico.service.ts`, no `select` de `boletins`, adicionar `atualizado_em: true`.

- [ ] **Step 5: Rodar (deve passar) + tsc + build frontend**

Run: `cd backend && npx vitest run src/modules/site-publico/snapshot.test.ts && npx tsc --noEmit`
Run: `cd frontend && npm run build`
Expected: PASS; sem erros.

- [ ] **Step 6: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add backend/src/modules/site-publico frontend/src/site-publico/snapshot-types.ts
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(site-publico): snapshot inclui atualizadoEm do boletim"
```

---

### Task 4: Frontend service — `substituir` + tipo

**Files:**
- Modify: `frontend/src/services/boletins.ts`

**Interfaces:**
- Produces: `boletinsService.substituir(eventoId, boletimId, { titulo?, categoria?, data_publicacao?, file? })`; tipo `Boletim` ganha `atualizado_em: string`.

- [ ] **Step 1: Atualizar o service**

Em `frontend/src/services/boletins.ts`:
- No tipo `Boletim`, adicionar `atualizado_em: string` (após `criado_em: string`).
- Adicionar ao objeto `boletinsService` (após `remover`):
```ts
  substituir: (eventoId: number, boletimId: number, payload: { titulo?: string; categoria?: string; data_publicacao?: string; file?: File }) => {
    const fd = new FormData()
    if (payload.file) fd.append('file', payload.file)
    if (payload.titulo !== undefined) fd.append('titulo', payload.titulo)
    if (payload.categoria !== undefined) fd.append('categoria', payload.categoria)
    if (payload.data_publicacao !== undefined) fd.append('data_publicacao', payload.data_publicacao)
    return api.put<Boletim>(`${BASE(eventoId)}/${boletimId}`, fd).then(r => r.data)
  },
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc -b`
Expected: sem erros.

- [ ] **Step 3: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/services/boletins.ts
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(boletins): service substituir + tipo atualizado_em (admin)"
```

---

### Task 5: Admin — ação "Substituir" + ordenação por atualizado_em

**Files:**
- Modify: `frontend/src/pages/eventos/EventoBoletins.tsx`

**Interfaces:**
- Consumes: `boletinsService.substituir`, `Boletim.atualizado_em`.

- [ ] **Step 1: Generalizar o modal e adicionar "Substituir"**

Substituir o conteúdo de `frontend/src/pages/eventos/EventoBoletins.tsx` por (mantém o visual; adiciona modo substituir + ordenação):
```tsx
import { useEffect, useRef, useState } from 'react'
import { FileText, Plus, Download, MoreHorizontal, X, Check, ChevronDown, Upload, Lock, Trash2, RefreshCw } from 'lucide-react'
import { boletinsService, type Boletim } from '../../services/boletins'
import { CATEGORIAS_BOLETIM, categoriaInfo, formatBytes, dataPtBr } from '../../lib/boletim-categorias'

export default function EventoBoletins({ eventoId, eventoNome }: { eventoId: number; eventoNome?: string }) {
  const [docs, setDocs] = useState<Boletim[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Boletim | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [kebab, setKebab] = useState<number | null>(null)

  async function load() { setDocs(await boletinsService.listar(eventoId)) }
  useEffect(() => { load().catch(() => {}) }, [eventoId])
  useEffect(() => {
    const close = () => setKebab(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2600) }

  async function onRemove(id: number) {
    setKebab(null)
    if (!confirm('Remover este boletim?')) return
    try { await boletinsService.remover(eventoId, id); await load() } catch { showToast('Falha ao remover') }
  }

  // mais recentemente publicado/reprocessado no topo
  const ordenados = [...docs].sort((a, b) => (+new Date(b.atualizado_em) - +new Date(a.atualizado_em)) || (b.numero - a.numero))

  function abrirPublicar() { setEditing(null); setModalOpen(true) }
  function abrirSubstituir(b: Boletim) { setKebab(null); setEditing(b); setModalOpen(true) }

  return (
    <div className="card" style={{ padding: 24, marginTop: 24 }}>
      <div className="bol-head">
        <div className="ic-tile"><FileText size={21} /></div>
        <div>
          <div className="eyebrow">Documentos do evento</div>
          <h3 className="sec-title" style={{ fontSize: 19 }}>Boletins</h3>
          <div className="count">{docs.length} publicado{docs.length === 1 ? '' : 's'}{eventoNome ? ` — ${eventoNome}` : ''}</div>
        </div>
        <div className="spacer" />
        <button className="btn btn-primary pub-btn" onClick={abrirPublicar}><Plus size={18} /> Publicar boletim</button>
      </div>

      {ordenados.length === 0 ? (
        <div className="bol-empty">
          <FileText size={28} />
          <div>Nenhum boletim publicado</div>
          <button className="btn btn-primary" onClick={abrirPublicar}><Plus size={18} /> Publicar primeiro boletim</button>
        </div>
      ) : (
        <div className="bol-list">
          {ordenados.map((d) => {
            const info = categoriaInfo(d.categoria)
            return (
              <div className="bol-row" key={d.id}>
                <div className="pdf"><FileText size={16} /></div>
                <div className="body">
                  <div className="num">Nº {String(d.numero).padStart(3, '0')}</div>
                  <div className="ttl">{d.titulo}</div>
                  <div className="meta">
                    <span className={`badge ${info.badgeClass}`}>{info.label}</span>
                    <span className="sep" />{dataPtBr(d.data_publicacao)}
                    <span className="sep" />{formatBytes(d.size_bytes)}
                  </div>
                </div>
                <div className="right">
                  <div className="acts" onClick={(e) => e.stopPropagation()}>
                    <a className="ibtn-sm" href={d.public_url} target="_blank" rel="noopener noreferrer" title="Baixar"><Download size={17} /></a>
                    <button className="ibtn-sm" title="Mais" onClick={() => setKebab(kebab === d.id ? null : d.id)}><MoreHorizontal size={17} /></button>
                    {kebab === d.id && (
                      <div className="kebab-menu">
                        <button onClick={() => abrirSubstituir(d)}><RefreshCw size={15} /> Substituir</button>
                        <button onClick={() => onRemove(d.id)}><Trash2 size={15} /> Remover</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalOpen && (
        <BoletimModal
          eventoId={eventoId}
          eventoNome={eventoNome}
          boletim={editing}
          onClose={() => setModalOpen(false)}
          onDone={async (msg) => { setModalOpen(false); await load(); showToast(msg) }}
        />
      )}

      {toast && (
        <div className="toast show"><span className="tk"><Check size={14} /></span> {toast}</div>
      )}
    </div>
  )
}

function BoletimModal({ eventoId, eventoNome, boletim, onClose, onDone }: {
  eventoId: number; eventoNome?: string; boletim: Boletim | null; onClose: () => void; onDone: (msg: string) => void
}) {
  const isEdit = boletim != null
  const [numero, setNumero] = useState(boletim ? String(boletim.numero) : '')
  const [titulo, setTitulo] = useState(boletim?.titulo ?? '')
  const [categoria, setCategoria] = useState(boletim?.categoria ?? CATEGORIAS_BOLETIM[0].value)
  const [data, setData] = useState(boletim ? boletim.data_publicacao.slice(0, 10) : '')
  const [file, setFile] = useState<File | null>(null)
  const [typeOpen, setTypeOpen] = useState(false)
  const [drag, setDrag] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const info = categoriaInfo(categoria)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  useEffect(() => {
    if (!typeOpen) return
    const close = () => setTypeOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [typeOpen])

  function pick(f: File | null) {
    if (!f) return
    if (f.type !== 'application/pdf') { setErro('Apenas arquivos PDF.'); return }
    setErro(null); setFile(f)
  }

  async function salvar() {
    if (!titulo || !data) { setErro('Preencha título e data.'); return }
    if (!isEdit && (!file || !numero)) { setErro('Preencha número e arquivo.'); return }
    setLoading(true); setErro(null)
    try {
      if (isEdit) {
        await boletinsService.substituir(eventoId, boletim!.id, { titulo, categoria, data_publicacao: data, file: file ?? undefined })
        onDone('Boletim atualizado')
      } else {
        await boletinsService.enviar(eventoId, { numero: Number(numero), titulo, categoria, data_publicacao: data, file: file! })
        onDone('Boletim publicado')
      }
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Falha ao salvar')
    } finally { setLoading(false) }
  }

  return (
    <div className="overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="mh">
          <div className="mi"><FileText size={20} /></div>
          <div style={{ flex: 1 }}>
            <h3 className="sec-title" style={{ fontSize: 16 }}>{isEdit ? 'Substituir boletim' : 'Publicar boletim'}</h3>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{eventoNome ?? ''}</div>
          </div>
          <button className="ibtn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="mb">
          <div className="grid-num-title">
            <div className="field"><label>Número {!isEdit && <span className="req">*</span>}</label>
              <input className="lg-input" value={numero} onChange={(e) => setNumero(e.target.value)} disabled={isEdit} />
            </div>
            <div className="field"><label>Título <span className="req">*</span></label><input className="lg-input" value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
          </div>
          <div className="grid-tipo-data">
            <div className="field">
              <label>Tipo <span className="req">*</span></label>
              <div className="fake-select" onClick={(e) => { e.stopPropagation(); setTypeOpen((v) => !v) }}>
                <span className="swatch" style={{ background: info.swatch }} />
                <span>{info.label}</span>
                <ChevronDown size={16} className="chev" />
                {typeOpen && (
                  <div className="type-menu" onClick={(e) => e.stopPropagation()}>
                    {CATEGORIAS_BOLETIM.map((c) => (
                      <button key={c.value} className="type-opt" onClick={() => { setCategoria(c.value); setTypeOpen(false) }}>
                        <span className="swatch" style={{ background: c.swatch }} /> {c.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="field"><label>Data <span className="req">*</span></label>
              <input className="lg-input" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>{isEdit ? 'Trocar PDF (opcional)' : <>Arquivo PDF <span className="req">*</span></>}</label>
            <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => pick(e.target.files?.[0] ?? null)} />
            {file ? (
              <div className="file-chip">
                <div className="pdf"><FileText size={14} /></div>
                <div><div className="name">{file.name}</div><div className="fmeta">{formatBytes(file.size)}</div></div>
                <button className="ibtn-sm x" onClick={() => setFile(null)}><X size={16} /></button>
              </div>
            ) : (
              <div
                className={`bol-drop${drag ? ' drag' : ''}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0] ?? null) }}
              >
                <div className="dz-ic"><Upload size={21} /></div>
                <div><div className="t">{isEdit ? 'Arraste um novo PDF ou mantenha o atual' : 'Arraste o PDF ou clique para selecionar'}</div><div className="s">Apenas .pdf · até 25 MB</div></div>
              </div>
            )}
          </div>
          {erro && <p style={{ color: 'var(--danger, crimson)', fontSize: 12, margin: 0 }}>{erro}</p>}
        </div>
        <div className="mf">
          <span className="hint"><Lock size={13} /> Registrado em auditoria</span>
          <span className="grow" />
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={loading} onClick={salvar}><Check size={16} /> {loading ? 'Salvando…' : (isEdit ? 'Salvar' : 'Publicar')}</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build**

Run: `cd frontend && npm run build`
Expected: `tsc -b && vite build` sem erros.

- [ ] **Step 3: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/pages/eventos/EventoBoletins.tsx
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(admin): acao Substituir no boletim + ordena por atualizado_em"
```

---

### Task 6: Público — classificar por `atualizadoEm` + teste

**Files:**
- Modify: `frontend/src/site-publico/pages/EventoPage.tsx`
- Modify: `frontend/src/site-publico/EventoPage-boletins.test.tsx`

**Interfaces:**
- Consumes: `evento.boletins[].atualizadoEm`.

- [ ] **Step 1: Atualizar o teste**

Em `frontend/src/site-publico/EventoPage-boletins.test.tsx`, no fixture `base.boletins`, adicionar `atualizadoEm` a cada boletim de forma que o de numero 1 seja o mais recente por timestamp (para validar que o destaque usa o timestamp, não a data nem o número). Trocar os dois boletins por:
```ts
  boletins: [
    { numero: 1, titulo: 'Abertura', categoria: 'Oficial', data: '2026-07-01T00:00:00.000Z', url: 'http://vm/1.pdf', tamanho: 2516582, atualizadoEm: '2026-07-05T12:00:00.000Z' },
    { numero: 2, titulo: 'Resultados R1', categoria: 'Resultados', data: '2026-07-02T00:00:00.000Z', url: 'http://vm/2.pdf', tamanho: 1258291, atualizadoEm: '2026-07-03T09:00:00.000Z' },
  ],
```
E ajustar a asserção do destaque para o numero 1 (mais recente por `atualizadoEm`):
```ts
it('destaque usa atualizadoEm (mais recente), não a data nem o número', () => {
  const html = renderToStaticMarkup(<EventoPage evento={base} />)
  expect(html).toContain('doc-feature')
  const featureIdx = html.indexOf('doc-feature')
  // o destaque (numero 1, Oficial) deve aparecer e seu url no bloco do destaque
  expect(html).toContain('http://vm/1.pdf')
  expect(html.slice(featureIdx, featureIdx + 600)).toContain('Abertura')
})
```
Manter o teste de seção omitida quando vazio.

- [ ] **Step 2: Rodar (deve falhar)**

Run: `cd frontend && npx vitest run src/site-publico/EventoPage-boletins.test.tsx`
Expected: FAIL (ordenação atual usa `data` → destaque seria numero 2).

- [ ] **Step 3: Trocar a ordenação no EventoPage**

Em `frontend/src/site-publico/pages/EventoPage.tsx`, na seção de boletins, trocar a linha de ordenação por:
```tsx
          const ordenados = [...boletins].sort((a, b) => (+new Date(b.atualizadoEm) - +new Date(a.atualizadoEm)) || (b.numero - a.numero))
```

- [ ] **Step 4: Rodar (deve passar) + builds**

Run: `cd frontend && npx vitest run src/site-publico && npm run build:site && npm run build`
Expected: PASS; ambos os builds sem erro.

- [ ] **Step 5: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/site-publico/pages/EventoPage.tsx frontend/src/site-publico/EventoPage-boletins.test.tsx
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(site-publico): ultimo boletim por atualizadoEm (data+hora real)"
```

---

### Task 7: Verificação integrada + demonstração

**Files:** nenhum.

- [ ] **Step 1: Suites e builds**

Run: `cd backend && npx vitest run && npx tsc --noEmit`
Run: `cd frontend && npm run build && npm run build:site`
Expected: tudo verde.

- [ ] **Step 2: Demonstração (screenshots/walkthrough)**

No dev (após deploy): publicar boletins A e B com a mesma data → B (mais novo) é o destaque. Usar **Substituir** em A (trocar PDF) → A volta a ser o "Último boletim". Capturar screenshots do admin (kebab com "Substituir" + modal em modo substituir) e do público (destaque mudando após o reprocessamento). Entregar ao Wagner antes do merge na develop.

---

## Notas finais
- Telas exibem só a data; `atualizado_em` é só para classificação. Promoção `develop → main` só com confirmação do Wagner.
