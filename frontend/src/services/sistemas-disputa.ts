import api from './api'

export type SistemaGrupos = {
  id: number
  competicao_id: number
  quantidade_equipes: number
  quantidade_grupos: number
  grupos_3_componentes: number
  grupos_4_componentes: number
  numero_classificados: number
}

export type SistemaChaves = {
  id: number
  competicao_id: number
  numero_inscrito: number
  posicao_primeiro_cabeca: number
  posicao_segundo_cabeca: number
  posicao_terceiro_cabeca: number
  posicao_quarto_cabeca: number
}

export type GruposPayload = Omit<SistemaGrupos, 'id'>
export type ChavesPayload = Omit<SistemaChaves, 'id'>

export type CopiarResultado = { grupos_copiados: number; chaves_copiadas: number }

const BASE = '/sistemas-disputa'

export const sistemasDisputaService = {
  grupos: {
    listar: (competicao_id: number) =>
      api.get<SistemaGrupos[]>(`${BASE}/grupos`, { params: { competicao_id } }).then(r => r.data),
    criar: (data: GruposPayload) => api.post<SistemaGrupos>(`${BASE}/grupos`, data).then(r => r.data),
    editar: (id: number, data: Partial<GruposPayload>) =>
      api.put<SistemaGrupos>(`${BASE}/grupos/${id}`, data).then(r => r.data),
    remover: (id: number) => api.delete(`${BASE}/grupos/${id}`),
  },
  chaves: {
    listar: (competicao_id: number) =>
      api.get<SistemaChaves[]>(`${BASE}/chaves`, { params: { competicao_id } }).then(r => r.data),
    criar: (data: ChavesPayload) => api.post<SistemaChaves>(`${BASE}/chaves`, data).then(r => r.data),
    editar: (id: number, data: Partial<ChavesPayload>) =>
      api.put<SistemaChaves>(`${BASE}/chaves/${id}`, data).then(r => r.data),
    remover: (id: number) => api.delete(`${BASE}/chaves/${id}`),
  },
  copiar: (data: { origem_id: number; destino_id: number; tipo: 'grupos' | 'chaves' | 'ambos' }) =>
    api.post<CopiarResultado>(`${BASE}/copiar`, data).then(r => r.data),
}
