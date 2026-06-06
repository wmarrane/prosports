import { randomBytes } from 'crypto'
import prisma from '../../lib/prisma'
import * as engine from './engine'

function novaSeed(): string {
  return randomBytes(8).toString('hex')
}

/**
 * Aplica regra do anfitrião do evento: se o anfitrião está inscrito e ainda
 * não é cabeça (top-4), injeta-o numa posição específica de cabeça.
 *
 * - Grupos com < 3 grupos: regra não se aplica
 * - Grupos com == 3 grupos: anfitrião vira cabeça do grupo C (pos 3, 1-indexed)
 * - Grupos com >= 4 grupos: anfitrião vira cabeça do grupo D (pos 4, 1-indexed)
 * - Chaves (sempre máx 4 cabeças): anfitrião vira 4º cabeça
 *
 * Quem ocupava o slot é deslocado para a posição seguinte. Em chaves, isso
 * efetivamente "expulsa" o antigo 4º já que o engine só usa as 4 primeiras.
 */
export function applyAnfitriaoRule(params: {
  campeoesPidsInscritos: number[]
  anfitriaoPid: number | null
  anfitriaoInscrito: boolean
  consideraAnfitriao: boolean
  tipo: 'grupos' | 'chaves'
  quantidadeGrupos?: number
}): number[] {
  const { campeoesPidsInscritos, anfitriaoPid, anfitriaoInscrito, consideraAnfitriao, tipo, quantidadeGrupos } = params

  if (!consideraAnfitriao || anfitriaoPid === null || !anfitriaoInscrito) {
    return campeoesPidsInscritos
  }

  // Regra do anfitrião tem prioridade sobre a ordenação das cabeças.
  // Mesmo se o anfitrião ja for campeao em posicao 0/1/2, ele DEVE ser
  // movido pra posicao alvo (ultimo grupo / 4a cabeca em chaves), pra
  // garantir que vai pro grupo final mesmo que isso "desloque" um campeao.
  let targetPos1Indexed: number
  if (tipo === 'chaves') {
    targetPos1Indexed = 4
  } else {
    if (quantidadeGrupos === undefined || quantidadeGrupos < 3) {
      return campeoesPidsInscritos  // < 3 grupos: regra não se aplica
    }
    targetPos1Indexed = quantidadeGrupos === 3 ? 3 : 4
  }

  // Remove anfitrião de qualquer posição atual e insere no target.
  // Funciona tanto se ele ja era campeao (move) quanto se nao (insere).
  const sem = campeoesPidsInscritos.filter(p => p !== anfitriaoPid)
  const out = [...sem]
  out.splice(targetPos1Indexed - 1, 0, anfitriaoPid)
  return out
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

export async function removerTodosDoEvento(evento_id: number): Promise<{ count: number }> {
  const r = await prisma.sorteio.deleteMany({ where: { evento_id } })
  return { count: r.count }
}

export async function executar(input: { evento_id: number; modalidade_id: number }) {
  const [evento, modalidade] = await Promise.all([
    prisma.evento.findUnique({
      where: { id: input.evento_id },
      select: {
        id: true,
        competicao_id: true,
        anfitriao_id: true,
        competicao: { select: { considerar_anfitriao: true } },
      },
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

  const anfitriaoPid = evento.anfitriao_id
  const consideraAnfitriao = evento.competicao?.considerar_anfitriao ?? false
  const anfitriaoInscrito = anfitriaoPid !== null && inscritosSet.has(anfitriaoPid)

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
    const cabecasFinais = applyAnfitriaoRule({
      campeoesPidsInscritos,
      anfitriaoPid,
      anfitriaoInscrito,
      consideraAnfitriao,
      tipo: 'grupos',
      quantidadeGrupos: regra.quantidade_grupos,
    })
    resultado = engine.drawGroups(pids, regra, seed, cabecasFinais)
  } else if (tipo === 'chaves') {
    const [regra, regraBracket, regraMatches] = await Promise.all([
      prisma.sistemaDisputasChaves.findFirst({
        where: { competicao_id: evento.competicao_id, numero_inscrito: pids.length },
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
    const cabecasFinais = applyAnfitriaoRule({
      campeoesPidsInscritos,
      anfitriaoPid,
      anfitriaoInscrito,
      consideraAnfitriao,
      tipo: 'chaves',
    })
    resultado = engine.drawBracket(pids, regra, regraBracket, matchesGraph, seed, cabecasFinais)
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
