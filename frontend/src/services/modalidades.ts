import api from './api'
import type { Modalidade, ChaveVersao } from '../types/modalidade'

const BASE = '/modalidades'

type ModalidadePayload = {
  nome: string
  sigla: string
  competicao_id: number
  tipo_modalidade_id: number
  chave_versao?: ChaveVersao
}

export const modalidadesService = {
  listar: (params?: { competicao_id?: number }) =>
    api.get<Modalidade[]>(BASE, { params }).then(r => r.data),
  buscar: (id: number) => api.get<Modalidade>(`${BASE}/${id}`).then(r => r.data),
  criar: (data: ModalidadePayload) => api.post<Modalidade>(BASE, data).then(r => r.data),
  editar: (id: number, data: Partial<ModalidadePayload>) =>
    api.put<Modalidade>(`${BASE}/${id}`, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
  importar: (competicao_id: number, file: File) => {
    const fd = new FormData()
    fd.append('arquivo', file)
    fd.append('competicao_id', String(competicao_id))
    return api.post<{ criados: number; atualizados: number; ignorados: number; erros: Array<{ linha: number; motivo: string }> }>(
      '/modalidades/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } }
    ).then(r => r.data)
  },
}
