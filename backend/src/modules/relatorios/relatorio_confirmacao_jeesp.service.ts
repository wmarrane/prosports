import ExcelJS from 'exceljs'
import prisma from '../../lib/prisma'
import { getModalidadeIdsExcluidas } from '../eventos/evento-modalidades.service'
import { sheetSafe } from '../../lib/sheet-safe'

/**
 * Planilha plana de confirmação do JEESP: uma linha por (participante ×
 * modalidade), com a coluna J montando um `insert into confirmacao (...)` para
 * alimentar o sistema legado. Formato espelha `personaladmin/reports/
 * congresso_jeesp.xlsx` (aba `Planilha1`, dados a partir da linha 3).
 *
 * Os valores "legados" (códigos e nomes do sistema antigo) não existem no
 * prosports — vêm de um form no momento do export.
 */
export type ConfirmacaoJeespParams = {
  codCompeticao: number
  competicao: string
  divisao: string
  codMunicipioSede: number
  municipioSede: string
  codModalidade: number
}

/** Linha extra que o modelo traz uma vez por modalidade, além dos inscritos. */
const LINHA_CIDADE_SEDE = 'Cidade Sede'

export function nomeArquivoConfirmacao(evento: { nome: string; id: number }): string {
  const slug = evento.nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
  return `Confirmacao_${slug || `evento_${evento.id}`}.xlsx`
}

export async function gerarConfirmacaoJeespXlsx(
  evento_id: number,
  params: ConfirmacaoJeespParams,
): Promise<Buffer> {
  const evento = await prisma.evento.findUnique({
    where: { id: evento_id },
    select: { competicao_id: true },
  })
  if (!evento) throw Object.assign(new Error('Evento não encontrado'), { status: 404 })

  const excluidasIds = await getModalidadeIdsExcluidas(evento_id)
  const modalidades = (
    await prisma.modalidade.findMany({
      where: { competicao_id: evento.competicao_id, ativa: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    })
  ).filter((m) => !excluidasIds.has(m.id))

  const inscricoes = await prisma.inscricao.findMany({
    where: { evento_id },
    select: { modalidade_id: true, participante: { select: { nome: true } } },
    orderBy: { participante: { nome: 'asc' } },
  })

  const porModalidade = new Map<number, string[]>()
  for (const i of inscricoes) {
    const arr = porModalidade.get(i.modalidade_id) ?? []
    arr.push(i.participante?.nome ?? '—')
    porModalidade.set(i.modalidade_id, arr)
  }

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Planilha1')

  let row = 3 // linhas 1-2 ficam em branco, como no modelo
  const escreveLinha = (municipio: string, modalidadeNome: string) => {
    ws.getCell(`A${row}`).value = row - 2 // sequencial cosmético — não entra no SQL da coluna J
    ws.getCell(`B${row}`).value = sheetSafe(municipio)
    ws.getCell(`C${row}`).value = params.codModalidade
    ws.getCell(`D${row}`).value = sheetSafe(modalidadeNome)
    ws.getCell(`E${row}`).value = params.codCompeticao
    ws.getCell(`F${row}`).value = sheetSafe(params.competicao)
    ws.getCell(`G${row}`).value = sheetSafe(params.divisao)
    ws.getCell(`H${row}`).value = params.codMunicipioSede
    ws.getCell(`I${row}`).value = sheetSafe(params.municipioSede)
    ws.getCell(`J${row}`).value = {
      formula:
        `"insert into confirmacao (Municipio, CodModalidade, Modalidade, CodCompeticao, Competicao, Divisao, CodMunicipioSede, MunicipioSede)\n` +
        `values ('"&B${row}&"',"&$C${row}&",'"&$D${row}&"',"&$E${row}&",'"&$F${row}&"','"&$G${row}&"',"&$H${row}&",'"&$I${row}&"')"`,
    }
    row++
  }

  for (const m of modalidades) {
    const insc = porModalidade.get(m.id) ?? []
    if (insc.length === 0) continue // modalidade sem inscritos não vai para a planilha
    for (const nome of insc) escreveLinha(nome, m.nome)
    escreveLinha(LINHA_CIDADE_SEDE, m.nome)
  }

  ws.getColumn(10).width = 90 // J: a fórmula é longa

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}
