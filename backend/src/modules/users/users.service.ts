import prisma from '../../lib/prisma'
import { hashSenha, revogarTodosRefreshTokens } from '../auth/auth.service'
import type { Role } from '@prisma/client'

export type CriarPayload = {
  nome: string
  email: string
  role: Role
  senha: string
}

export type EditarPayload = {
  nome?: string
  email?: string
  role?: Role
  ativo?: boolean
}

export type CallerCtx = {
  sub: number   // id do usuário autenticado
  role: string
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

async function ensureNotLastActiveAdmin(targetId: number) {
  const adminsAtivos = await prisma.user.count({
    where: { role: 'ADMIN', ativo: true, NOT: { id: targetId } },
  })
  if (adminsAtivos === 0) {
    throw Object.assign(
      new Error('Operação negada: este é o último ADMIN ativo do sistema.'),
      { status: 400 }
    )
  }
}

export async function editar(id: number, payload: EditarPayload, caller: CallerCtx) {
  const alvo = await prisma.user.findUnique({ where: { id } })
  if (!alvo) throw Object.assign(new Error('Usuário não encontrado'), { status: 404 })

  // Auto-proteções
  if (caller.sub === id) {
    if (payload.ativo === false) {
      throw Object.assign(new Error('Você não pode desativar a si mesmo.'), { status: 400 })
    }
    if (payload.role && payload.role !== alvo.role && alvo.role === 'ADMIN') {
      throw Object.assign(new Error('Você não pode rebaixar a si mesmo.'), { status: 400 })
    }
  }

  // Último admin ativo
  const desativando = payload.ativo === false
  const rebaixando = payload.role && payload.role !== 'ADMIN'
  if (alvo.role === 'ADMIN' && alvo.ativo && (desativando || rebaixando)) {
    await ensureNotLastActiveAdmin(id)
  }

  // Email único
  if (payload.email && payload.email !== alvo.email) {
    const conflict = await prisma.user.findFirst({
      where: { email: payload.email, NOT: { id } },
    })
    if (conflict) {
      throw Object.assign(new Error('Email já cadastrado'), { status: 400 })
    }
  }

  return prisma.user.update({
    where: { id },
    data: payload,
    select: USER_SELECT,
  })
}

export async function remover(id: number, caller: CallerCtx) {
  if (caller.sub === id) {
    throw Object.assign(new Error('Você não pode remover a si mesmo.'), { status: 400 })
  }
  const alvo = await prisma.user.findUnique({ where: { id } })
  if (!alvo) throw Object.assign(new Error('Usuário não encontrado'), { status: 404 })

  if (alvo.role === 'ADMIN' && alvo.ativo) {
    await ensureNotLastActiveAdmin(id)
  }

  return prisma.user.delete({ where: { id } })
}

export async function resetarSenha(id: number, novaSenha: string) {
  const alvo = await prisma.user.findUnique({ where: { id } })
  if (!alvo) throw Object.assign(new Error('Usuário não encontrado'), { status: 404 })

  const senha_hash = await hashSenha(novaSenha)
  await prisma.user.update({
    where: { id },
    data: { senha_hash, tentativas_login: 0, bloqueado_ate: null },
  })
  await revogarTodosRefreshTokens(id)
  return { ok: true }
}
