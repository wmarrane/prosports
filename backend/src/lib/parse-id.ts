// Converte um parâmetro de rota em inteiro positivo; lança erro 400 se inválido.
export function parseIntParam(value: string | undefined, name = 'id'): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) {
    throw Object.assign(new Error(`Parâmetro ${name} inválido.`), { status: 400 })
  }
  return n
}
