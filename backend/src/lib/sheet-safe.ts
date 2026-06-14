// Neutraliza injeção de fórmula em células de planilha (Excel/Sheets):
// prefixa ' quando o valor (string) começa com = + - @ tab ou CR.
// Não-strings passam intactos.
export function sheetSafe<T>(value: T): T | string {
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(value)) return `'${value}`
  return value
}
