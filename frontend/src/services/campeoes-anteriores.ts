import api from './api'
import type { CampeaoAnterior } from '../types/campeao-anterior'

const BASE = '/campeoes-anteriores'

type CampeaoPayload = {
  evento_id: number
  modalidade_id: number
  participante_id: number
  posicao: number  // 1-12
}

export const campeoesAnterioresService = {
  listar: (params?: { evento_id?: number; modalidade_id?: number }) =>
    api.get<CampeaoAnterior[]>(BASE, { params }).then(r => r.data),
  criar: (data: CampeaoPayload) => api.post<CampeaoAnterior>(BASE, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
}
