import prisma from '../../lib/prisma'
import { isSorteavel } from '../../lib/sorteaveis'

const INCLUDE = {
  competicao: true,
  municipio: true,
  anfitriao: { include: { municipio: true, inspetoria: true, delegacia: true } },
  comissao: { select: { usuario: { select: { id: true, nome: true } } } },
} as const

// Include estendido para a listagem: inclui modalidades da competição (com tipo)
// para filtros e contadores (modalidades/inscricoes/sorteios) por evento.
const LIST_INCLUDE = {
  competicao: {
    include: {
      modalidades: {
        where: { ativa: true },
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

type EventoStatus = 'rascunho' | 'inscricoes' | 'pronto' | 'sorteado' | 'parcial' | 'suspenso'

type CreateInput = {
  nome: string
  data_hora: Date
  local: string
  organizador?: string
  status?: EventoStatus
  competicao_id: number
  municipio_id: number
  anfitriao_id?: number | null
  comissao_ids?: number[]
}

export async function listar(competicao_id?: number, user?: { sub: number; role: string }) {
  const where: any = {}
  if (competicao_id) where.competicao_id = competicao_id
  if (user && user.role === 'COMISSAO_TECNICA') {
    where.comissao = { some: { usuario_id: user.sub } }
  }
  const eventos = await prisma.evento.findMany({
    where,
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

  const exclusoes = await prisma.eventoModalidadeExcluida.findMany({
    where: { evento_id: { in: eventIds } },
    select: { evento_id: true, modalidade_id: true },
  })
  const excludedByEvento: Record<number, Set<number>> = {}
  for (const x of exclusoes) {
    ;(excludedByEvento[x.evento_id] ??= new Set()).add(x.modalidade_id)
  }

  return eventos.map(e => {
    const counts = countsByEvento[e.id] ?? {}
    const sorteadas = sorteadasByEvento[e.id] ?? new Set<number>()
    const excluidas = excludedByEvento[e.id] ?? new Set<number>()
    const sorteaveisIds = new Set<number>()
    let pendentes = 0
    for (const m of (e as any).competicao?.modalidades ?? []) {
      if (excluidas.has(m.id)) continue
      if (sorteadas.has(m.id)) sorteaveisIds.add(m.id)
      const sorteavel = isSorteavel(
        { tipo: m.tipo_modalidade.tipo, mensagens_inscritos: m.mensagens_inscritos },
        counts[m.id] ?? 0,
      )
      if (sorteavel) {
        sorteaveisIds.add(m.id)
        if (!sorteadas.has(m.id)) pendentes++
      }
    }
    return { ...e, modalidades_sorteaveis: sorteaveisIds.size, modalidades_pendentes: pendentes }
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

async function validarComissaoIds(ids: number[]) {
  if (ids.length === 0) return
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, role: true } })
  const validos = new Set(users.filter(u => u.role === 'COMISSAO_TECNICA').map(u => u.id))
  const invalidos = ids.filter(id => !validos.has(id))
  if (invalidos.length > 0) {
    throw Object.assign(new Error(`Usuário(s) inválido(s) para comissão técnica: ${invalidos.join(', ')}.`), { status: 400 })
  }
}

export async function criar(data: CreateInput) {
  const { comissao_ids, ...rest } = data
  if (comissao_ids) await validarComissaoIds(comissao_ids)
  return mapPrismaError(async () => {
    const evento = await prisma.evento.create({ data: rest, include: INCLUDE })
    if (comissao_ids && comissao_ids.length > 0) {
      await prisma.eventoComissao.createMany({ data: comissao_ids.map(usuario_id => ({ evento_id: evento.id, usuario_id })) })
      return prisma.evento.findUnique({ where: { id: evento.id }, include: INCLUDE })
    }
    return evento
  })
}

export async function editar(id: number, data: Partial<CreateInput>) {
  const { comissao_ids, ...rest } = data
  if (comissao_ids) await validarComissaoIds(comissao_ids)
  return mapPrismaError(async () => {
    await prisma.evento.update({ where: { id }, data: rest })
    if (comissao_ids) {
      await prisma.$transaction([
        prisma.eventoComissao.deleteMany({ where: { evento_id: id } }),
        ...(comissao_ids.length > 0
          ? [prisma.eventoComissao.createMany({ data: comissao_ids.map(usuario_id => ({ evento_id: id, usuario_id })) })]
          : []),
      ])
    }
    return prisma.evento.findUnique({ where: { id }, include: INCLUDE })
  })
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
