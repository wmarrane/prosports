# Relatório "Congresso técnico" v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Reescrever `relatorio_congresso.service.ts` para gerar um workbook do zero: 1 aba por modalidade (sigla), cabeçalho padrão (logo/Cidade Sede/anfitrião), e layout por tipo — chaves copiadas de `CHAVES CT.xlsx`.

**Architecture:** ExcelJS. especifico/grupos/ordem construídos programaticamente; chaves copia a aba `NN` (nº de inscritos) de `CHAVES CT.xlsx` (sem formas → cópia fiel por células/estilos/merges/larguras) e preenche a coluna E pela posição da coluna D. Helper único de formatação.

**Tech Stack:** Node/TS, ExcelJS (já presente), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-08-relatorio-congresso-v2-design.md` (mapeamento detalhado de células/formatos está lá — seguir à risca).

---

### Task 1: Assets em runtime (CHAVES CT.xlsx + logo) + Dockerfile

**Files:**
- Create: `backend/templates/CHAVES CT.xlsx` (cópia de `personaladmin/reports/CHAVES CT.xlsx`)
- Create: `backend/templates/montana-simbolo.png` (cópia de `frontend/public/montana/simbolo.png`)
- Modify: `backend/Dockerfile` (garantir cópia de `templates/`)

- [ ] **Step 1: Copiar arquivos** (PowerShell):
```powershell
Copy-Item "personaladmin/reports/CHAVES CT.xlsx" "backend/templates/CHAVES CT.xlsx"
Copy-Item "frontend/public/montana/simbolo.png" "backend/templates/montana-simbolo.png"
```
- [ ] **Step 2:** Conferir no `backend/Dockerfile` que há `COPY ... templates ./templates` (ou que `COPY . .` cobre). Se o copy for seletivo, garantir que `templates/` (com o arquivo de nome com espaço) entra. Não quebrar o copy existente do `Congresso.xlsx`.
- [ ] **Step 3: Commit**
```bash
git add "backend/templates/CHAVES CT.xlsx" backend/templates/montana-simbolo.png backend/Dockerfile
git commit -m "chore(relatorio): adiciona CHAVES CT.xlsx e logo aos templates do backend"
```

---

### Task 2: Helpers de estilo + cabeçalho

**Files:**
- Create: `backend/src/modules/relatorios/xlsx-style.ts`
- Create: `backend/src/modules/relatorios/xlsx-style.test.ts`

- [ ] **Step 1: Teste falho**
```ts
import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { aplicarEstilo, COR } from './xlsx-style'

it('aplica fonte branca, negrito e fundo', () => {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('s')
  const c = ws.getCell('B6')
  aplicarEstilo(c, { bold: true, fontSize: 20, fontColor: COR.branco, fill: COR.preto })
  expect(c.font?.bold).toBe(true)
  expect(c.font?.size).toBe(20)
  expect(c.font?.name).toBe('Aptos Narrow')
  expect((c.fill as any)?.fgColor?.argb).toBe('FF000000')
})
```
- [ ] **Step 2: Rodar (FAIL)** — `cd backend; npx vitest run src/modules/relatorios/xlsx-style.test.ts`
- [ ] **Step 3: Implementar**
```ts
import type ExcelJS from 'exceljs'

export const COR = {
  branco: 'FFFFFFFF',
  preto: 'FF000000',
  azul: 'FF156082',
} as const

type Estilo = {
  bold?: boolean
  fontSize?: number
  fontName?: string
  fontColor?: string
  fill?: string
}

export function aplicarEstilo(cell: ExcelJS.Cell, e: Estilo): void {
  cell.font = {
    name: e.fontName ?? 'Aptos Narrow',
    size: e.fontSize ?? 11,
    bold: e.bold ?? false,
    color: e.fontColor ? { argb: e.fontColor } : undefined,
  }
  if (e.fill) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: e.fill } }
  }
}
```
- [ ] **Step 4: Rodar (PASS)** + commit
```bash
git add backend/src/modules/relatorios/xlsx-style.ts backend/src/modules/relatorios/xlsx-style.test.ts
git commit -m "feat(relatorio): helper de estilo xlsx (Aptos Narrow, cores)"
```

---

### Task 3: Cabeçalho comum (logo A1:B3, Cidade Sede C2, anfitrião D4, B5)

**Files:**
- Modify: `backend/src/modules/relatorios/relatorio_congresso.service.ts` (nova função `aplicarCabecalho`)

- [ ] **Step 1: Implementar `aplicarCabecalho(wb, sheet, logoId, anfitriao)`**
```ts
function aplicarCabecalho(sheet: ExcelJS.Worksheet, logoImageId: number, anfitriao: string) {
  sheet.mergeCells('A1:B3')
  sheet.addImage(logoImageId, 'A1:B3')
  sheet.getCell('C2').value = 'Cidade Sede'
  const d4 = sheet.getCell('D4')
  d4.value = anfitriao
  aplicarEstilo(d4, { bold: true, fontColor: COR.branco, fill: COR.azul })
  sheet.getCell('B5').value = 'Modalidade (Inscritos)'
}
```
- [ ] **Step 2:** No entrypoint, carregar o logo uma vez: `const logoBuf = fs.readFileSync(path.resolve(__dirname,'../../../templates/montana-simbolo.png'))` e por aba: `const id = wb.addImage({ buffer: logoBuf, extension: 'png' })` (o `addImage` do workbook é global; pode reusar o mesmo id em várias abas). Aplicar `aplicarCabecalho` em cada aba criada.
- [ ] **Step 3: Commit** (será testado junto no entrypoint, Task 7).

---

### Task 4: `fillEspecifico` (programático)

**Files:** Modify `relatorio_congresso.service.ts`

- [ ] **Step 1: Implementar** conforme spec §Específico:
```ts
function fillEspecifico(sheet: ExcelJS.Worksheet, nome: string, inscritos: string[]) {
  const b6 = sheet.getCell('B6'); b6.value = nome.toUpperCase()
  aplicarEstilo(b6, { bold: true, fontSize: 20, fontColor: COR.branco, fill: COR.preto })
  const c6 = sheet.getCell('C6'); c6.value = inscritos.length
  aplicarEstilo(c6, { fontSize: 12, fontColor: COR.branco, fill: COR.azul })
  inscritos.forEach((n, i) => {
    const cell = sheet.getRow(7 + i).getCell(2)
    cell.value = n
    aplicarEstilo(cell, { fontSize: 11, fontColor: COR.preto, fill: COR.branco })
  })
}
```
- [ ] **Step 2: Commit junto no Task 7.**

---

### Task 5: `fillGrupos`

**Files:** Modify `relatorio_congresso.service.ts`

- [ ] **Step 1: Implementar** (B6/C6/B7 = igual específico; F5 "Grupos"; F6 "#"; F7:F10 = 1..4; grupos por coluna a partir de G6):
```ts
function fillGrupos(sheet: ExcelJS.Worksheet, nome: string, inscritos: string[], grupos: { letra: string; participantes: number[] }[], nomePorPid: Map<number, string>) {
  fillEspecifico(sheet, nome, inscritos) // B6/C6/B7+
  sheet.getCell('F5').value = 'Grupos'
  const f6 = sheet.getCell('F6'); f6.value = '#'
  aplicarEstilo(f6, { bold: true, fontSize: 20, fontColor: COR.branco, fill: COR.preto })
  for (let i = 0; i < 4; i++) {
    const c = sheet.getRow(7 + i).getCell(6); c.value = i + 1
    aplicarEstilo(c, { fontSize: 11, fontColor: COR.preto, fill: COR.branco })
  }
  grupos.forEach((g, gi) => {
    const col = 7 + gi // G=7
    const head = sheet.getRow(6).getCell(col); head.value = `GRUPO ${g.letra}`
    aplicarEstilo(head, { bold: true, fontSize: 11, fontColor: COR.preto, fill: COR.branco })
    g.participantes.slice(0, 4).forEach((pid, pi) => {
      const c = sheet.getRow(7 + pi).getCell(col)
      c.value = nomePorPid.get(pid) ?? '—'
      aplicarEstilo(c, { fontSize: 11, fontColor: COR.preto, fill: COR.branco })
    })
  })
}
```
- [ ] **Step 2: Commit junto no Task 7.**

---

### Task 6: `fillOrdem` + `copiarAbaChaves`/`fillChaves`

**Files:** Modify `relatorio_congresso.service.ts`

- [ ] **Step 1: `fillOrdem`** (spec §Ordem):
```ts
function fillOrdem(sheet: ExcelJS.Worksheet, nome: string, inscritos: string[], ordem: number[], nomePorPid: Map<number, string>) {
  fillEspecifico(sheet, nome, inscritos)
  const e5 = sheet.getCell('E5'); e5.value = 'ORDEM DE ENTRADA'
  aplicarEstilo(e5, { fontSize: 11, fontColor: COR.branco, fill: COR.azul })
  const e6 = sheet.getCell('E6'); e6.value = '#'
  aplicarEstilo(e6, { fontSize: 12, fontColor: COR.branco, fill: COR.azul })
  const f6 = sheet.getCell('F6'); f6.value = nome.toUpperCase()
  aplicarEstilo(f6, { fontSize: 12, fontColor: COR.branco, fill: COR.azul })
  ordem.forEach((pid, i) => {
    const pos = sheet.getRow(7 + i).getCell(5); pos.value = i + 1
    aplicarEstilo(pos, { fontSize: 11, fontColor: COR.preto, fill: COR.branco })
    const mun = sheet.getRow(7 + i).getCell(6); mun.value = nomePorPid.get(pid) ?? '—'
    aplicarEstilo(mun, { fontSize: 11, fontColor: COR.preto, fill: COR.branco })
  })
}
```
- [ ] **Step 2: `copiarAbaChaves`** — copia a aba `NN` de um workbook `CHAVES CT.xlsx` já carregado para o `wb` de saída (cross-workbook). Reaproveitar o padrão do `cloneSheet` existente (itera larguras/linhas/células/estilos/merges), mas `source` vem do outro workbook:
```ts
function copiarAba(wbOut: ExcelJS.Workbook, source: ExcelJS.Worksheet, newName: string): ExcelJS.Worksheet {
  const target = wbOut.addWorksheet(newName, { properties: { ...source.properties }, pageSetup: { ...source.pageSetup }, views: source.views } as any)
  source.columns?.forEach((c: any, i: number) => { const col = target.getColumn(i + 1); if (c.width) col.width = c.width; if (c.hidden) col.hidden = c.hidden })
  source.eachRow({ includeEmpty: true }, (row, rn) => {
    const trow = target.getRow(rn); if (row.height) trow.height = row.height
    row.eachCell({ includeEmpty: true }, (cell, cn) => {
      const tc = trow.getCell(cn); tc.value = cell.value
      if (cell.style && Object.keys(cell.style).length) tc.style = JSON.parse(JSON.stringify(cell.style))
    })
  })
  const merges = (source as any)._merges ?? {}
  for (const range of Object.keys(merges)) { try { target.mergeCells(range) } catch { /* overlap */ } }
  return target
}
```
- [ ] **Step 3: `fillChaves`** — após copiar a aba, escrever B6/C6/B7+ e preencher o bracket (coluna D = posição, coluna E = participante):
```ts
function fillChaves(sheet: ExcelJS.Worksheet, nome: string, inscritos: string[], slots: (number | null)[], nomePorPid: Map<number, string>) {
  const b6 = sheet.getCell('B6'); b6.value = nome.toUpperCase()
  aplicarEstilo(b6, { bold: true, fontSize: 20, fontColor: COR.branco, fill: COR.preto })
  const c6 = sheet.getCell('C6'); c6.value = inscritos.length
  aplicarEstilo(c6, { fontSize: 12, fontColor: COR.branco, fill: COR.azul })
  inscritos.forEach((n, i) => { const cell = sheet.getRow(7 + i).getCell(2); cell.value = n; aplicarEstilo(cell, { fontSize: 11, fontColor: COR.preto, fill: COR.branco }) })
  // mapa posição->linha lendo a coluna D
  const linhaPorPos = new Map<number, number>()
  sheet.eachRow({ includeEmpty: false }, (row, rn) => {
    const d = row.getCell(4).value
    if (typeof d === 'number') linhaPorPos.set(d, rn)
  })
  slots.forEach((pid, idx) => {
    if (pid == null) return
    const pos = idx + 1
    const rn = linhaPorPos.get(pos)
    if (rn) sheet.getRow(rn).getCell(5).value = nomePorPid.get(pid) ?? '—'
  })
}
```
- [ ] **Step 4: Commit junto no Task 7.**

---

### Task 7: Reescrever o entrypoint `gerarCongressoXlsx` + testes

**Files:**
- Modify: `backend/src/modules/relatorios/relatorio_congresso.service.ts` (entrypoint + remover lógica antiga `cloneSheet`/`limparHeaderCidadeSede`/`fill*` antigos não usados)
- Create: `backend/src/modules/relatorios/relatorio_congresso.service.test.ts`

- [ ] **Step 1: Entrypoint** — workbook novo; carrega `CHAVES CT.xlsx` uma vez; por modalidade cria/cópia a aba (sigla), aplica cabeçalho, e chama o filler do tipo. `NN = String(inscritos.length).padStart(2,'0')`. Fallback: se chaves e não há aba `NN` → trata como específico (lista). Sem template `Congresso.xlsx`.
```ts
export async function gerarCongressoXlsx(evento_id: number): Promise<Buffer> {
  const { evento, modalidades } = await loadEventoComModalidades(evento_id)
  const inscritosByMod = await loadInscritosByModalidade(evento_id)
  const sorteiosByMod = await loadSorteiosByModalidade(evento_id)
  const anfitriao = evento.anfitriao?.nome ?? ''

  const wb = new ExcelJS.Workbook()
  const chavesWb = new ExcelJS.Workbook()
  await chavesWb.xlsx.readFile(path.resolve(__dirname, '../../../templates/CHAVES CT.xlsx'))
  const logoBuf = fs.readFileSync(path.resolve(__dirname, '../../../templates/montana-simbolo.png'))
  const logoId = wb.addImage({ buffer: logoBuf, extension: 'png' })

  for (const mod of modalidades) {
    const tipo = mod.tipo_modalidade?.tipo ?? 'especifico'
    const inscr = inscritosByMod.get(mod.id) ?? []
    const nomes = inscr.map((i) => i.participante?.nome ?? '—') // já alfabético
    const nomePorPid = new Map(inscr.map((i) => [i.participante_id, i.participante?.nome ?? '—']))
    const sorteio = sorteiosByMod.get(mod.id)
    const sigla = uniqueSheetName(wb, mod.sigla || `MOD${mod.id}`)

    let sheet: ExcelJS.Worksheet
    if (tipo === 'chaves') {
      const n = String(inscr.length).padStart(2, '0')
      const src = chavesWb.getWorksheet(n)
      if (src) {
        sheet = copiarAba(wb, src, sigla)
        fillChaves(sheet, mod.nome, nomes, (sorteio?.resultado as any)?.slots ?? [], nomePorPid)
      } else {
        sheet = wb.addWorksheet(sigla)
        fillEspecifico(sheet, mod.nome, nomes) // fallback
      }
    } else {
      sheet = wb.addWorksheet(sigla)
      if (tipo === 'grupos') fillGrupos(sheet, mod.nome, nomes, (sorteio?.resultado as any)?.grupos ?? [], nomePorPid)
      else if (tipo === 'ordem_entrada') fillOrdem(sheet, mod.nome, nomes, (sorteio?.resultado as any)?.ordem ?? [], nomePorPid)
      else fillEspecifico(sheet, mod.nome, nomes)
    }
    aplicarCabecalho(sheet, logoId, anfitriao)
  }

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}
```
Adicionar imports `import fs from 'fs'` (já tem `path`). Remover `cloneSheet`, `limparHeaderCidadeSede`, `setStaticValue`, `clearRange`, `TIPO_TO_SHEET`, `TEMPLATE_PATH` e os `fill*` antigos.

- [ ] **Step 2: Teste** (mock prisma) — para cada tipo, gera buffer, reabre com ExcelJS e verifica:
```ts
// grupos: B6 == nome.toUpperCase(), C6 == nº inscritos, B7 == 1º inscrito (alfabético), G6 começa com 'GRUPO'
// ordem: E6 == '#', F7 == 1º município da ordem, E7 == 1
// especifico: B6 caixa alta, C6 contagem
// chaves: aba copiada existe; E na linha onde D==1 recebe o slot[0]
```
Escrever asserts reabrindo o buffer: `const wb2 = new ExcelJS.Workbook(); await wb2.xlsx.load(buf); const ws = wb2.getWorksheet('<sigla>')`.

- [ ] **Step 3: Rodar** `cd backend; npx vitest run src/modules/relatorios` + `npx tsc --noEmit` (sem erros).
- [ ] **Step 4: Commit**
```bash
git add backend/src/modules/relatorios/relatorio_congresso.service.ts backend/src/modules/relatorios/relatorio_congresso.service.test.ts
git commit -m "feat(relatorio): Congresso tecnico v2 (abas por modalidade, chaves do CHAVES CT.xlsx)"
```

---

### Task 8: Smoke real (manual)
- [ ] Rodar o endpoint `/relatorios/eventos/:id/congresso` num evento de dev com modalidades dos 4 tipos; abrir o `.xlsx` e conferir: cabeçalho com logo, Cidade Sede/anfitrião, B6/C6 formatados, grupos por coluna, ordem E/F, e a aba de chaves com o bracket preenchido (E na posição certa).

---

## Self-Review
- Cobre §geral (1 aba/sigla, logo A1:B3, C2/D4, B5), §específico, §grupos (F5/F6/F7:F10/G+), §chaves (cópia NN + D→E), §ordem (E5/E6/F6/E7/F7). Fallback de chaves sem aba ✓. Assets+Dockerfile ✓.
- Verificações no início: confirmar nome real do worksheet de bracket (string '08' com zero à esquerda — `getWorksheet(n)` aceita nome) e que `inscr` já vem alfabético (loadInscritosByModalidade ordena por nome asc ✓).
- Atenção: `wb.addImage` por workbook (id reusável entre abas) — chamar 1x e reusar o id.
