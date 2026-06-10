import prisma from '../../lib/prisma'
import { isSorteavel } from '../../lib/sorteaveis'

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
          mensagens_inscritos: true,
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
  const eventos = await prisma.evento.findMany({
    where: competicao_id ? { competicao_id } : undefined,
    orderBy: { data_hora: 'desc' },
    include: LIST_INCLUDE,
  })
  if (eventos.length === 0) return eventos

  const eventIds = eventos.map(e => e.id)
  const grouped = await prisma.inscricao.groupBy({
    by: ['evento_id', 'modalidade_id'],
    where: { evento_id: { in: eventIds } },
    _count: { _all: true },
  })
  const countsByEvento: Record<number, Record<number, number>> = {}
  for (const g of grouped) {
    ;(countsByEvento[g.evento_id] ??= {})[g.modalidade_id] = g._count._all
  }

  const sorteios = await prisma.sorteio.findMany({
    where: { evento_id: { in: eventIds } },
    select: { evento_id: true, modalidade_id: true },
  })
  const sorteadasByEvento: Record<number, Set<number>> = {}
  for (const s of sorteios) {
    ;(sorteadasByEvento[s.evento_id] ??= new Set()).add(s.modalidade_id)
  }

  return eventos.map(e => {
    const counts = countsByEvento[e.id] ?? {}
    const ids = new Set<number>(sorteadasByEvento[e.id] ?? [])
    for (const m of (e as any).competicao?.modalidades ?? []) {
      if (isSorteavel({ tipo: m.tipo_modalidade.tipo, mensagens_inscritos: m.mensagens_inscritos }, counts[m.id] ?? 0)) {
        ids.add(m.id)
      }
    }
    return { ...e, modalidades_sorteaveis: ids.size }
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

export async function setLogoUrl(id: number, logo_url: string | null) {
  return prisma.evento.update({ where: { id }, data: { logo_url }, include: INCLUDE })
}

export async function getLogoUrl(id: number): Promise<string | null> {
  const e = await prisma.evento.findUnique({ where: { id }, select: { logo_url: true } })
  return e?.logo_url ?? null
}
