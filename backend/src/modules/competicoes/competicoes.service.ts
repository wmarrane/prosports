import prisma from '../../lib/prisma'
import { SIGLAS_VALIDAS } from '../municipios/uf'

export const CAMPOS_VALIDOS = ['subtitulo', 'municipio', 'inspetoria', 'delegacia'] as const
export type CampoSubtitulo = typeof CAMPOS_VALIDOS[number]

function validateUfs(estados: string[]) {
  for (const uf of estados) {
    if (!SIGLAS_VALIDAS.has(uf)) {
      throw Object.assign(new Error(`UF inválida: '${uf}'`), { status: 400 })
    }
  }
}

function validateCampos(campos: string[]) {
  for (const c of campos) {
    if (!CAMPOS_VALIDOS.includes(c as CampoSubtitulo)) {
      throw Object.assign(new Error(`Campo inválido: '${c}'`), { status: 400 })
    }
  }
  if (new Set(campos).size !== campos.length) {
    throw Object.assign(new Error('subtitulo_campos não pode ter duplicatas'), { status: 400 })
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
  subtitulo_campos?: string[]
  considerar_anfitriao?: boolean
}) {
  validateUfs(input.estados)
  const campos = input.subtitulo_campos ?? []
  validateCampos(campos)
  const data = {
    nome: input.nome,
    estados: input.estados,
    subtitulo_campos: campos,
    considerar_anfitriao: input.considerar_anfitriao ?? false,
  }
  return mapPrismaError(() => prisma.competicao.create({ data }))
}

export async function editar(
  id: number,
  input: Partial<{ nome: string; estados: string[]; subtitulo_campos: string[]; considerar_anfitriao: boolean }>
) {
  if (input.estados !== undefined) validateUfs(input.estados)
  if (input.subtitulo_campos !== undefined) validateCampos(input.subtitulo_campos)
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
