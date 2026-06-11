import prisma from '../../lib/prisma'
import { resolverParticipantes } from '../participantes/resolver-participantes.service'

const INCLUDE = {
  participante: { include: { municipio: true, inspetoria: true, delegacia: true } },
} as const

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

type CreateInput = {
  evento_id: number
  modalidade_id: number
  participante_id: number
  posicao: number  // 1-12, validado pelo Zod no controller
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

export type ImportCampeaoRow = {
  posicao: number
  nome: string
  municipio_uf: string
  municipio_nome: string
  subtitulo?: string
}

export type ImportCampeaoRowResult = {
  linha: number
  posicao: number
  nome: string
  status: 'criada' | 'duplicada' | 'erro'
  erro?: string
}

export type ImportCampeoesResult = {
  rows: ImportCampeaoRowResult[]
  contadores: { criadas: number; duplicadas: number; erros: number }
}

export async function importar(input: {
  evento_id: number
  modalidade_id: number
  dry_run: boolean
  rows: ImportCampeaoRow[]
}): Promise<ImportCampeoesResult> {
  const [evento, modalidade] = await Promise.all([
    prisma.evento.findUnique({ where: { id: input.evento_id }, select: { competicao_id: true } }),
    prisma.modalidade.findUnique({ where: { id: input.modalidade_id }, select: { competicao_id: true } }),
  ])
  if (!evento) throw Object.assign(new Error('Evento não encontrado'), { status: 404 })
  if (!modalidade) throw Object.assign(new Error('Modalidade não encontrada'), { status: 404 })
  if (evento.competicao_id !== modalidade.competicao_id) {
    throw Object.assign(new Error('A modalidade não pertence à competição deste evento.'), { status: 400 })
  }

  const resolucoes = await resolverParticipantes(input.rows)

  const existentes = await prisma.campeaoAnterior.findMany({
    where: { evento_id: input.evento_id, modalidade_id: input.modalidade_id },
    select: { posicao: true },
  })
  const posicoesOcupadas = new Set<number>(existentes.map(c => c.posicao))

  const results: ImportCampeaoRowResult[] = []
  const contadores = { criadas: 0, duplicadas: 0, erros: 0 }

  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i]
    const linha = i + 1
    const nome = row.nome.trim()
    const posicao = row.posicao
    const r = resolucoes[i]

    if (!Number.isInteger(posicao) || posicao < 1 || posicao > 12) {
      results.push({ linha, posicao, nome, status: 'erro', erro: 'Posição deve ser um inteiro de 1 a 12.' })
      contadores.erros++
      continue
    }
    if (r.municipio_id == null) {
      results.push({ linha, posicao, nome, status: 'erro', erro: `Município '${row.municipio_nome}/${row.municipio_uf}' não encontrado` })
      contadores.erros++
      continue
    }
    if (r.participante_id == null) {
      results.push({ linha, posicao, nome, status: 'erro', erro: "Participante não cadastrado. Cadastre em 'Participantes' primeiro." })
      contadores.erros++
      continue
    }
    if (posicoesOcupadas.has(posicao)) {
      results.push({ linha, posicao, nome, status: 'duplicada' })
      contadores.duplicadas++
      continue
    }
    if (!input.dry_run) {
      await prisma.campeaoAnterior.create({
        data: { evento_id: input.evento_id, modalidade_id: input.modalidade_id, participante_id: r.participante_id, posicao },
      })
    }
    posicoesOcupadas.add(posicao)
    results.push({ linha, posicao, nome, status: 'criada' })
    contadores.criadas++
  }

  return { rows: results, contadores }
}
