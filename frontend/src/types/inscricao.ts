import type { Participante } from './participante'

export type MetadeChave = 'cima' | 'baixo'

export type Inscricao = {
  id: number
  evento_id: number
  modalidade_id: number
  participante_id: number
  participante: Participante
  subtitulo?: string | null
  municipio?: { id: number; nome: string; uf: string } | null
  metade_chave?: MetadeChave | null
  criado_em: string
  atualizado_em: string
}

export type ImportRow = {
  nome: string
  municipio_uf?: string
  municipio_nome: string
  subtitulo?: string
  metade?: MetadeChave
}

export type ImportRowResult = {
  linha: number
  nome: string
  status: 'criada' | 'duplicada' | 'erro'
  erro?: string
}

export type ImportResult = {
  rows: ImportRowResult[]
  contadores: {
    criadas: number
    duplicadas: number
    erros: number
    nao_cadastrados: number
  }
}
