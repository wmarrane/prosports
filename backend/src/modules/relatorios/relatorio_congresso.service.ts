import path from 'path'
import ExcelJS from 'exceljs'
import prisma from '../../lib/prisma'

const TEMPLATE_PATH = path.resolve(__dirname, '../../../templates/Congresso.xlsx')

// Mapeia tipo de modalidade -> nome da aba template
const TIPO_TO_SHEET: Record<string, string> = {
  especifico: 'Especifico',
  grupos: 'Grupos',
  ordem_entrada: 'Ordem Entrada',
  chaves: 'Chaves',
}

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

function cloneSheet(
  wb: ExcelJS.Workbook,
  source: ExcelJS.Worksheet,
  newName: string
): ExcelJS.Worksheet {
  const target = wb.addWorksheet(newName, {
    properties: { ...source.properties },
    pageSetup: { ...source.pageSetup },
    views: source.views,
  } as any)

  // Larguras de coluna
  source.columns?.forEach((c: any, i: number) => {
    const col = target.getColumn(i + 1)
    if (c.width) col.width = c.width
    if (c.hidden) col.hidden = c.hidden
  })

  // Linhas, valores e estilos
  source.eachRow({ includeEmpty: true }, (row, rowNum) => {
    const trow = target.getRow(rowNum)
    if (row.height) trow.height = row.height

    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      const tc = trow.getCell(colNum)
      tc.value = cell.value
      if (cell.style && Object.keys(cell.style).length) {
        tc.style = JSON.parse(JSON.stringify(cell.style))
      }
    })
  })

  // Merges
  const merges = (source as any)._merges ?? {}
  for (const range of Object.keys(merges)) {
    try {
      target.mergeCells(range)
    } catch {
      /* ignora overlap */
    }
  }

  return target
}

function setStaticValue(sheet: ExcelJS.Worksheet, addr: string, value: any) {
  const cell = sheet.getCell(addr)
  cell.value = value
}

// Limpa range de cells (preserva estilos, zera valor)
function clearRange(sheet: ExcelJS.Worksheet, row1: number, col1: number, row2: number, col2: number) {
  for (let r = row1; r <= row2; r++) {
    for (let c = col1; c <= col2; c++) {
      const cell = sheet.getRow(r).getCell(c)
      cell.value = null
    }
  }
}

type ModalidadeCompleta = Awaited<ReturnType<typeof loadEventoComModalidades>>['modalidades'][number]

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

function nomeParticipante(p: any): string {
  return p?.nome ?? '—'
}

// ── Renderizadores por tipo ────────────────────────────────────────────

function fillGrupos(
  sheet: ExcelJS.Worksheet,
  mod: ModalidadeCompleta,
  inscritos: any[],
  sorteio: any
) {
  // B6 = nome modalidade (sample tem BOCHA)
  setStaticValue(sheet, 'B6', mod.nome.toUpperCase())

  // Lista de inscritos: B7..B(n+6). Template tem ate B80.
  // Limpa lista atual (B7:B40)
  for (let r = 7; r <= 80; r++) sheet.getRow(r).getCell(2).value = null
  inscritos.forEach((i, idx) => {
    sheet.getRow(7 + idx).getCell(2).value = nomeParticipante(i.participante)
  })

  // Grupos do sorteio em G7:M10 (Grupo A na col G, B na H, ...)
  // Template tem ate Grupo F (col 12). Limpa G7:M40 antes
  for (let r = 7; r <= 40; r++) {
    for (let c = 7; c <= 13; c++) sheet.getRow(r).getCell(c).value = null
  }
  if (sorteio?.resultado?.grupos) {
    const grupos: any[] = sorteio.resultado.grupos
    grupos.forEach((g: any, gi: number) => {
      // Header "Grupo X" ja existe no template em row 6 cols G..L
      // Posicoes (numericos) ja em F7:F10
      const colG = 7 + gi // col index 7 = G
      const pids: number[] = g.participantes ?? []
      pids.forEach((pid, pi) => {
        const insc = inscritos.find((i) => i.participante_id === pid)
        if (insc) sheet.getRow(7 + pi).getCell(colG).value = nomeParticipante(insc.participante)
      })
    })
  }
}

function fillChaves(
  sheet: ExcelJS.Worksheet,
  mod: ModalidadeCompleta,
  inscritos: any[],
  _sorteio: any
) {
  // B7 = nome modalidade
  setStaticValue(sheet, 'B7', mod.nome.toUpperCase())

  // Lista inscritos em B8..B80
  for (let r = 8; r <= 80; r++) {
    sheet.getRow(r).getCell(2).value = null
    sheet.getRow(r).getCell(4).value = null
  }
  inscritos.forEach((i, idx) => {
    const nome = nomeParticipante(i.participante)
    sheet.getRow(8 + idx).getCell(2).value = nome
    sheet.getRow(8 + idx).getCell(4).value = nome
  })

  // Bracket complexo: deixamos a estrutura template intacta.
  // Os slots (D6, D8..) tem formulas que referenciam a lista de B/D.
  // Cabe ao usuario consolidar manualmente conforme o sorteio.
}

function fillOrdemEntrada(
  sheet: ExcelJS.Worksheet,
  mod: ModalidadeCompleta,
  inscritos: any[],
  sorteio: any
) {
  // B6 = nome modalidade (sample COREOGRAFIA A)
  setStaticValue(sheet, 'B6', mod.nome.toUpperCase())

  // Lista inscritos em B7..B80
  for (let r = 7; r <= 80; r++) {
    sheet.getRow(r).getCell(2).value = null
    sheet.getRow(r).getCell(6).value = null // Coluna F: nome ordenado
  }
  inscritos.forEach((i, idx) => {
    sheet.getRow(7 + idx).getCell(2).value = nomeParticipante(i.participante)
  })

  // Ordem do sorteio em F7..F80 (col 6)
  if (sorteio?.resultado?.ordem) {
    const ordem: number[] = sorteio.resultado.ordem
    ordem.forEach((pid, idx) => {
      const insc = inscritos.find((i) => i.participante_id === pid)
      if (insc) sheet.getRow(7 + idx).getCell(6).value = nomeParticipante(insc.participante)
    })
  }

  // Limpa lado direito (col J..N) que era a 2a modalidade do template
  for (let r = 6; r <= 80; r++) {
    for (let c = 10; c <= 15; c++) sheet.getRow(r).getCell(c).value = null
  }
}

function fillEspecifico(
  sheet: ExcelJS.Worksheet,
  mod: ModalidadeCompleta,
  inscritos: any[],
  _sorteio: any
) {
  // B5 / B6 = nome modalidade
  setStaticValue(sheet, 'B5', mod.nome.toUpperCase())
  setStaticValue(sheet, 'B6', mod.nome.toUpperCase())

  // Lista todos os inscritos na col B a partir de B9
  for (let r = 9; r <= 80; r++) {
    for (let c = 2; c <= 8; c++) sheet.getRow(r).getCell(c).value = null
  }
  inscritos.forEach((i, idx) => {
    sheet.getRow(9 + idx).getCell(2).value = nomeParticipante(i.participante)
  })

  // Limpa lado direito (col J..P) — 2a modalidade do template
  for (let r = 5; r <= 80; r++) {
    for (let c = 10; c <= 16; c++) sheet.getRow(r).getCell(c).value = null
  }
}

// ── Entrypoint ─────────────────────────────────────────────────────────

export async function gerarCongressoXlsx(evento_id: number): Promise<Buffer> {
  const { evento, modalidades } = await loadEventoComModalidades(evento_id)
  const inscritosByMod = await loadInscritosByModalidade(evento_id)
  const sorteiosByMod = await loadSorteiosByModalidade(evento_id)

  const cidadeSede =
    evento.anfitriao?.municipio?.nome ?? evento.anfitriao?.nome ?? ''

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(TEMPLATE_PATH)

  const tplSheets: Record<string, ExcelJS.Worksheet | undefined> = {
    especifico: wb.getWorksheet('Especifico'),
    grupos: wb.getWorksheet('Grupos'),
    ordem_entrada: wb.getWorksheet('Ordem Entrada'),
    chaves: wb.getWorksheet('Chaves'),
  }

  for (const mod of modalidades) {
    const tipo = mod.tipo_modalidade?.tipo ?? 'especifico'
    const tplSheet = tplSheets[tipo]
    if (!tplSheet) continue

    const sigla = mod.sigla || `MOD${mod.id}`
    const newName = uniqueSheetName(wb, sigla)
    const sheet = cloneSheet(wb, tplSheet, newName)

    // Header comum: cidade sede em D2 (estatico, substitui formula cross-sheet)
    setStaticValue(sheet, 'D2', cidadeSede)

    const inscritos = inscritosByMod.get(mod.id) ?? []
    const sorteio = sorteiosByMod.get(mod.id)
    const resultado = sorteio ? { resultado: sorteio.resultado as any } : null

    if (tipo === 'grupos') fillGrupos(sheet, mod, inscritos, resultado)
    else if (tipo === 'chaves') fillChaves(sheet, mod, inscritos, resultado)
    else if (tipo === 'ordem_entrada') fillOrdemEntrada(sheet, mod, inscritos, resultado)
    else fillEspecifico(sheet, mod, inscritos, resultado)
  }

  // Remove templates originais
  for (const name of Object.values(TIPO_TO_SHEET)) {
    const ws = wb.getWorksheet(name)
    if (ws) wb.removeWorksheet(ws.id)
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
