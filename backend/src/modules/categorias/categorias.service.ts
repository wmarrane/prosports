import prisma from '../../lib/prisma'
import { Genero } from '@prisma/client'

export async function listar(modalidade_id?: number) {
  return prisma.categoria.findMany({
    where: modalidade_id ? { modalidade_id } : undefined,
    orderBy: [{ modalidade: { nome: 'asc' } }, { nome: 'asc' }],
    include: { modalidade: { select: { id: true, nome: true } } },
  })
}

export async function buscarPorId(id: number) {
  const item = await prisma.categoria.findUnique({
    where: { id },
    include: { modalidade: { select: { id: true, nome: true } } },
  })
  if (!item) throw Object.assign(new Error('Categoria não encontrada'), { status: 404 })
  return item
}

export async function criar(data: {
  modalidade_id: number
  nome: string
  genero: Genero
  idade_min?: number
  idade_max?: number
}) {
  if (data.idade_min !== undefined && data.idade_max !== undefined) {
    if (data.idade_min >= data.idade_max) {
      throw Object.assign(new Error('idade_min deve ser menor que idade_max'), { status: 400 })
    }
  }
  return prisma.categoria.create({ data })
}

export async function editar(id: number, data: {
  modalidade_id?: number
  nome?: string
  genero?: Genero
  idade_min?: number | null
  idade_max?: number | null
}) {
  await buscarPorId(id)
  if (data.idade_min !== undefined && data.idade_max !== undefined &&
      data.idade_min !== null && data.idade_max !== null) {
    if (data.idade_min >= data.idade_max) {
      throw Object.assign(new Error('idade_min deve ser menor que idade_max'), { status: 400 })
    }
  }
  return prisma.categoria.update({ where: { id }, data })
}

export async function remover(id: number) {
  await buscarPorId(id)
  return prisma.categoria.delete({ where: { id } })
}
