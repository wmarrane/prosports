import prisma from '../../lib/prisma'
import { hashSenha } from '../auth/auth.service'
import type { Role } from '@prisma/client'

export type CriarPayload = {
  nome: string
  email: string
  role: Role
  senha: string
}

const USER_SELECT = {
  id: true,
  nome: true,
  email: true,
  role: true,
  ativo: true,
  ultimo_login: true,
  criado_em: true,
  atualizado_em: true,
  senha_hash: false,
  tentativas_login: false,
  bloqueado_ate: false,
} as const

export async function listar() {
  return prisma.user.findMany({
    orderBy: { nome: 'asc' },
    select: USER_SELECT,
  })
}

export async function buscarPorId(id: number) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: USER_SELECT,
  })
  if (!user) throw Object.assign(new Error('Usuário não encontrado'), { status: 404 })
  return user
}

export async function criar(payload: CriarPayload) {
  const exists = await prisma.user.findFirst({ where: { email: payload.email } })
  if (exists) {
    throw Object.assign(new Error('Email já cadastrado'), { status: 400 })
  }
  const senha_hash = await hashSenha(payload.senha)
  return prisma.user.create({
    data: {
      nome: payload.nome,
      email: payload.email,
      role: payload.role,
      senha_hash,
    },
    select: USER_SELECT,
  })
}
