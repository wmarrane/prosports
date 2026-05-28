import prisma from '../../lib/prisma'

export async function listar() {
  return prisma.modalidade.findMany({
    orderBy: { nome: 'asc' },
    include: { _count: { select: { categorias: true } } },
  })
}

export async function buscarPorId(id: number) {
  const item = await prisma.modalidade.findUnique({
    where: { id },
    include: { categorias: true },
  })
  if (!item) throw Object.assign(new Error('Modalidade não encontrada'), { status: 404 })
  return item
}

export async function criar(data: { nome: string; descricao?: string }) {
  return prisma.modalidade.create({ data })
}

export async function editar(id: number, data: { nome?: string; descricao?: string }) {
  await buscarPorId(id)
  return prisma.modalidade.update({ where: { id }, data })
}

export async function remover(id: number) {
  const item = await prisma.modalidade.findUnique({
    where: { id },
    include: { _count: { select: { categorias: true } } },
  })
  if (!item) throw Object.assign(new Error('Modalidade não encontrada'), { status: 404 })
  if (item._count.categorias > 0) {
    throw Object.assign(new Error('Remova as categorias vinculadas antes de excluir esta modalidade.'), { status: 409 })
  }
  return prisma.modalidade.delete({ where: { id } })
}
