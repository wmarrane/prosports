import prisma from '../../lib/prisma'

export async function getAnfitriaoOrdem(evento_id: number): Promise<Record<number, number>> {
  const rows = await prisma.eventoModalidadeAnfitriao.findMany({
    where: { evento_id },
    select: { modalidade_id: true, posicao: true },
  })
  const map: Record<number, number> = {}
  for (const r of rows) map[r.modalidade_id] = r.posicao
  return map
}

export async function setAnfitriaoOrdem(
  evento_id: number,
  modalidade_id: number,
  posicao: number | null,
): Promise<{ posicao: number | null }> {
  const mod = await prisma.modalidade.findUnique({
    where: { id: modalidade_id },
    select: { tipo_modalidade: { select: { tipo: true } } },
  })
  if (!mod) throw Object.assign(new Error('Modalidade não encontrada'), { status: 404 })
  if (mod.tipo_modalidade.tipo !== 'ordem_entrada') {
    throw Object.assign(new Error('Posição do anfitrião só se aplica a modalidades de Ordem de Entrada.'), { status: 400 })
  }

  if (posicao == null) {
    await prisma.eventoModalidadeAnfitriao.deleteMany({ where: { evento_id, modalidade_id } })
    return { posicao: null }
  }

  const n = await prisma.inscricao.count({ where: { evento_id, modalidade_id } })
  if (posicao < 1 || posicao > n) {
    throw Object.assign(new Error(`A posição deve estar entre 1 e ${n} (nº de inscritos).`), { status: 400 })
  }

  await prisma.eventoModalidadeAnfitriao.upsert({
    where: { evento_id_modalidade_id: { evento_id, modalidade_id } },
    create: { evento_id, modalidade_id, posicao },
    update: { posicao },
  })
  return { posicao }
}
