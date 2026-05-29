import api from './api'
import type { Delegacia } from '../types/participante'

const BASE = '/delegacias'

export const delegaciasService = {
  listar: () => api.get<Delegacia[]>(BASE).then(r => r.data),
  buscar: (id: number) => api.get<Delegacia>(`${BASE}/${id}`).then(r => r.data),
  criar: (data: { nome: string }) => api.post<Delegacia>(BASE, data).then(r => r.data),
  editar: (id: number, data: { nome?: string }) => api.put<Delegacia>(`${BASE}/${id}`, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
}
