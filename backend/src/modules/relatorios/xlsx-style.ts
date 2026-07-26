import type ExcelJS from 'exceljs'

export const COR = {
  branco: 'FFFFFFFF',
  preto: 'FF000000',
  azul: 'FF156082',
  cinza: 'FFD9D9D9',
  vermelho: 'FFFF0000',
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

type Espessura = 'thin' | 'medium'

export function aplicarBordas(
  sheet: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number, argb: string,
  style: Espessura = 'thin',
): void {
  const edge = { style, color: { argb } }
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      sheet.getRow(r).getCell(c).border = { top: edge, left: edge, bottom: edge, right: edge }
    }
  }
}

// Borda só no contorno externo do retângulo (preserva bordas internas existentes).
export function aplicarBordaExterna(
  sheet: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number, argb: string,
  style: Espessura = 'thin',
): void {
  const edge = { style, color: { argb } }
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      const cell = sheet.getRow(r).getCell(c)
      const b: any = { ...(cell.border || {}) }
      if (r === r1) b.top = edge
      if (r === r2) b.bottom = edge
      if (c === c1) b.left = edge
      if (c === c2) b.right = edge
      cell.border = b
    }
  }
}
