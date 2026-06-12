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

  // Posição alvo (0-indexed) do anfitrião:
  //   - 3 grupos:  idx 2 (grupo C)
  //   - 4+ grupos: idx 3 (grupo D)
  //   - chaves:    idx 3 (4ª cabeça)
  //   - <3 grupos: regra não se aplica
  let targetIdx: number
  if (tipo === 'chaves') {
    targetIdx = 3
  } else {
    if (quantidadeGrupos === undefined || quantidadeGrupos < 3) {
      return campeoesPidsInscritos
    }
    targetIdx = quantidadeGrupos === 3 ? 2 : 3
  }

  // Posições ANTES do alvo: regra do campeão do ano anterior prevalece
  // (anfitrião mantém posição se for um campeão melhor colocado que o alvo).
  // Caso contrário (anfitrião já está no alvo ou depois, ou não é campeão):
  // força ele pra posição alvo, deslocando quem estava lá.
  const currentIdx = campeoesPidsInscritos.indexOf(anfitriaoPid)
  if (currentIdx >= 0 && currentIdx < targetIdx) {
    return campeoesPidsInscritos
  }

  const sem = campeoesPidsInscritos.filter((p) => p !== anfitriaoPid)
  const out = [...sem]
  out.splice(targetIdx, 0, anfitriaoPid)
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
        status: true,
        competicao: { select: { considerar_anfitriao: true } },
      },
    }),
    prisma.modalidade.findUnique({
      where: { id: input.modalidade_id },
      select: {
        id: true,
        competicao_id: true,
        chave_versao: true,
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
  if ((evento as any).status === 'suspenso') {
    throw Object.assign(new Error('Evento suspenso — reative o evento para sortear.'), { status: 400 })
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
    let matchesGraph = regraMatches?.matches_graph ? (regraMatches.matches_graph as any) : null
    // V2: leva os BYEs para a linha da 1ª rodada (congelado no resultado do sorteio)
    if (matchesGraph && modalidade.chave_versao === 'V2') {
      matchesGraph = engine.liftByesToFirstRoundV2(matchesGraph)
    }
    const cabecasFinais = applyAnfitriaoRule({
      campeoesPidsInscritos,
      anfitriaoPid,
      anfitriaoInscrito,
      consideraAnfitriao,
      tipo: 'chaves',
    })
    resultado = engine.drawBracket(pids, regra, regraBracket, matchesGraph, seed, cabecasFinais)
  } else if (tipo === 'ordem_entrada') {
    const cfg = (consideraAnfitriao && anfitriaoInscrito && anfitriaoPid != null)
      ? await prisma.eventoModalidadeAnfitriao.findUnique({
          where: { evento_id_modalidade_id: { evento_id: input.evento_id, modalidade_id: input.modalidade_id } },
          select: { posicao: true },
        })
      : null
    if (cfg && anfitriaoPid != null) {
      if (cfg.posicao > pids.length) {
        throw Object.assign(
          new Error(`A posição do anfitrião (${cfg.posicao}) excede o nº de inscritos (${pids.length}).`),
          { status: 400 },
        )
      }
      resultado = engine.shuffleOrderAnfitriao(pids, seed, anfitriaoPid, cfg.posicao)
    } else {
      resultado = engine.shuffleOrder(pids, seed)
    }
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
