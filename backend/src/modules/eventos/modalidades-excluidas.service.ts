import prisma from '../../lib/prisma'

export async function getExcluidas(evento_id: number): Promise<number[]> {
  const rows = await prisma.eventoModalidadeExcluida.findMany({
    where: { evento_id },
    select: { modalidade_id: true },
  })
  return rows.map(r => r.modalidade_id)
}

// Substitui o conjunto de modalidades excluídas do evento.
// Guardrail: não permite excluir modalidade que tenha inscritos ou sorteio
// nesse evento. Valida que os ids pertencem à competição do evento.
export async function setExcluidas(evento_id: number, ids: number[]): Promise<{ excluidas: number[] }> {
  const evento = await prisma.evento.findUnique({
    where: { id: evento_id },
    select: { competicao_id: true },
  })
  if (!evento) throw Object.assign(new Error('Evento não encontrado'), { status: 404 })

  const unicos = [...new Set(ids)]

  if (unicos.length > 0) {
    const daCompeticao = await prisma.modalidade.findMany({
      where: { competicao_id: evento.competicao_id, id: { in: unicos } },
      select: { id: true },
    })
    const validos = new Set(daCompeticao.map(m => m.id))
    const invalidos = unicos.filter(id => !validos.has(id))
    if (invalidos.length > 0) {
      throw Object.assign(
        new Error(`Modalidade(s) fora desta competição: ${invalidos.join(', ')}.`),
        { status: 400 },
      )
    }

    const [comInscritos, comSorteio] = await Promise.all([
      prisma.inscricao.findMany({
        where: { evento_id, modalidade_id: { in: unicos } },
        distinct: ['modalidade_id'],
        select: { modalidade_id: true },
      }),
      prisma.sorteio.findMany({
        where: { evento_id, modalidade_id: { in: unicos } },
        select: { modalidade_id: true },
      }),
    ])
    const bloqueados = new Set<number>([
      ...comInscritos.map(x => x.modalidade_id),
      ...comSorteio.map(x => x.modalidade_id),
    ])
    if (bloqueados.size > 0) {
      throw Object.assign(
        new Error(`Não é possível remover modalidade(s) com inscritos ou sorteio: ${[...bloqueados].join(', ')}. Apague os dados antes.`),
        { status: 400, modalidades_bloqueadas: [...bloqueados] },
      )
    }
  }

  await prisma.$transaction([
    prisma.eventoModalidadeExcluida.deleteMany({ where: { evento_id } }),
    ...(unicos.length > 0
      ? [prisma.eventoModalidadeExcluida.createMany({
          data: unicos.map(modalidade_id => ({ evento_id, modalidade_id })),
        })]
      : []),
  ])

  return { excluidas: unicos }
}
