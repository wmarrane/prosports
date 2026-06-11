import prisma from '../../lib/prisma'
import { resolverParticipantes } from './resolver-participantes.service'

const INCLUDE = { inspetoria: true, delegacia: true, municipio: true } as const

export async function listar() {
  return prisma.participante.findMany({
    orderBy: { nome: 'asc' },
    include: INCLUDE,
  })
}

export async function buscarPorId(id: number) {
  const item = await prisma.participante.findUnique({
    where: { id },
    include: INCLUDE,
  })
  if (!item) throw Object.assign(new Error('Participante não encontrado'), { status: 404 })
  return item
}

export async function criar(data: {
  nome: string
  subtitulo?: string
  inspetoria_id?: number | null
  delegacia_id?: number | null
  municipio_id: number
}) {
  return prisma.participante.create({ data, include: INCLUDE })
}

export async function editar(
  id: number,
  data: Partial<{
    nome: string
    subtitulo: string | null
    inspetoria_id: number | null
    delegacia_id: number | null
    municipio_id: number
  }>
) {
  return prisma.participante.update({ where: { id }, data, include: INCLUDE })
}

export async function remover(id: number) {
  return prisma.participante.delete({ where: { id } })
}

export type ImportParticipanteRow = {
  nome: string
  municipio_uf: string
  municipio_nome: string
  subtitulo?: string
}
export type ImportParticipanteRowResult = {
  linha: number
  nome: string
  status: 'criada' | 'duplicada' | 'erro'
  erro?: string
}
export type ImportParticipantesResult = {
  rows: ImportParticipanteRowResult[]
  contadores: { criadas: number; duplicadas: number; erros: number }
}

export async function importar(input: {
  dry_run: boolean
  rows: ImportParticipanteRow[]
}): Promise<ImportParticipantesResult> {
  const resolucoes = await resolverParticipantes(input.rows)

  const results: ImportParticipanteRowResult[] = []
  const contadores = { criadas: 0, duplicadas: 0, erros: 0 }
  // Identidade já criada DENTRO deste arquivo (municipio_id:nome) p/ evitar duplicar
  const criadosNoArquivo = new Set<string>()

  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i]
    const linha = i + 1
    const nome = row.nome.trim()
    const subtitulo = row.subtitulo?.trim() || undefined
    const r = resolucoes[i]

    if (r.municipio_id == null) {
      results.push({ linha, nome, status: 'erro', erro: `Município '${row.municipio_nome}/${row.municipio_uf}' não encontrado` })
      contadores.erros++
      continue
    }
    const chave = `${r.municipio_id}:${nome.toLowerCase()}`
    if (r.participante_id != null || criadosNoArquivo.has(chave)) {
      results.push({ linha, nome, status: 'duplicada' })
      contadores.duplicadas++
      continue
    }
    if (!input.dry_run) {
      await prisma.participante.create({ data: { nome, municipio_id: r.municipio_id, subtitulo } })
    }
    criadosNoArquivo.add(chave)
    results.push({ linha, nome, status: 'criada' })
    contadores.criadas++
  }

  return { rows: results, contadores }
}
