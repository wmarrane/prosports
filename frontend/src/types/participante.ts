import type { Municipio } from './municipio'

export type Delegacia = {
  id: number
  nome: string
  criado_em: string
  atualizado_em: string
}

export type Inspetoria = {
  id: number
  nome: string
  delegacia_id: number
  delegacia?: Delegacia
  criado_em: string
  atualizado_em: string
}

export type Participante = {
  id: number
  nome: string
  subtitulo: string | null
  inspetoria_id: number | null
  inspetoria: Inspetoria | null
  delegacia_id: number | null
  delegacia: Delegacia | null
  municipio_id: number
  municipio: Municipio
  criado_em: string
  atualizado_em: string
}
