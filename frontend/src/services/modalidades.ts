import api from './api'
import type { Modalidade } from '../types/fundacao'

const BASE = '/modalidades'

export const modalidadesService = {
  listar: () => api.get<Modalidade[]>(BASE).then(r => r.data),
  buscar: (id: number) => api.get<Modalidade>(`${BASE}/${id}`).then(r => r.data),
  criar: (data: { nome: string; descricao?: string }) => api.post<Modalidade>(BASE, data).then(r => r.data),
  editar: (id: number, data: { nome?: string; descricao?: string }) => api.put<Modalidade>(`${BASE}/${id}`, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
}
