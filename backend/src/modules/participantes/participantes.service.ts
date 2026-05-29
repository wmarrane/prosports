import prisma from '../../lib/prisma'

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
