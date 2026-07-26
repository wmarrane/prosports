import ExcelJS from 'exceljs'
import prisma from '../../lib/prisma'
import { getModalidadeIdsExcluidas } from '../eventos/evento-modalidades.service'
import { esporteBase } from '../../lib/esporte'
import { sheetSafe } from '../../lib/sheet-safe'

/**
 * Relatório do Congresso Técnico no layout do JEESP, espelhando
 * `personaladmin/reports/congresso_jeesp.xlsx`.
 *
 * Uma aba por ESPORTE (feminino e masculino no mesmo tab — regra do JEESP), com
 * um bloco por modalidade empilhado no passo de 29 linhas. Cada bloco tem três
 * áreas: a lista de inscritos (Diretoria / Escola / Município), os grupos do
 * sorteio e a grade de jogos da 1ª rodada.
 *
 * Escola e município saem dos overrides por modalidade da inscrição (escolar);
 * nada aqui é digitado pelo usuário.
 *
 * Design: docs/superpowers/specs/2026-07-25-congresso-jeesp-relatorio-design.md
 */

/** Distância entre o topo de um bloco e o topo do seguinte, como no modelo. */
const PASSO_BLOCO = 29
/** Linhas de inscritos por bloco (15 diretorias + Cidade Sede). */
const LINHAS_INSCRITOS = 16
/** Slots por grupo — o modelo reserva 4 mesmo quando o grupo tem menos. */
const SLOTS_POR_GRUPO = 4
/** Pares da 1ª rodada, os mesmos do relatório padrão (fillProgramacao). */
const PARES_1A_RODADA: readonly (readonly [number, number])[] = [
  [1, 4],
  [2, 3],
]
const VAZIO = '-----'
const VAZIO_LEGENDA = '----x-----'
const ANFITRIAO = 'Cidade Sede'

type Linha = { nome: string; escola: string; municipio: string; participanteId: number | null }

function ehAnfitriao(nome: string): boolean {
  return nome.trim().toLowerCase() === ANFITRIAO.toLowerCase()
}

/**
 * Idade/categoria embutida no nome da modalidade ("Basquetebol Feminino 14
 * anos" → 14). Os blocos são agrupados por idade, então feminino e masculino da
 * mesma categoria ficam lado a lado. Nome sem número (ex.: "Xadrez Feminino
 * Infantil", como no modelo do JEESP) cai no fim e vale a ordem alfabética.
 */
function idadeDaModalidade(nome: string): number {
  const m = nome.match(/\d+/)
  return m ? Number(m[0]) : Number.MAX_SAFE_INTEGER
}

function ordenarModalidades<T extends { nome: string }>(modalidades: T[]): T[] {
  return [...modalidades].sort(
    (a, b) =>
      idadeDaModalidade(a.nome) - idadeDaModalidade(b.nome) ||
      a.nome.localeCompare(b.nome, 'pt-BR'),
  )
}

/** Nome do município do override da inscrição (escolar). Sem override, vazio. */
function municipioDaInscricao(insc: any): string {
  return insc.municipio?.nome ?? ''
}

function toLinha(insc: any): Linha {
  return {
    nome: insc.participante?.nome ?? '—',
    escola: insc.subtitulo ?? '',
    municipio: municipioDaInscricao(insc),
    participanteId: insc.participante?.id ?? null,
  }
}

/**
 * Inscritos do bloco: ordenados por nome, com o anfitrião sempre por último —
 * ele costuma vir cadastrado como participante (o import do Jeesp o cria) e no
 * modelo ocupa a 16ª linha.
 */
function ordenarInscritos(inscricoes: any[]): Linha[] {
  const linhas = inscricoes.map(toLinha)
  const normais = linhas.filter((l) => !ehAnfitriao(l.nome))
  const anfitriao = linhas.find((l) => ehAnfitriao(l.nome))
  return anfitriao ? [...normais, anfitriao] : [...normais, { nome: ANFITRIAO, escola: '', municipio: '', participanteId: null }]
}

function escreveBloco(
  ws: ExcelJS.Worksheet,
  base: number,
  modalidade: { sigla: string },
  linhas: Linha[],
  grupos: { letra: string; participantes: number[] }[],
  porId: Map<number, Linha>,
) {
  ws.getCell(`C${base}`).value = sheetSafe(modalidade.sigla)

  const cab = base + 1
  ws.getCell(`B${cab}`).value = 'Diretorias'
  ws.getCell(`C${cab}`).value = 'Unidades Escolares'
  ws.getCell(`D${cab}`).value = 'Municípios'
  // LOCAL/END. ficam sem valor: são preenchidos à mão no congresso.
  ws.getCell(`N${cab}`).value = 'LOCAL:'
  ws.getCell(`O${cab}`).value = 'LOCAL:'
  ws.getCell(`N${cab + 1}`).value = 'END.:'
  ws.getCell(`O${cab + 1}`).value = 'END.:'

  linhas.slice(0, LINHAS_INSCRITOS).forEach((l, i) => {
    const r = base + 2 + i
    ws.getCell(`A${r}`).value = i + 1
    ws.getCell(`B${r}`).value = sheetSafe(l.nome)
    ws.getCell(`C${r}`).value = sheetSafe(l.escola)
    ws.getCell(`D${r}`).value = sheetSafe(l.municipio)
  })

  escreveGrupos(ws, base, grupos, porId)
  escreveJogos(ws, base, modalidade.sigla, grupos, porId)
}

/**
 * Grupos: cada integrante ocupa duas linhas (escola em cima, município embaixo);
 * abaixo, uma legenda com o nome da diretoria por slot. Slots sem integrante
 * viram "-----" (e "----x-----" na legenda), como no modelo.
 */
function escreveGrupos(
  ws: ExcelJS.Worksheet,
  base: number,
  grupos: { letra: string; participantes: number[] }[],
  porId: Map<number, Linha>,
) {
  const COL = ['I', 'J', 'K', 'L']
  grupos.slice(0, COL.length).forEach((g, gi) => {
    const col = COL[gi]
    ws.getCell(`${col}${base + 1}`).value = `GRUPO ${g.letra}`

    for (let slot = 0; slot < SLOTS_POR_GRUPO; slot++) {
      const linhaEscola = base + 2 + slot * 2
      const l = porId.get(g.participantes[slot])
      if (l) {
        ws.getCell(`${col}${linhaEscola}`).value = sheetSafe(l.escola)
        ws.getCell(`${col}${linhaEscola + 1}`).value = sheetSafe(l.municipio)
      } else {
        ws.getCell(`${col}${linhaEscola + 1}`).value = VAZIO
      }
    }

    ws.getCell(`${col}${base + 11}`).value = g.letra
    for (let slot = 0; slot < SLOTS_POR_GRUPO; slot++) {
      const l = porId.get(g.participantes[slot])
      ws.getCell(`${col}${base + 12 + slot}`).value = l ? sheetSafe(l.nome) : VAZIO_LEGENDA
    }
  })
}

/**
 * Grade de jogos da 1ª rodada. Cada jogo ocupa duas linhas: escolas em cima,
 * municípios embaixo. Quando o adversário não existe (grupo incompleto), a
 * linha das escolas fica vazia e a dos municípios recebe "-----".
 */
function escreveJogos(
  ws: ExcelJS.Worksheet,
  base: number,
  sigla: string,
  grupos: { letra: string; participantes: number[] }[],
  porId: Map<number, Linha>,
) {
  let row = base + 3
  for (const g of grupos) {
    for (const [a, b] of PARES_1A_RODADA) {
      const casa = porId.get(g.participantes[a - 1])
      const fora = porId.get(g.participantes[b - 1])

      ws.getCell(`O${row}`).value = sheetSafe(sigla)
      ws.getCell(`R${row}`).value = 'X'
      if (casa) ws.getCell(`Q${row}`).value = sheetSafe(casa.escola)
      if (fora) ws.getCell(`S${row}`).value = sheetSafe(fora.escola)

      ws.getCell(`O${row + 1}`).value = sheetSafe(sigla)
      ws.getCell(`R${row + 1}`).value = 'X'
      if (casa) ws.getCell(`Q${row + 1}`).value = sheetSafe(casa.municipio)
      ws.getCell(`S${row + 1}`).value = fora ? sheetSafe(fora.municipio) : VAZIO

      row += 2
    }
  }
}

export async function gerarCongressoJeespXlsx(evento_id: number): Promise<Buffer> {
  const evento = await prisma.evento.findUnique({
    where: { id: evento_id },
    select: { id: true, nome: true, competicao_id: true },
  })
  if (!evento) throw Object.assign(new Error('Evento não encontrado'), { status: 404 })

  const excluidas = await getModalidadeIdsExcluidas(evento_id)
  const modalidades = ordenarModalidades(
    (
      await prisma.modalidade.findMany({
        where: { competicao_id: evento.competicao_id, ativa: true },
        select: { id: true, sigla: true, nome: true },
        orderBy: { nome: 'asc' },
      })
    ).filter((m) => !excluidas.has(m.id)),
  )

  const inscricoes = await prisma.inscricao.findMany({
    where: { evento_id },
    include: { municipio: true, participante: true },
    orderBy: { participante: { nome: 'asc' } },
  })
  const porModalidade = new Map<number, any[]>()
  for (const i of inscricoes) {
    const arr = porModalidade.get(i.modalidade_id) ?? []
    arr.push(i)
    porModalidade.set(i.modalidade_id, arr)
  }

  const sorteios = await prisma.sorteio.findMany({ where: { evento_id } })
  const sorteioPorModalidade = new Map(sorteios.map((s: any) => [s.modalidade_id, s]))

  const wb = new ExcelJS.Workbook()
  const abas = new Map<string, { ws: ExcelJS.Worksheet; blocos: number }>()

  for (const mod of modalidades) {
    const inscricoesMod = porModalidade.get(mod.id) ?? []
    if (inscricoesMod.length === 0) continue

    const esporte = esporteBase(mod.nome)
    let aba = abas.get(esporte)
    if (!aba) {
      aba = { ws: wb.addWorksheet(sheetSafe(esporte) as string), blocos: 0 }
      abas.set(esporte, aba)
    }

    const linhas = ordenarInscritos(inscricoesMod)
    const porId = new Map<number, Linha>()
    for (const l of linhas) if (l.participanteId != null) porId.set(l.participanteId, l)

    const grupos = ((sorteioPorModalidade.get(mod.id)?.resultado as any)?.grupos ?? []) as {
      letra: string
      participantes: number[]
    }[]

    escreveBloco(aba.ws, aba.blocos * PASSO_BLOCO + 1, mod, linhas, grupos, porId)
    aba.blocos++
  }

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}

export function nomeArquivoCongressoJeesp(evento: { nome: string; id: number }): string {
  const slug = evento.nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
  return `Congresso_JEESP_${slug || `evento_${evento.id}`}.xlsx`
}
