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
  uploadLogo: (id: number, file: File) => {
    const fd = new FormData()
    fd.append('logo', file)
    return api.post<Evento>(`${BASE}/${id}/logo`, fd).then(r => r.data)
  },
  removerLogo: (id: number) => api.delete<Evento>(`${BASE}/${id}/logo`).then(r => r.data),
  publicar: (id: number) => api.post(`${BASE}/${id}/publicar`).then(r => r.data),
  despublicar: (id: number) => api.post(`${BASE}/${id}/despublicar`).then(r => r.data),
  getAnfitriaoOrdem: (eventoId: number) =>
    api.get<Record<number, number>>(`${BASE}/${eventoId}/anfitriao-ordem`).then(r => r.data),
  setAnfitriaoOrdem: (eventoId: number, modalidade_id: number, posicao: number | null) =>
    api.put<{ posicao: number | null }>(`${BASE}/${eventoId}/anfitriao-ordem`, { modalidade_id, posicao }).then(r => r.data),
}
