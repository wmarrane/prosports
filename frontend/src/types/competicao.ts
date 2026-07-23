export type CampoSubtitulo = 'subtitulo' | 'municipio' | 'inspetoria' | 'delegacia'

export type Competicao = {
  id: number
  nome: string
  estados: string[]
  subtitulo_campos: CampoSubtitulo[]
  considerar_anfitriao: boolean
  subtitulo_municipio_por_modalidade?: boolean
  criado_em: string
  atualizado_em: string
  _count?: {
    modalidades: number
    eventos: number
  }
}
