import prisma from '../../lib/prisma'

const INCLUDE = { participante: true } as const

async function mapPrismaError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw Object.assign(
        new Error('Este participante já está inscrito nesta modalidade do evento.'),
        { status: 409 }
      )
    }
    throw err
  }
}

type CreateInput = {
  evento_id: number
  modalidade_id: number
  participante_id: number
}

export async function listar(filtros: { evento_id?: number; modalidade_id?: number }) {
  const where: { evento_id?: number; modalidade_id?: number } = {}
  if (filtros.evento_id !== undefined) where.evento_id = filtros.evento_id
  if (filtros.modalidade_id !== undefined) where.modalidade_id = filtros.modalidade_id
  return prisma.inscricao.findMany({
    where,
    orderBy: { criado_em: 'asc' },
    include: INCLUDE,
  })
}

export async function buscarPorId(id: number) {
  const item = await prisma.inscricao.findUnique({ where: { id }, include: INCLUDE })
  if (!item) throw Object.assign(new Error('Inscrição não encontrada'), { status: 404 })
  return item
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
      { status: 400 }
    )
  }
  return mapPrismaError(() => prisma.inscricao.create({ data, include: INCLUDE }))
}

export async function remover(id: number) {
  return prisma.inscricao.delete({ where: { id } })
}

export async function contarPorModalidade(evento_id: number): Promise<Record<number, number>> {
  const grupos = await prisma.inscricao.groupBy({
    by: ['modalidade_id'],
    where: { evento_id },
    _count: { _all: true },
  })
  const out: Record<number, number> = {}
  for (const g of grupos) out[g.modalidade_id] = g._count._all
  return out
}

export type BulkResult = {
  criadas: number
  duplicadas: number
  erros: Array<{ participante_id: number; erro: string }>
}

export async function criarBulk(input: {
  evento_id: number
  modalidade_id: number
  participante_ids: number[]
}): Promise<BulkResult> {
  const [evento, modalidade] = await Promise.all([
    prisma.evento.findUnique({ where: { id: input.evento_id }, select: { competicao_id: true } }),
    prisma.modalidade.findUnique({ where: { id: input.modalidade_id }, select: { competicao_id: true } }),
  ])
  if (!evento) throw Object.assign(new Error('Evento não encontrado'), { status: 404 })
  if (!modalidade) throw Object.assign(new Error('Modalidade não encontrada'), { status: 404 })
  if (evento.competicao_id !== modalidade.competicao_id) {
    throw Object.assign(
      new Error('A modalidade não pertence à competição deste evento.'),
      { status: 400 }
    )
  }

  const jaInscritos = await prisma.inscricao.findMany({
    where: {
      evento_id: input.evento_id,
      modalidade_id: input.modalidade_id,
      participante_id: { in: input.participante_ids },
    },
    select: { participante_id: true },
  })
  const inscritosSet = new Set(jaInscritos.map(i => i.participante_id))

  const novos = input.participante_ids.filter(id => !inscritosSet.has(id))
  const result: BulkResult = {
    criadas: 0,
    duplicadas: input.participante_ids.length - novos.length,
    erros: [],
  }

  if (novos.length > 0) {
    try {
      const out = await prisma.inscricao.createMany({
        data: novos.map(participante_id => ({
          evento_id: input.evento_id,
          modalidade_id: input.modalidade_id,
          participante_id,
        })),
        skipDuplicates: true,
      })
      result.criadas = out.count
      result.duplicadas += novos.length - out.count
    } catch (err: any) {
      for (const pid of novos) {
        result.erros.push({ participante_id: pid, erro: err?.message ?? 'Erro desconhecido' })
      }
    }
  }

  return result
}

export type ImportRow = {
  nome: string
  municipio_uf: string
  municipio_nome: string
  subtitulo?: string
}

export type ImportRowResult = {
  linha: number
  nome: string
  status: 'criada' | 'duplicada' | 'erro'
  erro?: string
  participante_criado?: boolean
}

export type ImportResult = {
  rows: ImportRowResult[]
  contadores: {
    criadas: number
    duplicadas: number
    erros: number
    participantes_criados: number
  }
}

export async function importar(input: {
  evento_id: number
  modalidade_id: number
  dry_run: boolean
  rows: ImportRow[]
}): Promise<ImportResult> {
  const [evento, modalidade] = await Promise.all([
    prisma.evento.findUnique({
      where: { id: input.evento_id },
      select: { id: true, competicao_id: true },
    }),
    prisma.modalidade.findUnique({
      where: { id: input.modalidade_id },
      select: { id: true, competicao_id: true },
    }),
  ])
  if (!evento) throw Object.assign(new Error('Evento não encontrado'), { status: 404 })
  if (!modalidade) throw Object.assign(new Error('Modalidade não encontrada'), { status: 404 })
  if (evento.competicao_id !== modalidade.competicao_id) {
    throw Object.assign(
      new Error('A modalidade não pertence à competição deste evento.'),
      { status: 400 },
    )
  }

  const ufsSet = new Set(input.rows.map(r => r.municipio_uf.toUpperCase()))
  const municipios = await prisma.municipio.findMany({
    where: { uf: { in: Array.from(ufsSet) } },
    select: { id: true, nome: true, uf: true },
  })
  const municipiosByKey = new Map<string, number>()
  for (const m of municipios) {
    municipiosByKey.set(`${m.uf.toUpperCase()}:${m.nome.toLowerCase()}`, m.id)
  }

  const municipioIds = municipios.map(m => m.id)
  const participantes = municipioIds.length > 0
    ? await prisma.participante.findMany({
        where: { municipio_id: { in: municipioIds } },
        select: { id: true, nome: true, municipio_id: true },
      })
    : []
  const participantesByKey = new Map<string, number>()
  for (const p of participantes) {
    participantesByKey.set(`${p.municipio_id}:${p.nome.toLowerCase()}`, p.id)
  }

  const inscricoes = await prisma.inscricao.findMany({
    where: { evento_id: input.evento_id, modalidade_id: input.modalidade_id },
    select: { participante_id: true },
  })
  const inscritosSet = new Set<number>(inscricoes.map(i => i.participante_id))

  const results: ImportRowResult[] = []
  const contadores = { criadas: 0, duplicadas: 0, erros: 0, participantes_criados: 0 }

  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i]
    const linha = i + 1
    const nome = row.nome.trim()
    const uf = row.municipio_uf.trim().toUpperCase()
    const munNome = row.municipio_nome.trim()
    const subtitulo = row.subtitulo?.trim() || undefined

    const munKey = `${uf}:${munNome.toLowerCase()}`
    const municipio_id = municipiosByKey.get(munKey)
    if (!municipio_id) {
      results.push({ linha, nome, status: 'erro', erro: `Município '${munNome}/${uf}' não encontrado` })
      contadores.erros++
      continue
    }

    const partKey = `${municipio_id}:${nome.toLowerCase()}`
    let participante_id = participantesByKey.get(partKey)
    let participante_criado = false

    if (!participante_id) {
      if (input.dry_run) {
        participante_id = -linha
      } else {
        const created = await prisma.participante.create({
          data: { nome, municipio_id, subtitulo },
        })
        participante_id = created.id
      }
      participantesByKey.set(partKey, participante_id)
      participante_criado = true
      contadores.participantes_criados++
    }

    if (inscritosSet.has(participante_id)) {
      results.push({ linha, nome, status: 'duplicada' })
      contadores.duplicadas++
      continue
    }

    if (!input.dry_run) {
      await prisma.inscricao.create({
        data: {
          evento_id: input.evento_id,
          modalidade_id: input.modalidade_id,
          participante_id,
        },
      })
    }
    inscritosSet.add(participante_id)
    results.push({ linha, nome, status: 'criada', participante_criado })
    contadores.criadas++
  }

  return { rows: results, contadores }
}
