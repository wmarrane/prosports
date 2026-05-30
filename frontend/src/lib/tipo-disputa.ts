import type { TipoDisputa } from '../types/modalidade'

export const TIPO_DISPUTA_LABEL: Record<TipoDisputa, string> = {
  grupos: 'Grupos',
  chaves: 'Chaves',
  especifico: 'Específico',
  ordem_entrada: 'Ordem de Entrada',
}

export const TIPO_DISPUTA_VALUES: TipoDisputa[] = ['grupos', 'chaves', 'especifico', 'ordem_entrada']
