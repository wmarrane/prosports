export type CampoSubtitulo = 'subtitulo' | 'municipio' | 'inspetoria' | 'delegacia'

/** Layout do relatório de congresso técnico. */
export type ModeloCongresso = 'padrao' | 'jeesp'

export type Competicao = {
  id: number
  nome: string
  estados: string[]
  subtitulo_campos: CampoSubtitulo[]
  considerar_anfitriao: boolean
  subtitulo_municipio_por_modalidade?: boolean
  modelo_congresso?: ModeloCongresso
  criado_em: string
  atualizado_em: string
  _count?: {
    modalidades: number
    eventos: number
  }
}
