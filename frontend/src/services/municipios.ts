import api from './api'
import type { Municipio, MunicipiosPage, ImportResumo } from '../types/municipio'

const BASE = '/municipios'

type ListarParams = { uf?: string; q?: string; page?: number; limit?: number }

export const municipiosService = {
  listar: (params: ListarParams = {}) =>
    api.get<MunicipiosPage>(BASE, { params }).then((r) => r.data),
  buscar: (id: number) => api.get<Municipio>(`${BASE}/${id}`).then((r) => r.data),
  criar: (data: { codigo_ibge: string; nome: string; uf: string }) =>
    api.post<Municipio>(BASE, data).then((r) => r.data),
  editar: (id: number, data: Partial<{ codigo_ibge: string; nome: string; uf: string }>) =>
    api.put<Municipio>(`${BASE}/${id}`, data).then((r) => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
  importar: (file: File) => {
    const fd = new FormData()
    fd.append('arquivo', file)
    return api
      .post<ImportResumo>(`${BASE}/import`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data)
  },
}
