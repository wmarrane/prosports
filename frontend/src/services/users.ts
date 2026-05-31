import api from './api'
import type { User, UserCreatePayload, UserUpdatePayload } from '../types/user'

const BASE = '/users'

export const usersService = {
  listar: () => api.get<User[]>(BASE).then((r) => r.data),
  buscar: (id: number) => api.get<User>(`${BASE}/${id}`).then((r) => r.data),
  criar: (data: UserCreatePayload) => api.post<User>(BASE, data).then((r) => r.data),
  editar: (id: number, data: UserUpdatePayload) =>
    api.patch<User>(`${BASE}/${id}`, data).then((r) => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
  resetarSenha: (id: number, nova_senha: string) =>
    api.post<{ ok: true }>(`${BASE}/${id}/resetar-senha`, { nova_senha }).then((r) => r.data),
  alterarSenha: (senha_atual: string, nova_senha: string) =>
    api.post<{ ok: true }>('/auth/alterar-senha', { senha_atual, nova_senha }).then((r) => r.data),
}
