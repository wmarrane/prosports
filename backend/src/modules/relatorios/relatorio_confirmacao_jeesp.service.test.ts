import { it, expect, vi, beforeEach } from 'vitest'
import ExcelJS from 'exceljs'

vi.mock('../../lib/prisma', () => ({
  default: {
    evento: { findUnique: vi.fn() },
    modalidade: { findMany: vi.fn() },
    inscricao: { findMany: vi.fn() },
    eventoModalidadeExcluida: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

import prisma from '../../lib/prisma'
import { gerarConfirmacaoJeespXlsx, nomeArquivoConfirmacao } from './relatorio_confirmacao_jeesp.service'

const p = prisma as any
const params = {
  codCompeticao: 3,
  competicao: 'Jogos Escolares',
  divisao: '2ª Divisão',
  codMunicipioSede: 879,
  municipioSede: 'Praia Grande',
  codModalidade: 0,
}

async function abrir(buf: Buffer) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as any)
  return wb.getWorksheet('Planilha1')!
}

beforeEach(() => {
  vi.clearAllMocks()
  p.eventoModalidadeExcluida.findMany.mockResolvedValue([])
})

it('gera planilha (dados na linha 3, valores do form, Cidade Sede por modalidade, formula em J)', async () => {
  p.evento.findUnique.mockResolvedValue({ competicao_id: 7 })
  p.modalidade.findMany.mockResolvedValue([
    { id: 10, nome: 'Xadrez (I) Masculino(a) Infantil' },
    { id: 11, nome: 'Vazia' },
  ])
  p.inscricao.findMany.mockResolvedValue([
    { modalidade_id: 10, participante: { nome: 'DREL Araçatuba' } },
    { modalidade_id: 10, participante: { nome: 'DREL Bauru' } },
  ])

  const ws = await abrir(await gerarConfirmacaoJeespXlsx(1, params))

  // linhas 1-2 em branco, como no modelo
  expect(ws.getCell('B1').value).toBeFalsy()
  expect(ws.getCell('B2').value).toBeFalsy()

  expect(ws.getCell('B3').value).toBe('DREL Araçatuba')
  expect(ws.getCell('D3').value).toBe('Xadrez (I) Masculino(a) Infantil')
  expect(ws.getCell('C3').value).toBe(0)
  expect(ws.getCell('E3').value).toBe(3)
  expect(ws.getCell('F3').value).toBe('Jogos Escolares')
  expect(ws.getCell('G3').value).toBe('2ª Divisão')
  expect(ws.getCell('H3').value).toBe(879)
  expect(ws.getCell('I3').value).toBe('Praia Grande')

  const j3 = ws.getCell('J3').value as any
  expect(j3.formula).toContain('insert into confirmacao')
  expect(j3.formula).toContain('B3')
  expect(j3.formula).toContain('$I3')

  // 2 inscritos (linhas 3 e 4) + Cidade Sede (linha 5); modalidade 'Vazia' ignorada
  expect(ws.getCell('B4').value).toBe('DREL Bauru')
  expect(ws.getCell('B5').value).toBe('Cidade Sede')
  expect(ws.getCell('D5').value).toBe('Xadrez (I) Masculino(a) Infantil')
  expect(ws.getCell('B6').value).toBeFalsy()

  // coluna A: sequencial cosmético, não referenciado na fórmula
  expect(ws.getCell('A3').value).toBe(1)
  expect(ws.getCell('A5').value).toBe(3)
})

it('modalidade sem inscritos é ignorada (sem linha Cidade Sede)', async () => {
  p.evento.findUnique.mockResolvedValue({ competicao_id: 7 })
  p.modalidade.findMany.mockResolvedValue([{ id: 11, nome: 'Vazia' }])
  p.inscricao.findMany.mockResolvedValue([])

  const ws = await abrir(await gerarConfirmacaoJeespXlsx(1, params))
  expect(ws.getCell('B3').value).toBeFalsy()
})

it('modalidade excluída do evento não entra na planilha', async () => {
  p.evento.findUnique.mockResolvedValue({ competicao_id: 7 })
  p.modalidade.findMany.mockResolvedValue([
    { id: 10, nome: 'Xadrez (I) Masculino(a) Infantil' },
    { id: 12, nome: 'Excluida' },
  ])
  p.inscricao.findMany.mockResolvedValue([
    { modalidade_id: 10, participante: { nome: 'DREL Araçatuba' } },
    { modalidade_id: 12, participante: { nome: 'DREL Bauru' } },
  ])
  p.eventoModalidadeExcluida.findMany.mockResolvedValue([{ modalidade_id: 12 }])

  const ws = await abrir(await gerarConfirmacaoJeespXlsx(1, params))
  expect(ws.getCell('B3').value).toBe('DREL Araçatuba')
  expect(ws.getCell('B4').value).toBe('Cidade Sede')
  expect(ws.getCell('B5').value).toBeFalsy()
})

it('evento inexistente lança 404', async () => {
  p.evento.findUnique.mockResolvedValue(null)
  await expect(gerarConfirmacaoJeespXlsx(999, params)).rejects.toMatchObject({ status: 404 })
})

it('nomeArquivoConfirmacao gera slug seguro', () => {
  expect(nomeArquivoConfirmacao({ id: 5, nome: 'Jeesp Mirim Etapa I (est)' })).toBe(
    'Confirmacao_Jeesp_Mirim_Etapa_I_est.xlsx',
  )
  expect(nomeArquivoConfirmacao({ id: 7, nome: '###' })).toBe('Confirmacao_evento_7.xlsx')
})
