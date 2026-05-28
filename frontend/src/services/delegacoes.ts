import api from './api'
import type { Delegacao } from '../types/fundacao'

const BASE = '/delegacoes'

export const delegacoesService = {
  listar: () => api.get<Delegacao[]>(BASE).then(r => r.data),
  buscar: (id: number) => api.get<Delegacao>(`${BASE}/${id}`).then(r => r.data),
  criar: (data: FormData) => api.post<Delegacao>(BASE, data).then(r => r.data),
  editar: (id: number, data: FormData) => api.put<Delegacao>(`${BASE}/${id}`, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
}
