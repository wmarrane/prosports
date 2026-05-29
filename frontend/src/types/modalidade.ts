import type { Competicao } from './competicao'

export type TipoModalidade = {
  id: number
  nome: string
  criado_em: string
  atualizado_em: string
}

export type Modalidade = {
  id: number
  nome: string
  sigla: string
  competicao_id: number
  competicao: Competicao
  tipo_modalidade_id: number
  tipo_modalidade: TipoModalidade
  criado_em: string
  atualizado_em: string
}
