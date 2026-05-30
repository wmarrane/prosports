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

export type ImportRow = {
  nome: string
  municipio_uf: string
  municipio_nome: string
  subtitulo?: string
}

export type ImportRowResult = {
  linha: number
  nome: string
  status: 'criada' | 'duplicada' | 'erro'
  erro?: string
  participante_criado?: boolean
}

export type ImportResult = {
  rows: ImportRowResult[]
  contadores: {
    criadas: number
    duplicadas: number
    erros: number
    participantes_criados: number
  }
}
