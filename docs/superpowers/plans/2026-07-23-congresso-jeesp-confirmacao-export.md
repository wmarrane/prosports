# Congresso Técnico (Excel) — formato de confirmação JEESP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans. Steps usam checkbox (`- [ ]`).

**Goal:** Para eventos escolares/JEESP (`competicao.subtitulo_municipio_por_modalidade === true`), o relatório "Congresso Técnico (Excel)" passa a gerar uma planilha plana de confirmação (formato do modelo `personaladmin/reports/congresso_jeesp.xlsx`), com valores legados coletados num form no export; eventos não‑escolar seguem com o relatório atual.

**Architecture:** Novo service backend isolado (`relatorio_confirmacao_jeesp.service.ts`) que monta a aba `Planilha1` (dados a partir da linha 3), uma linha por inscrição + uma "Cidade Sede" por modalidade, com a coluna J como fórmula Excel de `insert into confirmacao`. O controller de relatórios ramifica pelo toggle escolar; o frontend abre um modal para os valores legados nos eventos escolares.

**Tech Stack:** Express, Prisma, ExcelJS, Zod, Vitest (mock-based); React + Vite.

## Global Constraints

- Host Windows; ler antes de editar; caminhos absolutos; git identity inline (`-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`); nunca `git add -A`.
- Backend: `cd backend && npx tsc --noEmit && npx vitest run src/modules/relatorios`. Frontend: `cd frontend && npm run build`.
- **Detecção JEESP** = `evento.competicao.subtitulo_municipio_por_modalidade === true`. **Não‑escolar = inalterado** (regressão zero): controller continua chamando `gerarCongressoXlsx`.
- Valores legados **via form no export** (query params); não persistem. Coluna A = sequencial cosmético (não entra no SQL). CodMunicipioSede = valor único do form. Linha "Cidade Sede" = uma por modalidade. D = `modalidade.nome`; CodModalidade default `0`.
- Sem schema/migration novos.

---

### Task 1: Backend — service `gerarConfirmacaoJeespXlsx` + teste

**Files:**
- Create: `backend/src/modules/relatorios/relatorio_confirmacao_jeesp.service.ts`
- Create: `backend/src/modules/relatorios/relatorio_confirmacao_jeesp.service.test.ts`

**Interfaces:**
- Produces:
  - `type ConfirmacaoJeespParams = { codCompeticao: number; competicao: string; divisao: string; codMunicipioSede: number; municipioSede: string; codModalidade: number }`
  - `gerarConfirmacaoJeespXlsx(evento_id: number, params: ConfirmacaoJeespParams): Promise<Buffer>`
  - `nomeArquivoConfirmacao(evento: { nome: string; id: number }): string`

- [ ] **Step 1: Escrever o teste que falha** — criar `backend/src/modules/relatorios/relatorio_confirmacao_jeesp.service.test.ts`:

```ts
import { it, expect, vi, beforeEach } from 'vitest'
import ExcelJS from 'exceljs'

vi.mock('../../lib/prisma', () => ({
  default: {
    evento: { findUnique: vi.fn() },
    modalidade: { findMany: vi.fn() },
    inscricao: { findMany: vi.fn() },
    eventoModalidadeExcluida: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

import prisma from '../../lib/prisma'
import { gerarConfirmacaoJeespXlsx } from './relatorio_confirmacao_jeesp.service'

const p = prisma as any
const params = {
  codCompeticao: 3, competicao: 'Jogos Escolares', divisao: '2ª Divisão',
  codMunicipioSede: 879, municipioSede: 'Praia Grande', codModalidade: 0,
}

beforeEach(() => vi.clearAllMocks())

it('gera planilha (dados na linha 3, valores do form, Cidade Sede por modalidade, formula em J)', async () => {
  p.evento.findUnique.mockResolvedValue({ competicao_id: 7 })
  p.modalidade.findMany.mockResolvedValue([
    { id: 10, nome: 'Xadrez (I) Masculino(a) Infantil' },
    { id: 11, nome: 'Vazia' },
  ])
  p.inscricao.findMany.mockResolvedValue([
    { modalidade_id: 10, participante: { nome: 'DREL Araçatuba' } },
    { modalidade_id: 10, participante: { nome: 'DREL Bauru' } },
  ])

  const buf = await gerarConfirmacaoJeespXlsx(1, params)
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as any)
  const ws = wb.getWorksheet('Planilha1')!

  expect(ws.getCell('B1').value).toBeFalsy()
  expect(ws.getCell('B2').value).toBeFalsy()
  expect(ws.getCell('B3').value).toBe('DREL Araçatuba')
  expect(ws.getCell('D3').value).toBe('Xadrez (I) Masculino(a) Infantil')
  expect(ws.getCell('C3').value).toBe(0)
  expect(ws.getCell('E3').value).toBe(3)
  expect(ws.getCell('F3').value).toBe('Jogos Escolares')
  expect(ws.getCell('G3').value).toBe('2ª Divisão')
  expect(ws.getCell('H3').value).toBe(879)
  expect(ws.getCell('I3').value).toBe('Praia Grande')
  const j3 = ws.getCell('J3').value as any
  expect(j3.formula).toContain('insert into confirmacao')
  expect(j3.formula).toContain('B3')
  // 2 inscritos (linhas 3,4) + Cidade Sede (linha 5); modalidade 'Vazia' ignorada
  expect(ws.getCell('B5').value).toBe('Cidade Sede')
  expect(ws.getCell('B6').value).toBeFalsy()
})

it('modalidade sem inscritos é ignorada (sem linha Cidade Sede)', async () => {
  p.evento.findUnique.mockResolvedValue({ competicao_id: 7 })
  p.modalidade.findMany.mockResolvedValue([{ id: 11, nome: 'Vazia' }])
  p.inscricao.findMany.mockResolvedValue([])
  const buf = await gerarConfirmacaoJeespXlsx(1, params)
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as any)
  const ws = wb.getWorksheet('Planilha1')!
  expect(ws.getCell('B3').value).toBeFalsy()
})
```

- [ ] **Step 2: Rodar e ver falhar** — `cd backend && npx vitest run src/modules/relatorios/relatorio_confirmacao_jeesp.service.test.ts`
  Esperado: FALHA (módulo `./relatorio_confirmacao_jeesp.service` não existe).

- [ ] **Step 3: Implementar o service** — criar `backend/src/modules/relatorios/relatorio_confirmacao_jeesp.service.ts`:

```ts
import ExcelJS from 'exceljs'
import prisma from '../../lib/prisma'
import { getModalidadeIdsExcluidas } from '../eventos/evento-modalidades.service'
import { sheetSafe } from '../../lib/sheet-safe'

export type ConfirmacaoJeespParams = {
  codCompeticao: number
  competicao: string
  divisao: string
  codMunicipioSede: number
  municipioSede: string
  codModalidade: number
}

export function nomeArquivoConfirmacao(evento: { nome: string; id: number }): string {
  const slug = evento.nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
  return `Confirmacao_${slug || `evento_${evento.id}`}.xlsx`
}

export async function gerarConfirmacaoJeespXlsx(
  evento_id: number,
  params: ConfirmacaoJeespParams,
): Promise<Buffer> {
  const evento = await prisma.evento.findUnique({
    where: { id: evento_id },
    select: { competicao_id: true },
  })
  if (!evento) throw Object.assign(new Error('Evento não encontrado'), { status: 404 })

  const excluidasIds = await getModalidadeIdsExcluidas(evento_id)
  const modalidades = (await prisma.modalidade.findMany({
    where: { competicao_id: evento.competicao_id, ativa: true },
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
  })).filter(m => !excluidasIds.has(m.id))

  const inscricoes = await prisma.inscricao.findMany({
    where: { evento_id },
    select: { modalidade_id: true, participante: { select: { nome: true } } },
    orderBy: { participante: { nome: 'asc' } },
  })
  const porModalidade = new Map<number, string[]>()
  for (const i of inscricoes) {
    const arr = porModalidade.get(i.modalidade_id) ?? []
    arr.push(i.participante?.nome ?? '—')
    porModalidade.set(i.modalidade_id, arr)
  }

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Planilha1')

  let row = 3 // dados começam na linha 3 (linhas 1-2 em branco, como no modelo)
  const escreveLinha = (municipio: string, modalidadeNome: string) => {
    ws.getCell(`A${row}`).value = row - 2 // sequencial cosmético (não usado no SQL)
    ws.getCell(`B${row}`).value = sheetSafe(municipio)
    ws.getCell(`C${row}`).value = params.codModalidade
    ws.getCell(`D${row}`).value = sheetSafe(modalidadeNome)
    ws.getCell(`E${row}`).value = params.codCompeticao
    ws.getCell(`F${row}`).value = sheetSafe(params.competicao)
    ws.getCell(`G${row}`).value = sheetSafe(params.divisao)
    ws.getCell(`H${row}`).value = params.codMunicipioSede
    ws.getCell(`I${row}`).value = sheetSafe(params.municipioSede)
    ws.getCell(`J${row}`).value = {
      formula:
        `"insert into confirmacao (Municipio, CodModalidade, Modalidade, CodCompeticao, Competicao, Divisao, CodMunicipioSede, MunicipioSede)\n` +
        `values ('"&B${row}&"',"&$C${row}&",'"&$D${row}&"',"&$E${row}&",'"&$F${row}&"','"&$G${row}&"',"&$H${row}&",'"&$I${row}&"')"`,
    }
    row++
  }

  for (const m of modalidades) {
    const insc = porModalidade.get(m.id) ?? []
    if (insc.length === 0) continue
    for (const nome of insc) escreveLinha(nome, m.nome)
    escreveLinha('Cidade Sede', m.nome)
  }

  ws.getColumn(10).width = 90 // J: fórmula longa

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}
```

- [ ] **Step 4: Rodar e ver passar** — `cd backend && npx vitest run src/modules/relatorios/relatorio_confirmacao_jeesp.service.test.ts`
  Esperado: 2 testes PASS.

- [ ] **Step 5: Commit**
```bash
git add backend/src/modules/relatorios/relatorio_confirmacao_jeesp.service.ts backend/src/modules/relatorios/relatorio_confirmacao_jeesp.service.test.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(jeesp): service gera planilha de confirmacao (insert into confirmacao)"
```

---

### Task 2: Backend — controller ramifica pelo toggle escolar + params do form

**Files:**
- Modify: `backend/src/modules/relatorios/relatorios.controller.ts` (função `congresso`)

**Interfaces:**
- Consumes: `gerarConfirmacaoJeespXlsx`, `nomeArquivoConfirmacao`, `ConfirmacaoJeespParams` (Task 1); `gerarCongressoXlsx`, `nomeArquivo` (já existem).

- [ ] **Step 1: Reescrever o controller** — substituir o conteúdo de `backend/src/modules/relatorios/relatorios.controller.ts` por:

```ts
import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import prisma from '../../lib/prisma'
import { parseIntParam } from '../../lib/parse-id'
import { gerarCongressoXlsx, nomeArquivo } from './relatorio_congresso.service'
import { gerarConfirmacaoJeespXlsx, nomeArquivoConfirmacao } from './relatorio_confirmacao_jeesp.service'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const jeespParamsSchema = z.object({
  codCompeticao: z.coerce.number().int(),
  competicao: z.string().min(1).max(120),
  divisao: z.string().max(120).default(''),
  codMunicipioSede: z.coerce.number().int(),
  municipioSede: z.string().min(1).max(120),
  codModalidade: z.coerce.number().int().default(0),
})

export async function congresso(req: Request, res: Response, next: NextFunction) {
  try {
    const eventoId = parseIntParam(req.params.eventoId, 'eventoId')
    const evento = await prisma.evento.findUnique({
      where: { id: eventoId },
      select: { id: true, nome: true, competicao: { select: { subtitulo_municipio_por_modalidade: true } } },
    })
    if (!evento) {
      res.status(404).json({ message: 'Evento não encontrado' })
      return
    }

    const escolar = evento.competicao?.subtitulo_municipio_por_modalidade === true
    let buf: Buffer
    let filename: string
    if (escolar) {
      const params = jeespParamsSchema.parse(req.query)
      buf = await gerarConfirmacaoJeespXlsx(eventoId, params)
      filename = nomeArquivoConfirmacao(evento)
    } else {
      buf = await gerarCongressoXlsx(eventoId)
      filename = nomeArquivo(evento)
    }

    res.setHeader('Content-Type', XLSX_MIME)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buf)
  } catch (err) {
    next(err)
  }
}
```

- [ ] **Step 2: Verificar** — `cd backend && npx tsc --noEmit && npx vitest run src/modules/relatorios`
  Esperado: tsc sem erros; testes de relatórios (congresso + confirmação) verdes. (O teste atual de `gerarCongressoXlsx` não usa o controller, então segue passando.)

- [ ] **Step 3: Commit**
```bash
git add backend/src/modules/relatorios/relatorios.controller.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(jeesp): controller de relatorio ramifica p/ confirmacao no evento escolar"
```

---

### Task 3: Frontend — modal de valores legados + params no service

**Files:**
- Modify: `frontend/src/services/relatorios.ts` (`congresso` aceita params)
- Modify: `frontend/src/pages/RelatorioCongresso.tsx` (modal quando escolar)

**Interfaces:**
- Consumes: endpoint `GET /relatorios/eventos/:id/congresso?codCompeticao=&competicao=&divisao=&codMunicipioSede=&municipioSede=&codModalidade=` (Task 2).
- Produces: `relatoriosService.congresso(eventoId, params?)`.

- [ ] **Step 1: Service aceita params** — em `frontend/src/services/relatorios.ts`, substituir a função `congresso` por:

```ts
  congresso: async (
    eventoId: number,
    params?: Record<string, string | number>,
  ): Promise<{ blob: Blob; filename: string }> => {
    const r = await api.get(`/relatorios/eventos/${eventoId}/congresso`, {
      params,
      responseType: 'blob',
    })
    return {
      blob: r.data,
      filename: extractFilename(r.headers['content-disposition'], `Congresso_evento_${eventoId}.xlsx`),
    }
  },
```

- [ ] **Step 2: Detectar escolar e abrir modal** — em `frontend/src/pages/RelatorioCongresso.tsx`:

  (a) Adicionar estado do modal e dos campos, logo após `const [baixando, setBaixando] = useState(false)` (linha 22):
```tsx
  const [modalJeesp, setModalJeesp] = useState(false)
  const [fCompeticao, setFCompeticao] = useState('Jogos Escolares')
  const [fCodCompeticao, setFCodCompeticao] = useState('')
  const [fDivisao, setFDivisao] = useState('')
  const [fMunicipioSede, setFMunicipioSede] = useState('')
  const [fCodMunicipioSede, setFCodMunicipioSede] = useState('')
  const [fCodModalidade, setFCodModalidade] = useState('0')
```

  (b) Logo após `const selecionado = eventos.find((e) => e.id === eventoId)` (linha 63), derivar o flag:
```tsx
  const escolar = (selecionado?.competicao as any)?.subtitulo_municipio_por_modalidade === true
```

  (c) Trocar a função `baixar` (linhas 29-61) para: se escolar, abrir o modal com prefill; senão baixar direto. Substituir o `async function baixar()` inteiro por:
```tsx
  async function download(params?: Record<string, string | number>) {
    if (!eventoId) return
    setBaixando(true)
    try {
      const { blob, filename } = await relatoriosService.congresso(eventoId, params)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Relatório gerado.')
    } catch (e: any) {
      let msg = 'Erro ao gerar relatório.'
      const data = e?.response?.data
      if (data instanceof Blob) {
        try {
          const parsed = JSON.parse(await data.text())
          msg = parsed?.message ?? msg
        } catch {
          /* mantem default */
        }
      } else if (data?.message) {
        msg = data.message
      }
      toast.error(msg)
    } finally {
      setBaixando(false)
    }
  }

  function onClickBaixar() {
    if (!eventoId) return
    if (escolar) {
      setFMunicipioSede((selecionado as any)?.municipio?.nome ?? '')
      setModalJeesp(true)
      return
    }
    download()
  }

  function confirmarJeesp() {
    setModalJeesp(false)
    download({
      codCompeticao: fCodCompeticao,
      competicao: fCompeticao,
      divisao: fDivisao,
      codMunicipioSede: fCodMunicipioSede,
      municipioSede: fMunicipioSede,
      codModalidade: fCodModalidade,
    })
  }
```

  (d) Trocar o `onClick={baixar}` do botão (linha 138) por `onClick={onClickBaixar}`.

  (e) Adicionar o modal antes do fechamento do componente — logo antes da última linha `</div>` do return (após o bloco de "Notas", linha 161 `</div>` de fechamento do `.p-6`). Inserir:
```tsx
      {modalJeesp && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
          onClick={() => setModalJeesp(false)}
        >
          <div
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-xl)', padding: 24, width: '100%', maxWidth: 460, margin: '0 16px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="sec-title" style={{ fontSize: 17, marginBottom: 4 }}>Confirmação JEESP</h3>
            <p className="text-xs text-[var(--t3)]" style={{ marginBottom: 16 }}>
              Valores usados nas colunas fixas e no <code>insert into confirmacao</code>.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label className="text-sm text-[var(--t2)]" style={{ gridColumn: '1 / -1' }}>
                Competição
                <input value={fCompeticao} onChange={(e) => setFCompeticao(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm" />
              </label>
              <label className="text-sm text-[var(--t2)]">
                CodCompetição
                <input value={fCodCompeticao} onChange={(e) => setFCodCompeticao(e.target.value)} inputMode="numeric" className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm" />
              </label>
              <label className="text-sm text-[var(--t2)]">
                Divisão
                <input value={fDivisao} onChange={(e) => setFDivisao(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm" />
              </label>
              <label className="text-sm text-[var(--t2)]">
                Município Sede
                <input value={fMunicipioSede} onChange={(e) => setFMunicipioSede(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm" />
              </label>
              <label className="text-sm text-[var(--t2)]">
                CodMunicípioSede
                <input value={fCodMunicipioSede} onChange={(e) => setFCodMunicipioSede(e.target.value)} inputMode="numeric" className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm" />
              </label>
              <label className="text-sm text-[var(--t2)]">
                CodModalidade
                <input value={fCodModalidade} onChange={(e) => setFCodModalidade(e.target.value)} inputMode="numeric" className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm" />
              </label>
            </div>
            <div className="flex justify-end gap-2" style={{ marginTop: 20 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setModalJeesp(false)}>Cancelar</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!fCompeticao.trim() || !fCodCompeticao.trim() || !fMunicipioSede.trim() || !fCodMunicipioSede.trim()}
                onClick={confirmarJeesp}
              >
                Gerar Excel
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 3: Verificar** — `cd frontend && npm run build`
  Esperado: `tsc -b && vite build` verdes.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/services/relatorios.ts frontend/src/pages/RelatorioCongresso.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(jeesp): modal de valores legados no export do congresso (evento escolar)"
```

---

## Verificação final (após as tasks)

- [ ] `cd backend && npx tsc --noEmit && npx vitest run src/modules/relatorios` e `cd frontend && npm run build` verdes.
- [ ] **Teste manual (dev):** evento escolar (Jeesp) → "Baixar Excel" abre o modal; ao preencher e gerar, baixa `Confirmacao_*.xlsx` com aba `Planilha1`, dados na linha 3, colunas A–J, fórmula `insert into confirmacao` em J, "Cidade Sede" por modalidade. Evento **não‑escolar** → baixa direto o `Congresso_*.xlsx` atual (inalterado).

## Self-Review (cobertura da spec)
- Substituir só no escolar (toggle): Task 2 (controller ramifica) ✓.
- Planilha `Planilha1`, dados na linha 3, colunas A–J, fórmula J: Task 1 ✓.
- B=participante, D=modalidade, C/E/F/G/H/I do form, A sequencial, Cidade Sede por modalidade: Task 1 ✓.
- Form no export (modal) com prefill: Task 3 ✓.
- Não‑escolar inalterado: Task 2 (branch else → `gerarCongressoXlsx`) ✓.
- Sem migration: nenhuma task toca schema ✓.
