export type Role = 'ADMIN' | 'PARTICIPANTE' | 'VIEWER' | 'COMISSAO_TECNICA'

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
