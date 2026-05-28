export type Role = 'ADMIN' | 'DELEGACAO' | 'VIEWER'

export type AuthUser = {
  id: number
  nome: string
  email: string
  role: Role
}

export type LoginPayload = {
  email: string
  senha: string
}
