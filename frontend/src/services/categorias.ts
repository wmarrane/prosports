import api from './api'
import type { Categoria, Genero } from '../types/fundacao'

const BASE = '/categorias'

type CriarCategoria = { modalidade_id: number; nome: string; genero: Genero; idade_min?: number; idade_max?: number }

export const categoriasService = {
  listar: (modalidade_id?: number) =>
    api.get<Categoria[]>(BASE, { params: modalidade_id ? { modalidade_id } : {} }).then(r => r.data),
  buscar: (id: number) => api.get<Categoria>(`${BASE}/${id}`).then(r => r.data),
  criar: (data: CriarCategoria) => api.post<Categoria>(BASE, data).then(r => r.data),
  editar: (id: number, data: Partial<CriarCategoria>) => api.put<Categoria>(`${BASE}/${id}`, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
}
