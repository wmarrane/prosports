// Gera uma célula CSV segura: neutraliza injeção de fórmula (Excel/Sheets)
// prefixando com apóstrofo quando o valor começa com = + - @ tab ou CR,
// e aplica RFC 4180 (aspas) quando há vírgula/aspas/quebra de linha.
export function csvCell(value: string | number | null | undefined): string {
  let s = value == null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}
