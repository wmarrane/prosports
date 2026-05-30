import type { Participante } from './participante'

export type CampeaoAnterior = {
  id: number
  evento_id: number
  modalidade_id: number
  participante_id: number
  participante: Participante
  posicao: number  // 1-12
  criado_em: string
  atualizado_em: string
}
