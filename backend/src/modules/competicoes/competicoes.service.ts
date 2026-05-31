import prisma from '../../lib/prisma'
import { SIGLAS_VALIDAS } from '../municipios/uf'

function validateUfs(estados: string[]) {
  for (const uf of estados) {
    if (!SIGLAS_VALIDAS.has(uf)) {
      throw Object.assign(new Error(`UF inválida: '${uf}'`), { status: 400 })
    }
  }
}

async function mapPrismaError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw Object.assign(new Error('Já existe uma competição com este nome.'), { status: 409 })
    }
    throw err
  }
}

export async function listar() {
  return prisma.competicao.findMany({
    orderBy: { nome: 'asc' },
    include: {
      _count: { select: { modalidades: true, eventos: true } },
    },
  })
}

export async function buscarPorId(id: number) {
  const item = await prisma.competicao.findUnique({ where: { id } })
  if (!item) throw Object.assign(new Error('Competição não encontrada'), { status: 404 })
  return item
}

export async function criar(input: {
  nome: string
  estados: string[]
  adicionar_subtitulo?: boolean
}) {
  validateUfs(input.estados)
  const data = {
    nome: input.nome,
    estados: input.estados,
    adicionar_subtitulo: input.adicionar_subtitulo ?? false,
  }
  return mapPrismaError(() => prisma.competicao.create({ data }))
}

export async function editar(
  id: number,
  input: Partial<{ nome: string; estados: string[]; adicionar_subtitulo: boolean }>
) {
  if (input.estados !== undefined) validateUfs(input.estados)
  return mapPrismaError(() => prisma.competicao.update({ where: { id }, data: input }))
}

export async function remover(id: number) {
  const [modalidades, eventos] = await Promise.all([
    prisma.modalidade.count({ where: { competicao_id: id } }),
    prisma.evento.count({ where: { competicao_id: id } }),
  ])
  const motivos: string[] = []
  if (modalidades > 0) motivos.push('modalidades')
  if (eventos > 0) motivos.push('eventos')
  if (motivos.length > 0) {
    throw Object.assign(
      new Error(`Remova os ${motivos.join(' e ')} vinculados antes de excluir esta competição.`),
      { status: 409 }
    )
  }
  return prisma.competicao.delete({ where: { id } })
}
