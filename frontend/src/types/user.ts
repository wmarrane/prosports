import type { Role } from './auth'

export type User = {
  id: number
  nome: string
  email: string
  role: Role
  ativo: boolean
  ultimo_login: string | null
  criado_em: string
  atualizado_em: string
}

export type UserCreatePayload = {
  nome: string
  email: string
  role: Role
  senha: string
}

export type UserUpdatePayload = Partial<{
  nome: string
  email: string
  role: Role
  ativo: boolean
}>
