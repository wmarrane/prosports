import api from './api'
import type { Competicao } from '../types/competicao'

const BASE = '/competicoes'

type CompeticaoPayload = {
  nome: string
  estados: string[]
  subtitulo_campos?: string[]
  considerar_anfitriao?: boolean
}

export const competicoesService = {
  listar: () => api.get<Competicao[]>(BASE).then(r => r.data),
  buscar: (id: number) => api.get<Competicao>(`${BASE}/${id}`).then(r => r.data),
  criar: (data: CompeticaoPayload) => api.post<Competicao>(BASE, data).then(r => r.data),
  editar: (id: number, data: Partial<CompeticaoPayload>) => api.put<Competicao>(`${BASE}/${id}`, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
}
