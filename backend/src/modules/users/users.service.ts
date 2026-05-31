import prisma from '../../lib/prisma'

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
