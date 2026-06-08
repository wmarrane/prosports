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
