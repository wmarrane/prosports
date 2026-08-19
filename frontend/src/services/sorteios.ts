import api from './api'
import type { Sorteio } from '../types/sorteio'

const BASE = '/sorteios'

type ExecutarPayload = {
  evento_id: number
  modalidade_id: number
}

export const sorteiosService = {
  listar: (params?: { evento_id?: number; modalidade_id?: number }) =>
    api.get<Sorteio[]>(BASE, { params }).then(r => r.data),
  executar: (data: ExecutarPayload) =>
    api.post<Sorteio>(`${BASE}/executar`, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
  removerTodosDoEvento: (evento_id: number) =>
    api.delete<{ count: number }>(`${BASE}/evento/${evento_id}`).then(r => r.data),
  metades: (numeroInscrito: number) =>
    api.get<{ numero_inscrito: number; cima: number; baixo: number }>(`${BASE}/metades/${numeroInscrito}`).then(r => r.data),
}
