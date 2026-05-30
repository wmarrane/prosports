import type { Participante } from './participante'

export type Inscricao = {
  id: number
  evento_id: number
  modalidade_id: number
  participante_id: number
  participante: Participante
  criado_em: string
  atualizado_em: string
}
