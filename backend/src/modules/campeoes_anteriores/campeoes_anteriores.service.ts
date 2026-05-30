import prisma from '../../lib/prisma'

const INCLUDE = { participante: true } as const

async function mapPrismaError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw Object.assign(
        new Error('Já existe campeão cadastrado para esta posição.'),
        { status: 409 },
      )
    }
    throw err
  }
}

type Posicao = 1 | 2 | 3

type CreateInput = {
  evento_id: number
  modalidade_id: number
  participante_id: number
  posicao: Posicao
}

export async function listar(filtros: { evento_id?: number; modalidade_id?: number }) {
  const where: { evento_id?: number; modalidade_id?: number } = {}
  if (filtros.evento_id !== undefined) where.evento_id = filtros.evento_id
  if (filtros.modalidade_id !== undefined) where.modalidade_id = filtros.modalidade_id
  return prisma.campeaoAnterior.findMany({
    where,
    orderBy: [{ modalidade_id: 'asc' }, { posicao: 'asc' }],
    include: INCLUDE,
  })
}

export async function criar(data: CreateInput) {
  const [evento, modalidade] = await Promise.all([
    prisma.evento.findUnique({ where: { id: data.evento_id }, select: { competicao_id: true } }),
    prisma.modalidade.findUnique({ where: { id: data.modalidade_id }, select: { competicao_id: true } }),
  ])
  if (!evento) throw Object.assign(new Error('Evento não encontrado'), { status: 404 })
  if (!modalidade) throw Object.assign(new Error('Modalidade não encontrada'), { status: 404 })
  if (evento.competicao_id !== modalidade.competicao_id) {
    throw Object.assign(
      new Error('A modalidade não pertence à competição deste evento.'),
      { status: 400 },
    )
  }
  return mapPrismaError(() => prisma.campeaoAnterior.create({ data, include: INCLUDE }))
}

export async function remover(id: number) {
  return prisma.campeaoAnterior.delete({ where: { id } })
}
