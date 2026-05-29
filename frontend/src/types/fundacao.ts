export type Modalidade = {
  id: number
  nome: string
  descricao: string | null
  _count?: { categorias: number }
  criado_em: string
  atualizado_em: string
}

export type Genero = 'MASCULINO' | 'FEMININO' | 'MISTO' | 'LIVRE'

export type Categoria = {
  id: number
  modalidade_id: number
  modalidade: { id: number; nome: string }
  nome: string
  genero: Genero
  idade_min: number | null
  idade_max: number | null
  criado_em: string
  atualizado_em: string
}
