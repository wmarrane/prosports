import api from './api'
import type { Participante } from '../types/participante'

const BASE = '/participantes'

type ParticipantePayload = {
  nome: string
  subtitulo?: string
  inspetoria_id?: number | null
  delegacia_id?: number | null
  municipio_id: number
}

export const participantesService = {
  listar: () => api.get<Participante[]>(BASE).then(r => r.data),
  buscar: (id: number) => api.get<Participante>(`${BASE}/${id}`).then(r => r.data),
  criar: (data: ParticipantePayload) => api.post<Participante>(BASE, data).then(r => r.data),
  editar: (id: number, data: Partial<ParticipantePayload>) => api.put<Participante>(`${BASE}/${id}`, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
}
