import api from './api'
import type { Inspetoria } from '../types/participante'

const BASE = '/inspetorias'

type InspetoriaPayload = { nome: string; delegacia_id: number }

export const inspetoriasService = {
  listar: (params?: { delegacia_id?: number }) =>
    api.get<Inspetoria[]>(BASE, { params }).then(r => r.data),
  buscar: (id: number) => api.get<Inspetoria>(`${BASE}/${id}`).then(r => r.data),
  criar: (data: InspetoriaPayload) => api.post<Inspetoria>(BASE, data).then(r => r.data),
  editar: (id: number, data: Partial<InspetoriaPayload>) =>
    api.put<Inspetoria>(`${BASE}/${id}`, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
}
