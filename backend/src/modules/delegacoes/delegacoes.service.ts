import prisma from '../../lib/prisma'
import { deleteFile } from '../../lib/upload'

const SUBDIR = 'delegacoes'

export async function listar() {
  return prisma.delegacao.findMany({ orderBy: { nome: 'asc' } })
}

export async function buscarPorId(id: number) {
  const item = await prisma.delegacao.findUnique({ where: { id } })
  if (!item) throw Object.assign(new Error('Delegação não encontrada'), { status: 404 })
  return item
}

export async function criar(data: { nome: string; municipio: string; estado: string; logo_path?: string }) {
  return prisma.delegacao.create({ data })
}

export async function editar(id: number, data: { nome?: string; municipio?: string; estado?: string; logo_path?: string }, oldLogoPath?: string | null) {
  if (data.logo_path && oldLogoPath) {
    deleteFile(SUBDIR, oldLogoPath)
  }
  return prisma.delegacao.update({ where: { id }, data })
}

export async function remover(id: number) {
  const item = await buscarPorId(id)
  if (item.logo_path) deleteFile(SUBDIR, item.logo_path)
  return prisma.delegacao.delete({ where: { id } })
}
