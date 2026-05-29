import prisma from '../../lib/prisma'

export async function listar() {
  return prisma.tipoModalidade.findMany({ orderBy: { nome: 'asc' } })
}

export async function buscarPorId(id: number) {
  const item = await prisma.tipoModalidade.findUnique({ where: { id } })
  if (!item) throw Object.assign(new Error('Tipo de modalidade não encontrado'), { status: 404 })
  return item
}

export async function criar(data: { nome: string }) {
  return prisma.tipoModalidade.create({ data })
}

export async function editar(id: number, data: { nome?: string }) {
  return prisma.tipoModalidade.update({ where: { id }, data })
}

export async function remover(id: number) {
  const vinculadas = await prisma.modalidade.count({ where: { tipo_modalidade_id: id } })
  if (vinculadas > 0) {
    throw Object.assign(
      new Error('Remova as modalidades vinculadas antes de excluir este tipo.'),
      { status: 409 }
    )
  }
  return prisma.tipoModalidade.delete({ where: { id } })
}
