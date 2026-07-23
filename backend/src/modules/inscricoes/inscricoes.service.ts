import prisma from '../../lib/prisma'
import { resolverParticipantes, resolverEscolar } from '../participantes/resolver-participantes.service'

const INCLUDE = {
  participante: { include: { municipio: true, inspetoria: true, delegacia: true } },
  municipio: true,
} as const

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
  subtitulo?: string | null
  municipio_id?: number | null
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
  if (data.municipio_id != null) {
    const municipio = await prisma.municipio.findUnique({ where: { id: data.municipio_id } })
    if (!municipio) throw Object.assign(new Error('Município inválido'), { status: 400 })
  }
  const createData: Record<string, unknown> = {
    evento_id: data.evento_id,
    modalidade_id: data.modalidade_id,
    participante_id: data.participante_id,
  }
  if (data.subtitulo !== undefined) createData.subtitulo = data.subtitulo
  if (data.municipio_id !== undefined) createData.municipio_id = data.municipio_id
  return mapPrismaError(() => prisma.inscricao.create({ data: createData as any, include: INCLUDE }))
}

export async function remover(id: number) {
  return prisma.inscricao.delete({ where: { id } })
}

export async function removerTodosDaModalidade(
  evento_id: number,
  modalidade_id: number,
): Promise<{ count: number }> {
  const sorteio = await prisma.sorteio.findFirst({
    where: { evento_id, modalidade_id },
    select: { id: true },
  })
  if (sorteio) {
    throw Object.assign(
      new Error('Apague o sorteio desta modalidade antes de remover os inscritos.'),
      { status: 400 },
    )
  }
  return prisma.inscricao.deleteMany({ where: { evento_id, modalidade_id } })
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
  municipio_uf?: string
  municipio_nome: string
  subtitulo?: string
}

export type ImportRowResult = {
  linha: number
  nome: string
  status: 'criada' | 'duplicada' | 'erro'
  erro?: string
}

export type ImportResult = {
  rows: ImportRowResult[]
  contadores: {
    criadas: number
    duplicadas: number
    erros: number
    nao_cadastrados: number
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

  // Fetch the competition toggle and estados
  const competicao = evento.competicao_id != null
    ? await prisma.competicao.findUnique({
        where: { id: evento.competicao_id },
        select: { subtitulo_municipio_por_modalidade: true, estados: true },
      })
    : null
  const toggleOn = competicao?.subtitulo_municipio_por_modalidade === true

  const inscricoes = await prisma.inscricao.findMany({
    where: { evento_id: input.evento_id, modalidade_id: input.modalidade_id },
    select: { participante_id: true },
  })
  const inscritosSet = new Set<number>(inscricoes.map(i => i.participante_id))

  const results: ImportRowResult[] = []
  const contadores = { criadas: 0, duplicadas: 0, erros: 0, nao_cadastrados: 0 }

  if (toggleOn) {
    // ESCOLAR PATH: resolve município por nome nos estados da competição;
    // resolve participante por nome (cria se não existir e !dry_run)
    const estados: string[] = competicao?.estados ?? []
    const resolucoes = await resolverEscolar(input.rows, estados)

    for (let i = 0; i < input.rows.length; i++) {
      const row = input.rows[i]
      const linha = i + 1
      const nome = row.nome.trim()
      const r = resolucoes[i]

      if (r.ambiguo_municipio) {
        results.push({ linha, nome, status: 'erro', erro: `Município '${row.municipio_nome}' ambíguo nos estados da competição` })
        contadores.erros++
        continue
      }
      if (r.municipio_id == null) {
        results.push({ linha, nome, status: 'erro', erro: `Município '${row.municipio_nome}' não encontrado em ${estados.join(', ')}` })
        contadores.erros++
        continue
      }

      let participante_id = r.participante_id
      if (participante_id == null) {
        if (!input.dry_run) {
          const criado = await prisma.participante.create({
            data: { nome: nome, municipio_id: r.municipio_id },
          })
          participante_id = criado.id
        }
        // dry_run: trata como criável (status 'criada', sem persistir)
      }

      if (participante_id != null && inscritosSet.has(participante_id)) {
        results.push({ linha, nome, status: 'duplicada' })
        contadores.duplicadas++
        continue
      }
      if (!input.dry_run && participante_id != null) {
        await prisma.inscricao.create({
          data: {
            evento_id: input.evento_id,
            modalidade_id: input.modalidade_id,
            participante_id,
            subtitulo: row.subtitulo?.trim() || null,
            municipio_id: r.municipio_id,
          },
        })
        inscritosSet.add(participante_id)
      }
      results.push({ linha, nome, status: 'criada' })
      contadores.criadas++
    }
  } else {
    // NON-ESCOLAR PATH: uses resolverParticipantes, requires municipio_uf,
    // never creates participant, no overrides
    const resolucoes = await resolverParticipantes(
      input.rows.map(r => ({
        nome: r.nome,
        municipio_uf: r.municipio_uf ?? '',
        municipio_nome: r.municipio_nome,
      }))
    )

    for (let i = 0; i < input.rows.length; i++) {
      const row = input.rows[i]
      const linha = i + 1
      const nome = row.nome.trim()
      const r = resolucoes[i]

      if (r.municipio_id == null) {
        results.push({ linha, nome, status: 'erro', erro: `Município '${row.municipio_nome}/${row.municipio_uf}' não encontrado` })
        contadores.erros++
        continue
      }
      if (r.participante_id == null) {
        results.push({ linha, nome, status: 'erro', erro: "Participante não cadastrado. Cadastre em 'Participantes' primeiro." })
        contadores.erros++
        contadores.nao_cadastrados++
        continue
      }

      if (inscritosSet.has(r.participante_id)) {
        results.push({ linha, nome, status: 'duplicada' })
        contadores.duplicadas++
        continue
      }
      if (!input.dry_run) {
        await prisma.inscricao.create({
          data: {
            evento_id: input.evento_id,
            modalidade_id: input.modalidade_id,
            participante_id: r.participante_id,
          },
        })
      }
      inscritosSet.add(r.participante_id)
      results.push({ linha, nome, status: 'criada' })
      contadores.criadas++
    }
  }

  return { rows: results, contadores }
}
