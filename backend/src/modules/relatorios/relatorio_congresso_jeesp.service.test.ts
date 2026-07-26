import { it, expect, vi, beforeEach } from 'vitest'
import ExcelJS from 'exceljs'

vi.mock('../../lib/prisma', () => ({
  default: {
    evento: { findUnique: vi.fn() },
    modalidade: { findMany: vi.fn() },
    inscricao: { findMany: vi.fn() },
    sorteio: { findMany: vi.fn() },
    eventoModalidadeExcluida: { findMany: vi.fn() },
  },
}))

import prisma from '../../lib/prisma'
import { gerarCongressoJeespXlsx } from './relatorio_congresso_jeesp.service'

const p = prisma as any

/** Inscrição do escolar: o nome vem do participante; escola e município são os
 *  overrides da própria inscrição. */
function insc(modalidade_id: number, nome: string, escola: string, municipio: string, id = nome) {
  return {
    modalidade_id,
    participante: { id, nome },
    subtitulo: escola,
    municipio: { nome: municipio, uf: 'SP' },
  }
}

async function gerar() {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load((await gerarCongressoJeespXlsx(5)) as any)
  return wb
}

beforeEach(() => {
  vi.clearAllMocks()
  p.evento.findUnique.mockResolvedValue({ id: 5, competicao_id: 4, nome: 'Jeesp Mirim' })
  p.eventoModalidadeExcluida.findMany.mockResolvedValue([])
  p.sorteio.findMany.mockResolvedValue([])
})

it('cria uma aba por esporte, com feminino e masculino no mesmo tab', async () => {
  p.modalidade.findMany.mockResolvedValue([
    { id: 1, sigla: 'BF14', nome: 'Basquetebol Feminino 14 anos' },
    { id: 2, sigla: 'BM14', nome: 'Basquetebol Masculino 14 anos' },
    { id: 3, sigla: 'HF14', nome: 'Handebol Feminino 14 anos' },
  ])
  p.inscricao.findMany.mockResolvedValue([
    insc(1, 'SREL Bauru', 'EE Bauru', 'Bauru'),
    insc(2, 'SREL Bauru', 'EE Bauru', 'Bauru'),
    insc(3, 'SREL Bauru', 'EE Bauru', 'Bauru'),
  ])

  const wb = await gerar()
  expect(wb.worksheets.map((w) => w.name)).toEqual(['Basquetebol', 'Handebol'])
})

it('empilha um bloco por modalidade no passo de 29 linhas, com a sigla no topo', async () => {
  p.modalidade.findMany.mockResolvedValue([
    { id: 1, sigla: 'BF14', nome: 'Basquetebol Feminino 14 anos' },
    { id: 2, sigla: 'BM14', nome: 'Basquetebol Masculino 14 anos' },
    { id: 3, sigla: 'BF17', nome: 'Basquetebol Feminino 17 anos' },
  ])
  p.inscricao.findMany.mockResolvedValue([
    insc(1, 'SREL Bauru', 'EE Bauru', 'Bauru'),
    insc(2, 'SREL Bauru', 'EE Bauru', 'Bauru'),
    insc(3, 'SREL Bauru', 'EE Bauru', 'Bauru'),
  ])

  const ws = (await gerar()).getWorksheet('Basquetebol')!
  expect(ws.getCell('C1').value).toBe('BF14')
  expect(ws.getCell('C30').value).toBe('BM14')
  expect(ws.getCell('C59').value).toBe('BF17')
  // cabeçalhos do bloco
  expect(ws.getCell('B2').value).toBe('Diretorias')
  expect(ws.getCell('C2').value).toBe('Unidades Escolares')
  expect(ws.getCell('D2').value).toBe('Municípios')
  expect(ws.getCell('B31').value).toBe('Diretorias')
})

it('lista inscritos com escola e município do override, Cidade Sede por último', async () => {
  p.modalidade.findMany.mockResolvedValue([
    { id: 1, sigla: 'BF14', nome: 'Basquetebol Feminino 14 anos' },
  ])
  p.inscricao.findMany.mockResolvedValue([
    insc(1, 'Cidade Sede', '', ''),
    insc(1, 'SREL Araçatuba', 'EE Dr Carlos Rosa', 'Birigui'),
    insc(1, 'SREL Bauru', 'EE Bauru', 'Bauru'),
  ])

  const ws = (await gerar()).getWorksheet('Basquetebol')!
  expect([ws.getCell('A3').value, ws.getCell('B3').value, ws.getCell('C3').value, ws.getCell('D3').value])
    .toEqual([1, 'SREL Araçatuba', 'EE Dr Carlos Rosa', 'Birigui'])
  expect(ws.getCell('B4').value).toBe('SREL Bauru')
  expect(ws.getCell('B5').value).toBe('Cidade Sede')
  expect(ws.getCell('A5').value).toBe(3)
})

it('grupos: escola e município em linhas alternadas, slot vazio vira -----', async () => {
  p.modalidade.findMany.mockResolvedValue([
    { id: 1, sigla: 'BF14', nome: 'Basquetebol Feminino 14 anos' },
  ])
  p.inscricao.findMany.mockResolvedValue([
    insc(1, 'SREL Capital', 'Colegio Campos Sales', 'São Paulo', 'p1'),
    insc(1, 'SREL Sorocaba', 'Escola Portal', 'Sorocaba', 'p2'),
    insc(1, 'SREL Barretos', 'Colegio Alpha', 'Barretos', 'p3'),
  ])
  p.sorteio.findMany.mockResolvedValue([
    {
      modalidade_id: 1,
      resultado: {
        grupos: [
          { letra: 'A', participantes: ['p1', 'p2'] },
          { letra: 'B', participantes: ['p3'] },
        ],
      },
    },
  ])

  const ws = (await gerar()).getWorksheet('Basquetebol')!
  expect(ws.getCell('I2').value).toBe('GRUPO A')
  expect(ws.getCell('J2').value).toBe('GRUPO B')
  // grupo A: slot 1 (escola/município), slot 2, slots 3-4 vazios
  expect(ws.getCell('I3').value).toBe('Colegio Campos Sales')
  expect(ws.getCell('I4').value).toBe('São Paulo')
  expect(ws.getCell('I5').value).toBe('Escola Portal')
  expect(ws.getCell('I6').value).toBe('Sorocaba')
  expect(ws.getCell('I8').value).toBe('-----')
  // legenda por participante
  expect(ws.getCell('I12').value).toBe('A')
  expect(ws.getCell('I13').value).toBe('SREL Capital')
  expect(ws.getCell('I14').value).toBe('SREL Sorocaba')
  expect(ws.getCell('I15').value).toBe('----x-----')
})

it('jogos: 1ª rodada com LOCAL/END em branco e ----- no bye', async () => {
  p.modalidade.findMany.mockResolvedValue([
    { id: 1, sigla: 'BF14', nome: 'Basquetebol Feminino 14 anos' },
  ])
  p.inscricao.findMany.mockResolvedValue([
    insc(1, 'SREL Capital', 'Colegio Campos Sales', 'São Paulo', 'p1'),
    insc(1, 'SREL Sorocaba', 'Escola Portal', 'Sorocaba', 'p2'),
    insc(1, 'SREL Barretos', 'Colegio Alpha', 'Barretos', 'p3'),
  ])
  p.sorteio.findMany.mockResolvedValue([
    { modalidade_id: 1, resultado: { grupos: [{ letra: 'A', participantes: ['p1', 'p2', 'p3'] }] } },
  ])

  const ws = (await gerar()).getWorksheet('Basquetebol')!
  expect(ws.getCell('N2').value).toBe('LOCAL:')
  expect(ws.getCell('N3').value).toBe('END.:')
  expect(ws.getCell('P2').value).toBeFalsy() // preenchimento manual no congresso

  // par [1,4]: o 4º não existe
  expect(ws.getCell('O4').value).toBe('BF14')
  expect(ws.getCell('Q4').value).toBe('Colegio Campos Sales')
  expect(ws.getCell('R4').value).toBe('X')
  expect(ws.getCell('S4').value).toBeFalsy()
  expect(ws.getCell('Q5').value).toBe('São Paulo')
  expect(ws.getCell('S5').value).toBe('-----')
  // par [2,3]
  expect(ws.getCell('Q6').value).toBe('Escola Portal')
  expect(ws.getCell('S6').value).toBe('Colegio Alpha')
  expect(ws.getCell('Q7').value).toBe('Sorocaba')
  expect(ws.getCell('S7').value).toBe('Barretos')
})

it('modalidade excluída do evento não entra', async () => {
  p.modalidade.findMany.mockResolvedValue([
    { id: 1, sigla: 'BF14', nome: 'Basquetebol Feminino 14 anos' },
    { id: 9, sigla: 'HF14', nome: 'Handebol Feminino 14 anos' },
  ])
  p.inscricao.findMany.mockResolvedValue([
    insc(1, 'SREL Bauru', 'EE Bauru', 'Bauru'),
    insc(9, 'SREL Bauru', 'EE Bauru', 'Bauru'),
  ])
  p.eventoModalidadeExcluida.findMany.mockResolvedValue([{ modalidade_id: 9 }])

  const wb = await gerar()
  expect(wb.worksheets.map((w) => w.name)).toEqual(['Basquetebol'])
})

it('evento inexistente lança 404', async () => {
  p.evento.findUnique.mockResolvedValue(null)
  await expect(gerarCongressoJeespXlsx(999)).rejects.toMatchObject({ status: 404 })
})
