import { matchMensagem, type MensagemInscritos } from './mensagens-inscritos'

export type ModalidadeSorteavel = {
  id: number
  tipo: string
  mensagens_inscritos?: MensagemInscritos[]
}

// Uma modalidade é "sorteável" num evento quando: não é do tipo 'especifico'
// (sem sorteio automático), tem inscritos (> 0) e a regra de mensagem que casa
// com o nº de inscritos não marca "pular sorteio".
export function isSorteavel(m: ModalidadeSorteavel, inscritos: number): boolean {
  if (m.tipo === 'especifico') return false
  if (inscritos <= 0) return false
  const regra = matchMensagem(m.mensagens_inscritos ?? [], inscritos)
  if (regra?.pular_sorteio) return false
  return true
}
