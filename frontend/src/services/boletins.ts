import api from './api'

export type Boletim = {
  id: number; evento_id: number; numero: number; titulo: string
  categoria: string; data_publicacao: string; filename: string
  public_url: string; size_bytes: number; criado_em: string; atualizado_em: string
}

const BASE = (eventoId: number) => `/eventos/${eventoId}/boletins`

export const boletinsService = {
  listar: (eventoId: number) => api.get<Boletim[]>(BASE(eventoId)).then(r => r.data),
  enviar: (eventoId: number, payload: { numero: number; titulo: string; categoria: string; data_publicacao: string; file: File }) => {
    const fd = new FormData()
    fd.append('file', payload.file)
    fd.append('numero', String(payload.numero))
    fd.append('titulo', payload.titulo)
    fd.append('categoria', payload.categoria)
    fd.append('data_publicacao', payload.data_publicacao)
    return api.post<Boletim>(BASE(eventoId), fd).then(r => r.data)
  },
  remover: (eventoId: number, boletimId: number) => api.delete(`${BASE(eventoId)}/${boletimId}`),
  substituir: (eventoId: number, boletimId: number, payload: { titulo?: string; categoria?: string; data_publicacao?: string; file?: File }) => {
    const fd = new FormData()
    if (payload.file) fd.append('file', payload.file)
    if (payload.titulo !== undefined) fd.append('titulo', payload.titulo)
    if (payload.categoria !== undefined) fd.append('categoria', payload.categoria)
    if (payload.data_publicacao !== undefined) fd.append('data_publicacao', payload.data_publicacao)
    return api.put<Boletim>(`${BASE(eventoId)}/${boletimId}`, fd).then(r => r.data)
  },
}
