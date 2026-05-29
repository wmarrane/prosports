import api from './api'
import type { Modalidade } from '../types/modalidade'

const BASE = '/modalidades'

type ModalidadePayload = {
  nome: string
  sigla: string
  competicao_id: number
  tipo_modalidade_id: number
}

export const modalidadesService = {
  listar: (params?: { competicao_id?: number }) =>
    api.get<Modalidade[]>(BASE, { params }).then(r => r.data),
  buscar: (id: number) => api.get<Modalidade>(`${BASE}/${id}`).then(r => r.data),
  criar: (data: ModalidadePayload) => api.post<Modalidade>(BASE, data).then(r => r.data),
  editar: (id: number, data: Partial<ModalidadePayload>) =>
    api.put<Modalidade>(`${BASE}/${id}`, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
}
