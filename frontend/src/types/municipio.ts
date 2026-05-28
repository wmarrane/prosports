export type Municipio = {
  id: number
  codigo_ibge: string
  nome: string
  uf: string
  criado_em: string
  atualizado_em: string
}

export type MunicipiosPage = {
  data: Municipio[]
  total: number
  page: number
  limit: number
}

export type ImportResumo = {
  criados: number
  atualizados: number
  ignorados: number
  erros: { linha: number; motivo: string }[]
}
