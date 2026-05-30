import prisma from '../../lib/prisma'

const INCLUDE = { competicao: true, tipo_modalidade: true } as const

async function mapPrismaError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw Object.assign(
        new Error('Já existe uma modalidade com este nome ou sigla nesta competição.'),
        { status: 409 }
      )
    }
    throw err
  }
}

export async function listar(competicao_id?: number) {
  return prisma.modalidade.findMany({
    where: competicao_id ? { competicao_id } : undefined,
    orderBy: [{ competicao: { nome: 'asc' } }, { nome: 'asc' }],
    include: INCLUDE,
  })
}

export async function buscarPorId(id: number) {
  const item = await prisma.modalidade.findUnique({
    where: { id },
    include: INCLUDE,
  })
  if (!item) throw Object.assign(new Error('Modalidade não encontrada'), { status: 404 })
  return item
}

export async function criar(data: {
  nome: string
  sigla: string
  competicao_id: number
  tipo_modalidade_id: number
}) {
  return mapPrismaError(() => prisma.modalidade.create({ data, include: INCLUDE }))
}

export async function editar(
  id: number,
  data: Partial<{ nome: string; sigla: string; competicao_id: number; tipo_modalidade_id: number }>
) {
  return mapPrismaError(async () => {
    if (data.tipo_modalidade_id !== undefined) {
      const atual = await prisma.modalidade.findUnique({
        where: { id },
        select: { tipo_modalidade: { select: { tipo: true } } },
      })
      if (!atual) throw Object.assign(new Error('Modalidade não encontrada'), { status: 404 })
      const novo = await prisma.tipoModalidade.findUnique({
        where: { id: data.tipo_modalidade_id },
        select: { tipo: true },
      })
      if (!novo) throw Object.assign(new Error('Tipo de modalidade não encontrado'), { status: 400 })

      if (novo.tipo !== atual.tipo_modalidade.tipo) {
        return prisma.$transaction(async tx => {
          await tx.sorteio.deleteMany({ where: { modalidade_id: id } })
          return tx.modalidade.update({ where: { id }, data, include: INCLUDE })
        })
      }
    }
    return prisma.modalidade.update({ where: { id }, data, include: INCLUDE })
  })
}

export async function remover(id: number) {
  return prisma.modalidade.delete({ where: { id } })
}
