import ExcelJS from 'exceljs'
import prisma from '../../lib/prisma'
import { getModalidadeIdsExcluidas } from '../eventos/evento-modalidades.service'
import { esporteBase } from '../../lib/esporte'
import { sheetSafe } from '../../lib/sheet-safe'
import { COR, aplicarEstilo, aplicarBordas, aplicarBordaExterna } from './xlsx-style'

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

/** Larguras do modelo (`congresso_jeesp.xlsx`), por letra de coluna. */
const LARGURAS: Record<string, number> = {
  A: 3, B: 20, C: 32, D: 18.5, E: 2.5,
  I: 30.5, J: 27, K: 32, L: 28.5, M: 2.5,
  N: 10, O: 4, P: 2.5, Q: 32, R: 2.5, S: 33,
}

const COL_GRUPOS = ['I', 'J', 'K', 'L'] as const
const letraParaIndice = (letra: string) => letra.charCodeAt(0) - 64 // 'A' → 1

/** Reforça só a aresta superior de uma faixa (o modelo marca a linha abaixo do
 *  cabeçalho nos dois lados: bottom do cabeçalho e top da 1ª linha de dados). */
function bordaTopo(ws: ExcelJS.Worksheet, row: number, c1: number, c2: number, argb: string) {
  for (let c = c1; c <= c2; c++) {
    const cell = ws.getRow(row).getCell(c)
    cell.border = { ...(cell.border ?? {}), top: { style: 'medium', color: { argb } } }
  }
}

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
  const siglaCell = ws.getCell(`C${base}`)
  siglaCell.value = sheetSafe(modalidade.sigla)
  aplicarEstilo(siglaCell, { bold: true, fontSize: 12, fontColor: COR.azul })
  siglaCell.alignment = { horizontal: 'center' }

  const cab = base + 1
  const cabecalhos: [string, string][] = [
    [`B${cab}`, 'Diretorias'],
    [`C${cab}`, 'Unidades Escolares'],
    [`D${cab}`, 'Municípios'],
  ]
  for (const [ref, texto] of cabecalhos) {
    const c = ws.getCell(ref)
    c.value = texto
    aplicarEstilo(c, { bold: true, fontColor: COR.branco, fill: COR.azul })
    c.alignment = { horizontal: 'center' }
  }

  // LOCAL/END. ficam sem valor: são preenchidos à mão no congresso.
  for (const ref of [`N${cab}`, `O${cab}`]) {
    ws.getCell(ref).value = 'LOCAL:'
    aplicarEstilo(ws.getCell(ref), { bold: true, fontSize: 10 })
  }
  for (const ref of [`N${cab + 1}`, `O${cab + 1}`]) {
    ws.getCell(ref).value = 'END.:'
    aplicarEstilo(ws.getCell(ref), { bold: true, fontSize: 10 })
  }

  linhas.slice(0, LINHAS_INSCRITOS).forEach((l, i) => {
    const r = base + 2 + i
    const num = ws.getCell(`A${r}`)
    num.value = i + 1
    aplicarEstilo(num, { fontColor: COR.preto })
    num.alignment = { horizontal: 'center' }

    ws.getCell(`B${r}`).value = sheetSafe(l.nome)
    ws.getCell(`C${r}`).value = sheetSafe(l.escola)
    ws.getCell(`D${r}`).value = sheetSafe(l.municipio)
    for (const col of ['B', 'C', 'D']) {
      const c = ws.getCell(`${col}${r}`)
      aplicarEstilo(c, { fontSize: col === 'B' ? 11 : 10, fontColor: COR.preto, fill: COR.branco })
      c.alignment = { horizontal: 'left' }
    }
  })

  // Grade fina no bloco inteiro, contorno grosso por fora e a linha do cabeçalho
  // reforçada nos dois lados — exatamente como o modelo desenha.
  const ultimaLinha = base + 1 + LINHAS_INSCRITOS
  const bIdx = letraParaIndice('B')
  const dIdx = letraParaIndice('D')
  aplicarBordas(ws, cab, bIdx, ultimaLinha, dIdx, COR.azul)
  aplicarBordaExterna(ws, cab, bIdx, ultimaLinha, dIdx, COR.azul, 'medium')
  aplicarBordaExterna(ws, cab, bIdx, cab, dIdx, COR.azul, 'medium')
  bordaTopo(ws, cab + 1, bIdx, dIdx, COR.azul)
  // No modelo a lateral esquerda grossa só começa na 1ª linha de dados: o
  // cabeçalho fica com a esquerda fina.
  const cabB = ws.getCell(`B${cab}`)
  cabB.border = { ...(cabB.border ?? {}), left: { style: 'thin', color: { argb: COR.azul } } }

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
  const COL = COL_GRUPOS
  grupos.slice(0, COL.length).forEach((g, gi) => {
    const col = COL[gi]
    const head = ws.getCell(`${col}${base + 1}`)
    head.value = `GRUPO ${g.letra}`
    aplicarEstilo(head, { bold: true, fontColor: COR.branco, fill: COR.azul })
    head.alignment = { horizontal: 'center' }

    for (let slot = 0; slot < SLOTS_POR_GRUPO; slot++) {
      const linhaEscola = base + 2 + slot * 2
      const l = porId.get(g.participantes[slot])
      if (l) {
        ws.getCell(`${col}${linhaEscola}`).value = sheetSafe(l.escola)
        ws.getCell(`${col}${linhaEscola + 1}`).value = sheetSafe(l.municipio)
      } else {
        ws.getCell(`${col}${linhaEscola + 1}`).value = VAZIO
      }
      // Escola em cima, município embaixo em negrito — hierarquia visual do modelo.
      aplicarEstilo(ws.getCell(`${col}${linhaEscola}`), { fontColor: COR.preto, fill: COR.branco })
      aplicarEstilo(ws.getCell(`${col}${linhaEscola + 1}`), { bold: true, fontColor: COR.preto, fill: COR.branco })
      for (const r of [linhaEscola, linhaEscola + 1]) {
        ws.getCell(`${col}${r}`).alignment = { horizontal: 'center' }
      }
    }

    // A legenda no modelo é texto solto: sem bordas e sem preenchimento.
    const legenda = ws.getCell(`${col}${base + 11}`)
    legenda.value = g.letra
    aplicarEstilo(legenda, { bold: true, fontColor: COR.azul })
    legenda.alignment = { horizontal: 'center' }
    for (let slot = 0; slot < SLOTS_POR_GRUPO; slot++) {
      const l = porId.get(g.participantes[slot])
      const c = ws.getCell(`${col}${base + 12 + slot}`)
      c.value = l ? sheetSafe(l.nome) : VAZIO_LEGENDA
      aplicarEstilo(c, { fontColor: COR.preto })
      c.alignment = { horizontal: 'center' }
    }
  })

  if (grupos.length === 0) return
  // Só os integrantes recebem grade, e ela é fina em todo o retângulo — o
  // cabeçalho "GRUPO x" e a legenda ficam sem borda, como no modelo.
  const c1 = letraParaIndice(COL[0])
  const c2 = letraParaIndice(COL[Math.min(grupos.length, COL.length) - 1])
  aplicarBordas(ws, base + 2, c1, base + 1 + SLOTS_POR_GRUPO * 2, c2, COR.azul)
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
  const inicio = base + 3
  let row = inicio
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

      // Linha da escola normal, linha do município em negrito (como nos grupos).
      for (const col of ['O', 'Q', 'R', 'S']) {
        aplicarEstilo(ws.getCell(`${col}${row}`), { fontSize: 10, fontColor: COR.preto })
        aplicarEstilo(ws.getCell(`${col}${row + 1}`), {
          bold: col === 'R' ? true : col !== 'O',
          fontSize: 10,
          fontColor: COR.preto,
        })
        ws.getCell(`${col}${row}`).alignment = { horizontal: 'center' }
        ws.getCell(`${col}${row + 1}`).alignment = { horizontal: 'center' }
      }
      row += 2
    }
  }

  if (row === inicio) return

  // Bordas da grade de jogos, no desenho do modelo: separadores verticais finos
  // em todas as linhas, mas horizontal só ENTRE jogos — as duas linhas de um
  // mesmo jogo (escolas e municípios) não são separadas. Contorno externo grosso.
  const c1 = letraParaIndice('O')
  const c2 = letraParaIndice('S')
  const fim = row - 1
  const fina = { style: 'thin' as const, color: { argb: COR.preto } }
  const grossa = { style: 'medium' as const, color: { argb: COR.preto } }
  for (let r = inicio; r <= fim; r++) {
    const fimDeJogo = (r - inicio) % 2 === 1
    for (let c = c1; c <= c2; c++) {
      // A linha entre jogos é desenhada uma única vez, pelo `bottom` da 2ª
      // linha do jogo anterior — é assim que o modelo faz.
      const b: any = { left: fina, right: c === c2 ? grossa : fina }
      if (r === inicio) b.top = grossa
      if (r === fim) b.bottom = grossa
      else if (fimDeJogo) b.bottom = fina
      ws.getRow(r).getCell(c).border = b
    }
  }
  // Faixa LOCAL:/END.: com contorno próprio, acima da grade.
  aplicarBordaExterna(ws, base + 1, letraParaIndice('N'), base + 2, c2, COR.preto, 'medium')
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
      const ws = wb.addWorksheet(sheetSafe(esporte) as string)
      for (const [letra, largura] of Object.entries(LARGURAS)) ws.getColumn(letra).width = largura
      aba = { ws, blocos: 0 }
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
