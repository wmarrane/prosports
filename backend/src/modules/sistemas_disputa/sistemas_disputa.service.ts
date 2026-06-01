import prisma from '../../lib/prisma'

export type GruposPayload = {
  competicao_id: number
  quantidade_equipes: number
  quantidade_grupos: number
  grupos_3_componentes: number
  grupos_4_componentes: number
  numero_classificados: number
}

export type ChavesPayload = {
  competicao_id: number
  numero_inscrito: number
  posicao_primeiro_cabeca: number
  posicao_segundo_cabeca: number
  posicao_terceiro_cabeca: number
  posicao_quarto_cabeca: number
}

export const grupos = {
  listar: (competicao_id: number) =>
    prisma.sistemaDisputasGrupos.findMany({
      where: { competicao_id },
      orderBy: { quantidade_equipes: 'asc' },
    }),
  criar: (data: GruposPayload) => prisma.sistemaDisputasGrupos.create({ data }),
  editar: (id: number, data: Partial<GruposPayload>) =>
    prisma.sistemaDisputasGrupos.update({ where: { id }, data }),
  remover: (id: number) => prisma.sistemaDisputasGrupos.delete({ where: { id } }),
}

export const chaves = {
  listar: (competicao_id: number) =>
    prisma.sistemaDisputasChaves.findMany({
      where: { competicao_id },
      orderBy: { numero_inscrito: 'asc' },
    }),
  criar: (data: ChavesPayload) => prisma.sistemaDisputasChaves.create({ data }),
  editar: (id: number, data: Partial<ChavesPayload>) =>
    prisma.sistemaDisputasChaves.update({ where: { id }, data }),
  remover: (id: number) => prisma.sistemaDisputasChaves.delete({ where: { id } }),
}

export type CopiarPayload = {
  origem_id: number
  destino_id: number
  tipo: 'grupos' | 'chaves' | 'ambos'
}

export async function copiar({ origem_id, destino_id, tipo }: CopiarPayload) {
  if (origem_id === destino_id) {
    throw Object.assign(new Error('Origem e destino devem ser competições diferentes.'), { status: 400 })
  }
  return prisma.$transaction(async tx => {
    let grupos_copiados = 0
    let chaves_copiadas = 0

    if (tipo === 'grupos' || tipo === 'ambos') {
      await tx.sistemaDisputasGrupos.deleteMany({ where: { competicao_id: destino_id } })
      const fonte = await tx.sistemaDisputasGrupos.findMany({ where: { competicao_id: origem_id } })
      if (fonte.length > 0) {
        await tx.sistemaDisputasGrupos.createMany({
          data: fonte.map(r => ({
            quantidade_equipes: r.quantidade_equipes,
            quantidade_grupos: r.quantidade_grupos,
            grupos_3_componentes: r.grupos_3_componentes,
            grupos_4_componentes: r.grupos_4_componentes,
            numero_classificados: r.numero_classificados,
            competicao_id: destino_id,
          })),
        })
        grupos_copiados = fonte.length
      }
    }

    if (tipo === 'chaves' || tipo === 'ambos') {
      await tx.sistemaDisputasChaves.deleteMany({ where: { competicao_id: destino_id } })
      const fonte = await tx.sistemaDisputasChaves.findMany({ where: { competicao_id: origem_id } })
      if (fonte.length > 0) {
        await tx.sistemaDisputasChaves.createMany({
          data: fonte.map(r => ({
            numero_inscrito: r.numero_inscrito,
            posicao_primeiro_cabeca: r.posicao_primeiro_cabeca,
            posicao_segundo_cabeca: r.posicao_segundo_cabeca,
            posicao_terceiro_cabeca: r.posicao_terceiro_cabeca,
            posicao_quarto_cabeca: r.posicao_quarto_cabeca,
            competicao_id: destino_id,
          })),
        })
        chaves_copiadas = fonte.length
      }
    }

    return { grupos_copiados, chaves_copiadas }
  })
}
