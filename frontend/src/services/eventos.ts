import api from './api'
import type { Evento } from '../types/evento'

const BASE = '/eventos'

type EventoPayload = {
  nome: string
  data_hora: string
  local: string
  organizador?: string
  status?: 'rascunho' | 'inscricoes' | 'pronto' | 'sorteado' | 'parcial'
  competicao_id: number
  municipio_id: number
  anfitriao_id?: number | null
}

export const eventosService = {
  listar: (params?: { competicao_id?: number }) =>
    api.get<Evento[]>(BASE, { params }).then(r => r.data),
  buscar: (id: number) => api.get<Evento>(`${BASE}/${id}`).then(r => r.data),
  criar: (data: EventoPayload) => api.post<Evento>(BASE, data).then(r => r.data),
  editar: (id: number, data: Partial<EventoPayload>) =>
    api.put<Evento>(`${BASE}/${id}`, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
}
