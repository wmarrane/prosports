import prisma from '../../lib/prisma'

const INCLUDE = { competicao: true, tipo_modalidade: true } as const

async function mapPrismaError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw Object.assign(
        new Error('Já existe uma modalidade com este nome ou sigla nesta competição.'),
        { status: 409 }
      )
    }
    throw err
  }
}

export async function listar(competicao_id?: number) {
  return prisma.modalidade.findMany({
    where: competicao_id ? { competicao_id } : undefined,
    orderBy: [{ competicao: { nome: 'asc' } }, { nome: 'asc' }],
    include: INCLUDE,
  })
}

export async function buscarPorId(id: number) {
  const item = await prisma.modalidade.findUnique({
    where: { id },
    include: INCLUDE,
  })
  if (!item) throw Object.assign(new Error('Modalidade não encontrada'), { status: 404 })
  return item
}

export async function criar(data: {
  nome: string
  sigla: string
  competicao_id: number
  tipo_modalidade_id: number
  chave_versao?: string
  mensagens_inscritos?: unknown
}) {
  return mapPrismaError(() => prisma.modalidade.create({ data: data as any, include: INCLUDE }))
}

export async function editar(
  id: number,
  data: Partial<{ nome: string; sigla: string; competicao_id: number; tipo_modalidade_id: number; chave_versao: string; mensagens_inscritos: unknown }>
) {
  return mapPrismaError(async () => {
    if (data.tipo_modalidade_id !== undefined) {
      const atual = await prisma.modalidade.findUnique({
        where: { id },
        select: { tipo_modalidade: { select: { tipo: true } } },
      })
      if (!atual) throw Object.assign(new Error('Modalidade não encontrada'), { status: 404 })
      const novo = await prisma.tipoModalidade.findUnique({
        where: { id: data.tipo_modalidade_id },
        select: { tipo: true },
      })
      if (!novo) throw Object.assign(new Error('Tipo de modalidade não encontrado'), { status: 400 })

      if (novo.tipo !== atual.tipo_modalidade.tipo) {
        return prisma.$transaction(async tx => {
          await tx.sorteio.deleteMany({ where: { modalidade_id: id } })
          return tx.modalidade.update({ where: { id }, data: data as any, include: INCLUDE })
        })
      }
    }
    return prisma.modalidade.update({ where: { id }, data: data as any, include: INCLUDE })
  })
}

export async function remover(id: number) {
  const [inscricoes, sorteios, campeoes] = await Promise.all([
    prisma.inscricao.count({ where: { modalidade_id: id } }),
    prisma.sorteio.count({ where: { modalidade_id: id } }),
    prisma.campeaoAnterior.count({ where: { modalidade_id: id } }),
  ])

  if (inscricoes + sorteios + campeoes > 0) {
    const partes: string[] = []
    if (inscricoes > 0) partes.push(`${inscricoes} inscriç${inscricoes === 1 ? 'ão' : 'ões'}`)
    if (sorteios > 0) partes.push(`${sorteios} sorteio${sorteios === 1 ? '' : 's'}`)
    if (campeoes > 0) partes.push(`${campeoes} campe${campeoes === 1 ? 'ão' : 'ões'} anterior${campeoes === 1 ? '' : 'es'}`)
    throw Object.assign(
      new Error(`Não é possível remover: há ${partes.join(', ')} vinculados a esta modalidade.`),
      { status: 409 }
    )
  }

  return prisma.modalidade.delete({ where: { id } })
}

export async function setAtiva(id: number, ativa: boolean) {
  // Desativar não pode ocultar dados de eventos já sorteados ou em sorteio:
  // bloqueia se a modalidade tiver inscritos ou sorteio em evento sorteado/parcial.
  if (!ativa) {
    const STATUS_TRAVA = ['sorteado', 'parcial'] as const
    const [comSorteio, comInscritos] = await Promise.all([
      prisma.sorteio.findFirst({
        where: { modalidade_id: id, evento: { status: { in: STATUS_TRAVA as any } } },
        select: { id: true },
      }),
      prisma.inscricao.findFirst({
        where: { modalidade_id: id, evento: { status: { in: STATUS_TRAVA as any } } },
        select: { id: true },
      }),
    ])
    if (comSorteio || comInscritos) {
      throw Object.assign(
        new Error('Não é possível desativar: a modalidade tem inscritos ou sorteio em eventos já sorteados ou em sorteio.'),
        { status: 400 },
      )
    }
  }
  return prisma.modalidade.update({ where: { id }, data: { ativa }, include: INCLUDE })
}

export async function replicarMensagens(
  origem_id: number,
  destino_ids: number[],
  mensagens: unknown,
): Promise<{ replicadas: number }> {
  const origem = await prisma.modalidade.findUnique({
    where: { id: origem_id },
    select: { tipo_modalidade: { select: { tipo: true } } },
  })
  if (!origem) throw Object.assign(new Error('Modalidade de origem não encontrada'), { status: 404 })
  const tipo = origem.tipo_modalidade.tipo

  const destinos = await prisma.modalidade.findMany({
    where: { id: { in: destino_ids } },
    select: { id: true, tipo_modalidade: { select: { tipo: true } } },
  })
  const validos = destinos.filter(d => d.id !== origem_id && d.tipo_modalidade.tipo === tipo)

  await prisma.$transaction(
    validos.map(d => prisma.modalidade.update({
      where: { id: d.id },
      data: { mensagens_inscritos: mensagens } as any,
    })),
  )
  return { replicadas: validos.length }
}
