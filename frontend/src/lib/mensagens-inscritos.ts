export type MensagemInscritos = {
  min: number
  max: number | null
  mensagem: string
  pular_sorteio: boolean
}

export function matchMensagem(regras: MensagemInscritos[], n: number): MensagemInscritos | null {
  for (const r of regras) {
    if (n >= r.min && (r.max == null || n <= r.max)) return r
  }
  return null
}
