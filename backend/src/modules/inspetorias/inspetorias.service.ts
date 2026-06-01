import prisma from '../../lib/prisma'

export async function listar(filtros?: { delegacia_id?: number }) {
  return prisma.inspetoria.findMany({
    where: filtros?.delegacia_id ? { delegacia_id: filtros.delegacia_id } : undefined,
    include: { delegacia: true },
    orderBy: { nome: 'asc' },
  })
}

export async function buscarPorId(id: number) {
  const item = await prisma.inspetoria.findUnique({
    where: { id },
    include: { delegacia: true },
  })
  if (!item) throw Object.assign(new Error('Inspetoria não encontrada'), { status: 404 })
  return item
}

export async function criar(data: { nome: string; delegacia_id: number }) {
  return prisma.inspetoria.create({ data, include: { delegacia: true } })
}

export async function editar(id: number, data: { nome?: string; delegacia_id?: number }) {
  return prisma.inspetoria.update({ where: { id }, data, include: { delegacia: true } })
}

export async function remover(id: number) {
  const vinculados = await prisma.participante.count({ where: { inspetoria_id: id } })
  if (vinculados > 0) {
    throw Object.assign(
      new Error('Remova os participantes vinculados antes de excluir esta inspetoria.'),
      { status: 409 }
    )
  }
  return prisma.inspetoria.delete({ where: { id } })
}
