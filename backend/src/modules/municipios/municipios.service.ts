import prisma from '../../lib/prisma'

const MAX_LIMIT = 200
const DEFAULT_LIMIT = 50

export type ListarParams = {
  uf?: string
  q?: string
  page?: number
  limit?: number
}

export async function listar({ uf, q, page = 1, limit = DEFAULT_LIMIT }: ListarParams) {
  const safeLimit = Math.min(Math.max(1, limit), MAX_LIMIT)
  const safePage = Math.max(1, page)
  const where: any = {}
  if (uf) where.uf = uf.toUpperCase()
  if (q) where.nome = { contains: q, mode: 'insensitive' }

  const [data, total] = await Promise.all([
    prisma.municipio.findMany({
      where,
      orderBy: [{ uf: 'asc' }, { nome: 'asc' }],
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    }),
    prisma.municipio.count({ where }),
  ])

  return { data, total, page: safePage, limit: safeLimit }
}

export async function buscarPorId(id: number) {
  const item = await prisma.municipio.findUnique({ where: { id } })
  if (!item) throw Object.assign(new Error('Município não encontrado'), { status: 404 })
  return item
}

export async function criar(data: { codigo_ibge: string; nome: string; uf: string }) {
  return prisma.municipio.create({
    data: { ...data, uf: data.uf.toUpperCase() },
  })
}

export async function editar(
  id: number,
  data: Partial<{ codigo_ibge: string; nome: string; uf: string }>
) {
  const payload = { ...data }
  if (payload.uf) payload.uf = payload.uf.toUpperCase()
  return prisma.municipio.update({ where: { id }, data: payload })
}

export async function remover(id: number) {
  const vinculados = await prisma.participante.count({ where: { municipio_id: id } })
  if (vinculados > 0) {
    throw Object.assign(
      new Error('Remova os participantes vinculados antes de excluir este município.'),
      { status: 409 }
    )
  }
  return prisma.municipio.delete({ where: { id } })
}
