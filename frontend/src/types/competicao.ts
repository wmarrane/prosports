export type Competicao = {
  id: number
  nome: string
  estados: string[]
  adicionar_subtitulo: boolean
  criado_em: string
  atualizado_em: string
  _count?: {
    modalidades: number
    eventos: number
  }
}
