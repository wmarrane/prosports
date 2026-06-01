import prisma from '../../lib/prisma'

const INCLUDE = {
  competicao: true,
  municipio: true,
  anfitriao: { include: { municipio: true, inspetoria: true, delegacia: true } },
} as const

// Include estendido para a listagem: inclui modalidades da competição (com tipo)
// para filtros e contadores (modalidades/inscricoes/sorteios) por evento.
const LIST_INCLUDE = {
  competicao: {
    include: {
      modalidades: {
        select: {
          id: true,
          tipo_modalidade: { select: { tipo: true } },
        },
      },
    },
  },
  municipio: true,
  _count: { select: { inscricoes: true, sorteios: true } },
} as const

async function mapPrismaError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw Object.assign(
        new Error('Já existe um evento com este nome nesta competição.'),
        { status: 409 }
      )
    }
    throw err
  }
}

type EventoStatus = 'rascunho' | 'inscricoes' | 'pronto' | 'sorteado' | 'parcial'

type CreateInput = {
  nome: string
  data_hora: Date
  local: string
  organizador?: string
  status?: EventoStatus
  competicao_id: number
  municipio_id: number
  anfitriao_id?: number | null
}

export async function listar(competicao_id?: number) {
  return prisma.evento.findMany({
    where: competicao_id ? { competicao_id } : undefined,
    orderBy: { data_hora: 'desc' },
    include: LIST_INCLUDE,
  })
}

export async function buscarPorId(id: number) {
  const item = await prisma.evento.findUnique({
    where: { id },
    include: INCLUDE,
  })
  if (!item) throw Object.assign(new Error('Evento não encontrado'), { status: 404 })
  return item
}

export async function criar(data: CreateInput) {
  return mapPrismaError(() => prisma.evento.create({ data, include: INCLUDE }))
}

export async function editar(
  id: number,
  data: Partial<CreateInput>
) {
  return mapPrismaError(() => prisma.evento.update({ where: { id }, data, include: INCLUDE }))
}

export async function remover(id: number) {
  return prisma.evento.delete({ where: { id } })
}
