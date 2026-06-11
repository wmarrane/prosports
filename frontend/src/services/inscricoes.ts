import api from './api'
import type { Inscricao, ImportRow, ImportResult } from '../types/inscricao'

const BASE = '/inscricoes'

type InscricaoPayload = {
  evento_id: number
  modalidade_id: number
  participante_id: number
}

type ImportPayload = {
  evento_id: number
  modalidade_id: number
  dry_run: boolean
  rows: ImportRow[]
}

type BulkPayload = {
  evento_id: number
  modalidade_id: number
  participante_ids: number[]
}

export type BulkResult = {
  criadas: number
  duplicadas: number
  erros: Array<{ participante_id: number; erro: string }>
}

export const inscricoesService = {
  listar: (params?: { evento_id?: number; modalidade_id?: number }) =>
    api.get<Inscricao[]>(BASE, { params }).then(r => r.data),
  counts: (evento_id: number) =>
    api.get<Record<number, number>>(`${BASE}/counts`, { params: { evento_id } }).then(r => r.data),
  criar: (data: InscricaoPayload) => api.post<Inscricao>(BASE, data).then(r => r.data),
  criarBulk: (data: BulkPayload) => api.post<BulkResult>(`${BASE}/bulk`, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
  removerTodosDaModalidade: (evento_id: number, modalidade_id: number) =>
    api.delete<{ count: number }>(`${BASE}/evento/${evento_id}/modalidade/${modalidade_id}`).then(r => r.data),
  importar: (data: ImportPayload) =>
    api.post<ImportResult>(`${BASE}/import`, data).then(r => r.data),
}
