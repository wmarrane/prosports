import api from './api'
import type { Inscricao } from '../types/inscricao'

const BASE = '/inscricoes'

type InscricaoPayload = {
  evento_id: number
  modalidade_id: number
  participante_id: number
}

export const inscricoesService = {
  listar: (params?: { evento_id?: number; modalidade_id?: number }) =>
    api.get<Inscricao[]>(BASE, { params }).then(r => r.data),
  criar: (data: InscricaoPayload) => api.post<Inscricao>(BASE, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
}
