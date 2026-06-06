import type { Competicao } from './competicao'
import type { Municipio } from './municipio'
import type { TipoDisputa } from './modalidade'
import type { Participante } from './participante'

export type EventoStatus = 'rascunho' | 'inscricoes' | 'pronto' | 'sorteado' | 'parcial'

// Competicao com modalidades incluídas (para o list view)
export type CompeticaoComModalidades = Competicao & {
  modalidades?: Array<{
    id: number
    tipo_modalidade: { tipo: TipoDisputa }
  }>
}

export type Evento = {
  id: number
  nome: string
  data_hora: string
  local: string
  organizador: string | null
  status: EventoStatus
  competicao_id: number
  competicao: CompeticaoComModalidades
  municipio_id: number
  municipio: Municipio
  anfitriao_id: number | null
  anfitriao: Participante | null
  logo_url: string | null
  site_publicado_em: string | null
  criado_em: string
  atualizado_em: string
  _count?: {
    inscricoes: number
    sorteios: number
  }
}
