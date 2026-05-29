import prisma from '../../lib/prisma'

export async function listar() {
  return prisma.delegacia.findMany({ orderBy: { nome: 'asc' } })
}

export async function buscarPorId(id: number) {
  const item = await prisma.delegacia.findUnique({ where: { id } })
  if (!item) throw Object.assign(new Error('Delegacia não encontrada'), { status: 404 })
  return item
}

export async function criar(data: { nome: string }) {
  return prisma.delegacia.create({ data })
}

export async function editar(id: number, data: { nome?: string }) {
  return prisma.delegacia.update({ where: { id }, data })
}

export async function remover(id: number) {
  const vinculados = await prisma.participante.count({ where: { delegacia_id: id } })
  if (vinculados > 0) {
    throw Object.assign(
      new Error('Remova os participantes vinculados antes de excluir esta delegacia.'),
      { status: 409 }
    )
  }
  return prisma.delegacia.delete({ where: { id } })
}
