import type { Competicao } from './competicao'
import type { Municipio } from './municipio'

export type EventoStatus = 'rascunho' | 'inscricoes' | 'pronto' | 'sorteado' | 'parcial'

export type Evento = {
  id: number
  nome: string
  data_hora: string
  local: string
  organizador: string | null
  status: EventoStatus
  competicao_id: number
  competicao: Competicao
  municipio_id: number
  municipio: Municipio
  criado_em: string
  atualizado_em: string
}
