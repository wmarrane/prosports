import api from './api'
import type { TipoModalidade } from '../types/modalidade'

const BASE = '/tipos-modalidade'

export const tiposModalidadeService = {
  listar: () => api.get<TipoModalidade[]>(BASE).then(r => r.data),
  buscar: (id: number) => api.get<TipoModalidade>(`${BASE}/${id}`).then(r => r.data),
  criar: (data: { nome: string }) => api.post<TipoModalidade>(BASE, data).then(r => r.data),
  editar: (id: number, data: { nome?: string }) => api.put<TipoModalidade>(`${BASE}/${id}`, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
}
