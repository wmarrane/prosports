import type { Competicao } from './competicao'
import type { Municipio } from './municipio'
import type { TipoDisputa } from './modalidade'
import type { Participante } from './participante'

export type EventoStatus = 'rascunho' | 'inscricoes' | 'pronto' | 'sorteado' | 'parcial' | 'suspenso'

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
  data_inicio?: string | null
  data_fim?: string | null
  site_publicado_em: string | null
  criado_em: string
  atualizado_em: string
  _count?: {
    inscricoes: number
    sorteios: number
  }
  modalidades_sorteaveis?: number
  modalidades_pendentes?: number
  modalidades_distintas?: number
  total_participantes?: number
  comissao?: { usuario: { id: number; nome: string } }[]
}
