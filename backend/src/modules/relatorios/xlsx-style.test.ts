import { it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { aplicarEstilo, COR } from './xlsx-style'

it('aplica fonte branca, negrito e fundo', () => {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('s')
  const c = ws.getCell('B6')
  aplicarEstilo(c, { bold: true, fontSize: 20, fontColor: COR.branco, fill: COR.preto })
  expect(c.font?.bold).toBe(true)
  expect(c.font?.size).toBe(20)
  expect(c.font?.name).toBe('Aptos Narrow')
  expect((c.fill as any)?.fgColor?.argb).toBe('FF000000')
})

it('usa defaults (Aptos Narrow, size 11, sem fill)', () => {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('s')
  const c = ws.getCell('A1')
  aplicarEstilo(c, {})
  expect(c.font?.name).toBe('Aptos Narrow')
  expect(c.font?.size).toBe(11)
  expect(c.font?.bold).toBe(false)
})

it('expoe as cores corretas', () => {
  expect(COR.branco).toBe('FFFFFFFF')
  expect(COR.preto).toBe('FF000000')
  expect(COR.azul).toBe('FF156082')
})
