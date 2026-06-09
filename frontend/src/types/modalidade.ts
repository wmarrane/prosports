import type { Competicao } from './competicao'
import type { MensagemInscritos } from '../lib/mensagens-inscritos'

export type TipoDisputa = 'grupos' | 'chaves' | 'especifico' | 'ordem_entrada'

export type TipoModalidade = {
  id: number
  nome: string
  tipo: TipoDisputa
  criado_em: string
  atualizado_em: string
}

export type ChaveVersao = 'V1' | 'V2'

export type Modalidade = {
  id: number
  nome: string
  sigla: string
  chave_versao: ChaveVersao
  mensagens_inscritos: MensagemInscritos[]
  competicao_id: number
  competicao: Competicao
  tipo_modalidade_id: number
  tipo_modalidade: TipoModalidade
  criado_em: string
  atualizado_em: string
}
