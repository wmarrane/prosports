import api from './api'
import type { Inspetoria } from '../types/participante'

const BASE = '/inspetorias'

export const inspetoriasService = {
  listar: () => api.get<Inspetoria[]>(BASE).then(r => r.data),
  buscar: (id: number) => api.get<Inspetoria>(`${BASE}/${id}`).then(r => r.data),
  criar: (data: { nome: string }) => api.post<Inspetoria>(BASE, data).then(r => r.data),
  editar: (id: number, data: { nome?: string }) => api.put<Inspetoria>(`${BASE}/${id}`, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
}
