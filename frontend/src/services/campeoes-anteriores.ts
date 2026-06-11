import api from './api'
import type { CampeaoAnterior } from '../types/campeao-anterior'

const BASE = '/campeoes-anteriores'

type CampeaoPayload = {
  evento_id: number
  modalidade_id: number
  participante_id: number
  posicao: number  // 1-12
}

export type ImportCampeaoRow = {
  posicao: number
  nome: string
  municipio_uf: string
  municipio_nome: string
  subtitulo?: string
}
export type ImportCampeaoRowResult = {
  linha: number
  posicao: number
  nome: string
  status: 'criada' | 'duplicada' | 'erro'
  erro?: string
}
export type ImportCampeoesResult = {
  rows: ImportCampeaoRowResult[]
  contadores: { criadas: number; duplicadas: number; erros: number }
}

export const campeoesAnterioresService = {
  listar: (params?: { evento_id?: number; modalidade_id?: number }) =>
    api.get<CampeaoAnterior[]>(BASE, { params }).then(r => r.data),
  criar: (data: CampeaoPayload) => api.post<CampeaoAnterior>(BASE, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
  importar: (data: { evento_id: number; modalidade_id: number; dry_run: boolean; rows: ImportCampeaoRow[] }) =>
    api.post<ImportCampeoesResult>(`${BASE}/import`, data).then(r => r.data),
}
