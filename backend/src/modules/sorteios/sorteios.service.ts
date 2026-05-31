import { randomBytes } from 'crypto'
import prisma from '../../lib/prisma'
import * as engine from './engine'

function novaSeed(): string {
  return randomBytes(8).toString('hex')
}

export async function listar(filtros: { evento_id?: number; modalidade_id?: number }) {
  const where: { evento_id?: number; modalidade_id?: number } = {}
  if (filtros.evento_id !== undefined) where.evento_id = filtros.evento_id
  if (filtros.modalidade_id !== undefined) where.modalidade_id = filtros.modalidade_id
  return prisma.sorteio.findMany({ where, orderBy: { gerado_em: 'desc' } })
}

export async function buscarPorId(id: number) {
  const item = await prisma.sorteio.findUnique({ where: { id } })
  if (!item) throw Object.assign(new Error('Sorteio não encontrado'), { status: 404 })
  return item
}

export async function remover(id: number) {
  return prisma.sorteio.delete({ where: { id } })
}

export async function executar(input: { evento_id: number; modalidade_id: number }) {
  const [evento, modalidade] = await Promise.all([
    prisma.evento.findUnique({
      where: { id: input.evento_id },
      select: { id: true, competicao_id: true },
    }),
    prisma.modalidade.findUnique({
      where: { id: input.modalidade_id },
      select: {
        id: true,
        competicao_id: true,
        tipo_modalidade: { select: { tipo: true } },
      },
    }),
  ])
  if (!evento) throw Object.assign(new Error('Evento não encontrado'), { status: 404 })
  if (!modalidade) throw Object.assign(new Error('Modalidade não encontrada'), { status: 404 })
  if (evento.competicao_id !== modalidade.competicao_id) {
    throw Object.assign(
      new Error('A modalidade não pertence à competição deste evento.'),
      { status: 400 },
    )
  }

  const tipo = modalidade.tipo_modalidade.tipo

  if (tipo === 'especifico') {
    throw Object.assign(
      new Error("Modalidade do tipo 'específico' não possui sorteio automático."),
      { status: 400 },
    )
  }

  const inscricoes = await prisma.inscricao.findMany({
    where: { evento_id: input.evento_id, modalidade_id: input.modalidade_id },
    orderBy: { criado_em: 'asc' },
    select: { participante_id: true },
  })
  if (inscricoes.length === 0) {
    throw Object.assign(
      new Error('Nenhum participante inscrito nesta modalidade.'),
      { status: 400 },
    )
  }
  const pids = inscricoes.map(i => i.participante_id)
  const inscritosSet = new Set<number>(pids)

  // Campeões cadastrados ordenados por posição, filtrados pelos que estão inscritos
  let campeoesPidsInscritos: number[] = []
  if (tipo === 'grupos' || tipo === 'chaves') {
    const campeoes = await prisma.campeaoAnterior.findMany({
      where: { evento_id: input.evento_id, modalidade_id: input.modalidade_id },
      orderBy: { posicao: 'asc' },
      select: { participante_id: true },
    })
    campeoesPidsInscritos = campeoes
      .map(c => c.participante_id)
      .filter(pid => inscritosSet.has(pid))
  }

  const seed = novaSeed()
  let resultado: unknown

  if (tipo === 'grupos') {
    const regra = await prisma.sistemaDisputasGrupos.findFirst({
      where: { competicao_id: evento.competicao_id, quantidade_equipes: pids.length },
    })
    if (!regra) {
      throw Object.assign(
        new Error(
          `Não há regra de composição de grupos para ${pids.length} equipes nesta competição. Cadastre em Administração.`,
        ),
        { status: 400 },
      )
    }
    resultado = engine.drawGroups(pids, regra, seed, campeoesPidsInscritos)
  } else if (tipo === 'chaves') {
    const [regra, regraBracket, regraMatches] = await Promise.all([
      prisma.sistemaDisputasChaves.findFirst({
        where: { numero_inscrito: pids.length },
      }),
      prisma.bracketChavesByes.findUnique({
        where: { numero_inscrito: pids.length },
      }),
      prisma.bracketChavesMatches.findUnique({
        where: { numero_inscrito: pids.length },
      }),
    ])
    if (!regra) {
      throw Object.assign(
        new Error(
          `Não há regra de chaveamento para ${pids.length} inscritos. Cadastre em Administração.`,
        ),
        { status: 400 },
      )
    }
    if (!regraBracket) {
      throw Object.assign(
        new Error(
          `Não há estrutura de bracket cadastrada para ${pids.length} inscritos. Cadastre em Administração.`,
        ),
        { status: 400 },
      )
    }
    // matchesGraph is optional — if missing, frontend falls back to legacy render
    const matchesGraph = regraMatches?.matches_graph ? (regraMatches.matches_graph as any) : null
    resultado = engine.drawBracket(pids, regra, regraBracket, matchesGraph, seed, campeoesPidsInscritos)
  } else if (tipo === 'ordem_entrada') {
    resultado = engine.shuffleOrder(pids, seed)
  } else {
    throw Object.assign(new Error(`Tipo desconhecido: ${tipo}`), { status: 500 })
  }

  return prisma.sorteio.upsert({
    where: {
      evento_id_modalidade_id: {
        evento_id: input.evento_id,
        modalidade_id: input.modalidade_id,
      },
    },
    create: {
      evento_id: input.evento_id,
      modalidade_id: input.modalidade_id,
      tipo,
      seed,
      resultado: resultado as any,
    },
    update: {
      tipo,
      seed,
      resultado: resultado as any,
    },
  })
}
