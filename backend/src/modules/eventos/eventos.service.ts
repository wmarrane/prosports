import prisma from '../../lib/prisma'
import { isSorteavel } from '../../lib/sorteaveis'
import { esporteBase } from '../../lib/esporte'
import { getModalidadeIdsExcluidas } from './evento-modalidades.service'
import { publicar, despublicar } from '../site-publico/site-publico.service'
import { decidirAcaoPublicacao } from './publicar-status'

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
          nome: true,
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
  data_inicio?: Date | null
  data_fim?: Date | null
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

  const participantesDistintos = await prisma.inscricao.findMany({
    where: { evento_id: { in: eventIds } },
    distinct: ['evento_id', 'participante_id'],
    select: { evento_id: true },
  })
  const participantesPorEvento: Record<number, number> = {}
  for (const p of participantesDistintos) {
    participantesPorEvento[p.evento_id] = (participantesPorEvento[p.evento_id] ?? 0) + 1
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
    const esportes = new Set<string>()
    for (const m of (e as any).competicao?.modalidades ?? []) {
      if (excluidas.has(m.id)) continue
      esportes.add(esporteBase(m.nome))
    }
    return {
      ...e,
      modalidades_sorteaveis: sorteaveisIds.size,
      modalidades_pendentes: pendentes,
      modalidades_distintas: esportes.size,
      total_participantes: participantesPorEvento[e.id] ?? 0,
    }
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
  const { comissao_ids: comissaoRaw, ...rest } = data
  const comissao_ids = comissaoRaw ? [...new Set(comissaoRaw)] : undefined
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
  const { comissao_ids: comissaoRaw, ...rest } = data
  const comissao_ids = comissaoRaw ? [...new Set(comissaoRaw)] : undefined
  if (comissao_ids) await validarComissaoIds(comissao_ids)
  const antes = await prisma.evento.findUnique({ where: { id }, select: { status: true, site_publicado_em: true } })
  const atualizado = await mapPrismaError(async () => {
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
  const acao = decidirAcaoPublicacao(antes?.status, rest.status, !!antes?.site_publicado_em)
  if (acao === 'publicar') {
    try { await publicar(id, { permitirParcial: true, origem: 'automatica' }) } catch (e) { console.warn(`[editar] publicar evento ${id} falhou`, e) }
  } else if (acao === 'despublicar') {
    try { await despublicar(id, { origem: 'automatica' }) } catch (e) { console.warn(`[editar] despublicar evento ${id} falhou`, e) }
  }
  return atualizado
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

export async function progressoSorteio(eventoId: number): Promise<{ sorteadas: number; sorteaveis: number }> {
  const evento = await prisma.evento.findUnique({ where: { id: eventoId }, select: { id: true, competicao_id: true } })
  if (!evento) throw Object.assign(new Error('Evento não encontrado'), { status: 404 })

  const [modalidades, inscricoesGrp, sorteios, excluidasIds, gruposRegras, chavesRegras] = await Promise.all([
    prisma.modalidade.findMany({
      where: { competicao_id: evento.competicao_id, ativa: true },
      select: { id: true, tipo_modalidade: { select: { tipo: true } }, mensagens_inscritos: true },
    }),
    prisma.inscricao.groupBy({ by: ['modalidade_id'], where: { evento_id: eventoId }, _count: { _all: true } }),
    prisma.sorteio.findMany({ where: { evento_id: eventoId }, select: { modalidade_id: true } }),
    getModalidadeIdsExcluidas(eventoId),
    prisma.sistemaDisputasGrupos.findMany({ where: { competicao_id: evento.competicao_id }, select: { quantidade_equipes: true } }),
    prisma.sistemaDisputasChaves.findMany({ where: { competicao_id: evento.competicao_id }, select: { numero_inscrito: true } }),
  ])

  const inscritosPorMod = new Map<number, number>()
  for (const g of inscricoesGrp) inscritosPorMod.set(g.modalidade_id, (g as any)._count?._all ?? 0)
  const sorteadasSet = new Set<number>(sorteios.map((s) => s.modalidade_id))
  const gruposSet = new Set<number>(gruposRegras.map((r) => r.quantidade_equipes))
  const chavesSet = new Set<number>(chavesRegras.map((r) => r.numero_inscrito))

  // Candidatas: grupos/chaves, ativas, não excluídas
  const candidatas = modalidades.filter(
    (m) => (m.tipo_modalidade.tipo === 'grupos' || m.tipo_modalidade.tipo === 'chaves') && !excluidasIds.has(m.id),
  )
  // Bracket byes só para os N candidatos de chaves (consulta enxuta)
  const nsChaves = [...new Set(candidatas.filter((m) => m.tipo_modalidade.tipo === 'chaves').map((m) => inscritosPorMod.get(m.id) ?? 0))]
  const byes = nsChaves.length
    ? await prisma.bracketChavesByes.findMany({ where: { numero_inscrito: { in: nsChaves } }, select: { numero_inscrito: true } })
    : []
  const bracketSet = new Set<number>(byes.map((b) => b.numero_inscrito))

  let sorteaveis = 0
  let sorteadas = 0
  for (const m of candidatas) {
    const n = inscritosPorMod.get(m.id) ?? 0
    if (!isSorteavel({ tipo: m.tipo_modalidade.tipo, mensagens_inscritos: m.mensagens_inscritos }, n)) continue // R1+R2
    if (m.tipo_modalidade.tipo === 'grupos' && !gruposSet.has(n)) continue // R3
    if (m.tipo_modalidade.tipo === 'chaves' && (!chavesSet.has(n) || !bracketSet.has(n))) continue // R4
    sorteaveis++
    if (sorteadasSet.has(m.id)) sorteadas++
  }
  return { sorteadas, sorteaveis }
}
