import fs from 'fs'
import path from 'path'
import ExcelJS from 'exceljs'
import prisma from '../../lib/prisma'
import { aplicarEstilo, aplicarBordas, aplicarBordaExterna, COR } from './xlsx-style'

function sanitizeSheetName(name: string): string {
  // Excel: max 31 chars; nao pode conter : \ / ? * [ ]
  return name.replace(/[:\\/?*\[\]]/g, '_').slice(0, 31)
}

function uniqueSheetName(wb: ExcelJS.Workbook, base: string): string {
  let name = sanitizeSheetName(base)
  let i = 2
  while (wb.getWorksheet(name)) {
    const suffix = `_${i++}`
    name = sanitizeSheetName(base.slice(0, 31 - suffix.length)) + suffix
  }
  return name
}

async function loadEventoComModalidades(evento_id: number) {
  const evento = await prisma.evento.findUnique({
    where: { id: evento_id },
    include: {
      competicao: {
        include: {
          modalidades: {
            include: { tipo_modalidade: true },
            orderBy: { nome: 'asc' },
          },
        },
      },
      anfitriao: { include: { municipio: true } },
    },
  })
  if (!evento) {
    throw Object.assign(new Error('Evento não encontrado'), { status: 404 })
  }

  const modalidades = evento.competicao?.modalidades ?? []
  return { evento, modalidades }
}

async function loadInscritosByModalidade(evento_id: number) {
  const insc = await prisma.inscricao.findMany({
    where: { evento_id },
    include: {
      participante: { include: { municipio: true } },
    },
    orderBy: { participante: { nome: 'asc' } },
  })
  const map = new Map<number, typeof insc>()
  for (const i of insc) {
    if (!map.has(i.modalidade_id)) map.set(i.modalidade_id, [] as any)
    map.get(i.modalidade_id)!.push(i)
  }
  return map
}

async function loadSorteiosByModalidade(evento_id: number) {
  const sorteios = await prisma.sorteio.findMany({ where: { evento_id } })
  return new Map(sorteios.map((s) => [s.modalidade_id, s]))
}

// ── Cabeçalho comum ────────────────────────────────────────────────────

function aplicarCabecalho(sheet: ExcelJS.Worksheet, logoImageId: number, anfitriao: string) {
  sheet.mergeCells('A1:B3')
  sheet.addImage(logoImageId, 'A1:B3')
  sheet.getCell('C2').value = 'Cidade Sede'
  const d2 = sheet.getCell('D2')
  d2.value = anfitriao
  aplicarEstilo(d2, { bold: true, fontColor: COR.branco, fill: COR.azul })
  sheet.getCell('B5').value = 'Modalidade (Inscritos)'
  // Remove as linhas de grade (gridlines) — só bordas explícitas aparecem.
  // Preserva demais props da view (ex.: panes congelados das abas de chaves).
  const view = sheet.views?.[0] ?? {}
  sheet.views = [{ ...view, showGridLines: false }]
}

// ── Renderizadores por tipo ────────────────────────────────────────────

function fillEspecifico(sheet: ExcelJS.Worksheet, nome: string, inscritos: string[]) {
  const b6 = sheet.getCell('B6')
  b6.value = nome.toUpperCase()
  aplicarEstilo(b6, { bold: true, fontSize: 20, fontColor: COR.branco, fill: COR.azul })
  const c6 = sheet.getCell('C6')
  c6.value = inscritos.length
  aplicarEstilo(c6, { fontSize: 12, fontColor: COR.branco, fill: COR.azul })
  inscritos.forEach((n, i) => {
    const cell = sheet.getRow(7 + i).getCell(2)
    cell.value = n
    aplicarEstilo(cell, { fontSize: 11, fontColor: COR.preto, fill: COR.branco })
  })
}

function fillGrupos(
  sheet: ExcelJS.Worksheet,
  nome: string,
  inscritos: string[],
  grupos: { letra: string; participantes: number[] }[],
  nomePorPid: Map<number, string>
) {
  fillEspecifico(sheet, nome, inscritos) // B6/C6/B7+
  sheet.getCell('F5').value = 'Grupos'
  const f6 = sheet.getCell('F6')
  f6.value = '#'
  aplicarEstilo(f6, { bold: true, fontSize: 20, fontColor: COR.branco, fill: COR.azul })
  for (let i = 0; i < 4; i++) {
    const c = sheet.getRow(7 + i).getCell(6)
    c.value = i + 1
    aplicarEstilo(c, { fontSize: 11, fontColor: COR.preto, fill: COR.branco })
  }
  grupos.forEach((g, gi) => {
    const col = 7 + gi // G=7
    const head = sheet.getRow(6).getCell(col)
    head.value = `GRUPO ${g.letra}`
    aplicarEstilo(head, { bold: true, fontSize: 11, fontColor: COR.branco, fill: COR.azul })
    g.participantes.slice(0, 4).forEach((pid, pi) => {
      const c = sheet.getRow(7 + pi).getCell(col)
      c.value = nomePorPid.get(pid) ?? '—'
      aplicarEstilo(c, { fontSize: 11, fontColor: COR.preto, fill: COR.branco })
    })
  })
  // Bordas #156082 no bloco de grupos (grade interna + externa) a partir de F6
  aplicarBordas(sheet, 6, 6, 10, 6 + grupos.length, COR.azul)

  fillProgramacao(sheet, grupos, nomePorPid)
}

// Quadro de Programação de jogos (3 rodadas) para modalidades de grupo.
// Rodada 1: cols G–K | Rodada 2: cols M–Q | Rodada 3: cols S–W.
function fillProgramacao(
  sheet: ExcelJS.Worksheet,
  grupos: { letra: string; participantes: number[] }[],
  nomePorPid: Map<number, string>
) {
  const rodadas = [
    { titulo: '1ª Rodada', colBase: 7, pares: [[1, 4], [2, 3]] },   // G
    { titulo: '2ª Rodada', colBase: 13, pares: [[3, 1], [4, 2]] },  // M
    { titulo: '3ª Rodada', colBase: 19, pares: [[1, 2], [3, 4]] },  // S
  ] as const

  for (const rod of rodadas) {
    const cb = rod.colBase
    // Títulos
    sheet.getRow(14).getCell(cb).value = 'Programação'
    sheet.getRow(15).getCell(cb).value = rod.titulo
    sheet.getRow(16).getCell(cb).value = 'Data'
    sheet.getRow(17).getCell(cb).value = 'Local'
    sheet.getRow(18).getCell(cb).value = 'Endereço'
    // Bordas externas pretas nas faixas Data/Local/Endereço (cb..cb+4)
    for (const r of [16, 17, 18]) aplicarBordaExterna(sheet, r, cb, r, cb + 4, COR.preto)
    // Cabeçalhos da tabela (linha 19) com fundo #D9D9D9
    const heads = ['Horário', 'Modalidade', 'Equipe', 'x', 'Equipe']
    heads.forEach((h, i) => {
      const c = sheet.getRow(19).getCell(cb + i)
      c.value = h
      aplicarEstilo(c, { fill: COR.cinza })
    })
    // Jogos: por grupo, 2 linhas (um par por linha), começando na linha 20
    let row = 20
    for (const g of grupos) {
      for (const [pe, pd] of rod.pares) {
        const pidE = g.participantes[pe - 1]
        const pidD = g.participantes[pd - 1]
        sheet.getRow(row).getCell(cb + 2).value = pidE != null ? (nomePorPid.get(pidE) ?? '-') : '-'
        sheet.getRow(row).getCell(cb + 3).value = 'x'
        sheet.getRow(row).getCell(cb + 4).value = pidD != null ? (nomePorPid.get(pidD) ?? '-') : '-'
        row++
      }
    }
    // Grade preta (internas + externas) da área de jogos: cb..cb+4, linhas 20..55
    aplicarBordas(sheet, 20, cb, 55, cb + 4, COR.preto)
  }
}

function fillOrdem(
  sheet: ExcelJS.Worksheet,
  nome: string,
  inscritos: string[],
  ordem: number[],
  nomePorPid: Map<number, string>
) {
  fillEspecifico(sheet, nome, inscritos)
  const e5 = sheet.getCell('E5')
  e5.value = 'ORDEM DE ENTRADA'
  aplicarEstilo(e5, { fontSize: 11, fontColor: COR.branco, fill: COR.azul })
  const e6 = sheet.getCell('E6')
  e6.value = '#'
  aplicarEstilo(e6, { fontSize: 12, fontColor: COR.branco, fill: COR.azul })
  const f6 = sheet.getCell('F6')
  f6.value = nome.toUpperCase()
  aplicarEstilo(f6, { fontSize: 12, fontColor: COR.branco, fill: COR.azul })
  ordem.forEach((pid, i) => {
    const pos = sheet.getRow(7 + i).getCell(5)
    pos.value = i + 1
    aplicarEstilo(pos, { fontSize: 11, fontColor: COR.preto, fill: COR.branco })
    const mun = sheet.getRow(7 + i).getCell(6)
    mun.value = nomePorPid.get(pid) ?? '—'
    aplicarEstilo(mun, { fontSize: 11, fontColor: COR.preto, fill: COR.branco })
  })
}

// Copia cross-workbook a aba `source` para `wbOut` com o nome `newName`.
function copiarAba(
  wbOut: ExcelJS.Workbook,
  source: ExcelJS.Worksheet,
  newName: string
): ExcelJS.Worksheet {
  const target = wbOut.addWorksheet(newName, {
    properties: { ...source.properties },
    pageSetup: { ...source.pageSetup },
    views: source.views,
  } as any)
  source.columns?.forEach((c: any, i: number) => {
    const col = target.getColumn(i + 1)
    if (c.width) col.width = c.width
    if (c.hidden) col.hidden = c.hidden
  })
  source.eachRow({ includeEmpty: true }, (row, rn) => {
    const trow = target.getRow(rn)
    if (row.height) trow.height = row.height
    row.eachCell({ includeEmpty: true }, (cell, cn) => {
      const tc = trow.getCell(cn)
      tc.value = cell.value
      if (cell.style && Object.keys(cell.style).length) {
        tc.style = JSON.parse(JSON.stringify(cell.style))
      }
    })
  })
  const merges = (source as any)._merges ?? {}
  for (const range of Object.keys(merges)) {
    try {
      target.mergeCells(range)
    } catch {
      /* overlap */
    }
  }
  return target
}

function fillChaves(
  sheet: ExcelJS.Worksheet,
  nome: string,
  inscritos: string[],
  slots: (number | null)[],
  nomePorPid: Map<number, string>
) {
  const b6 = sheet.getCell('B6')
  b6.value = nome.toUpperCase()
  aplicarEstilo(b6, { bold: true, fontSize: 20, fontColor: COR.branco, fill: COR.azul })
  const c6 = sheet.getCell('C6')
  c6.value = inscritos.length
  aplicarEstilo(c6, { fontSize: 12, fontColor: COR.branco, fill: COR.azul })
  inscritos.forEach((n, i) => {
    const cell = sheet.getRow(7 + i).getCell(2)
    cell.value = n
    aplicarEstilo(cell, { fontSize: 11, fontColor: COR.preto, fill: COR.branco })
  })
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

// ── Entrypoint ─────────────────────────────────────────────────────────

export async function gerarCongressoXlsx(evento_id: number): Promise<Buffer> {
  const { evento, modalidades } = await loadEventoComModalidades(evento_id)
  const inscritosByMod = await loadInscritosByModalidade(evento_id)
  const sorteiosByMod = await loadSorteiosByModalidade(evento_id)
  const anfitriao = evento.anfitriao?.nome ?? ''

  const wb = new ExcelJS.Workbook()
  const chavesWb = new ExcelJS.Workbook()
  await chavesWb.xlsx.readFile(path.resolve(__dirname, '../../../templates/CHAVES CT.xlsx'))
  const logoBuf = fs.readFileSync(path.resolve(__dirname, '../../../templates/montana-simbolo.png'))
  const logoId = wb.addImage({ buffer: logoBuf as unknown as ExcelJS.Buffer, extension: 'png' })

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
      if (tipo === 'grupos')
        fillGrupos(sheet, mod.nome, nomes, (sorteio?.resultado as any)?.grupos ?? [], nomePorPid)
      else if (tipo === 'ordem_entrada')
        fillOrdem(sheet, mod.nome, nomes, (sorteio?.resultado as any)?.ordem ?? [], nomePorPid)
      else fillEspecifico(sheet, mod.nome, nomes)
    }
    aplicarCabecalho(sheet, logoId, anfitriao)

    // Aviso de revisão (vermelho, caixa alta) em G2 para todos os tipos.
    const aviso = sheet.getCell('G2')
    aviso.value = 'RELATÓRIO REQUER REVISÃO. REVISE ANTES DE PUBLICAR'
    aplicarEstilo(aviso, { fontSize: 12, fontColor: COR.vermelho })
  }

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}

export function nomeArquivo(evento: { nome: string; id: number }): string {
  const slug = evento.nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
  return `Congresso_${slug || `evento_${evento.id}`}.xlsx`
}
