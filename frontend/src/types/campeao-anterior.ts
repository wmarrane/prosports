import type { Participante } from './participante'

export type CampeaoAnterior = {
  id: number
  evento_id: number
  modalidade_id: number
  participante_id: number
  participante: Participante
  posicao: 1 | 2 | 3
  criado_em: string
  atualizado_em: string
}
