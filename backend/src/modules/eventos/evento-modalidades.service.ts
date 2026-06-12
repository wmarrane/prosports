import prisma from '../../lib/prisma'

export async function getModalidadeIdsExcluidas(evento_id: number): Promise<Set<number>> {
  const rows = await prisma.eventoModalidadeExcluida.findMany({
    where: { evento_id },
    select: { modalidade_id: true },
  })
  return new Set(rows.map(r => r.modalidade_id))
}

const MOD_INCLUDE = { competicao: true, tipo_modalidade: true } as const

// Modalidades da competição do evento, menos as excluídas. Fonte única do
// conceito "modalidades do evento".
export async function modalidadesDoEvento(evento_id: number) {
  const evento = await prisma.evento.findUnique({
    where: { id: evento_id },
    select: { competicao_id: true },
  })
  if (!evento) throw Object.assign(new Error('Evento não encontrado'), { status: 404 })

  const [modalidades, excluidas] = await Promise.all([
    prisma.modalidade.findMany({
      where: { competicao_id: evento.competicao_id, ativa: true },
      orderBy: { nome: 'asc' },
      include: MOD_INCLUDE,
    }),
    getModalidadeIdsExcluidas(evento_id),
  ])
  return modalidades.filter(m => !excluidas.has(m.id))
}
