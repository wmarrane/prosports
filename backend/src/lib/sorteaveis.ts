type Regra = { min: number; max: number | null; mensagem: string; pular_sorteio: boolean }

export function matchMensagem(regras: Regra[], n: number): Regra | null {
  for (const r of regras) {
    if (n >= r.min && (r.max == null || n <= r.max)) return r
  }
  return null
}

export function isSorteavel(m: { tipo: string; mensagens_inscritos?: unknown }, inscritos: number): boolean {
  if (m.tipo === 'especifico') return false
  if (inscritos <= 0) return false
  const regras = Array.isArray(m.mensagens_inscritos) ? (m.mensagens_inscritos as Regra[]) : []
  const regra = matchMensagem(regras, inscritos)
  if (regra?.pular_sorteio) return false
  return true
}
