import { describe, it, expect, vi, beforeEach } from 'vitest'
import ExcelJS from 'exceljs'

vi.mock('../../lib/prisma', () => ({
  default: {
    evento: { findUnique: vi.fn() },
    inscricao: { findMany: vi.fn() },
    sorteio: { findMany: vi.fn() },
  },
}))

import prisma from '../../lib/prisma'
import { gerarCongressoXlsx } from './relatorio_congresso.service'

const p = prisma as any

// Participantes (a propósito fora de ordem alfabética para validar ordenação)
const PART = {
  1: { id: 1, nome: 'Carlos' },
  2: { id: 2, nome: 'Ana' },
  3: { id: 3, nome: 'Bruno' },
  4: { id: 4, nome: 'Diego' },
}

function inscricao(modId: number, pid: number) {
  return {
    id: pid * 100 + modId,
    evento_id: 1,
    modalidade_id: modId,
    participante_id: pid,
    participante: PART[pid as keyof typeof PART],
  }
}

function setupEvento(modalidades: any[]) {
  p.evento.findUnique.mockResolvedValue({
    id: 1,
    nome: 'Jogos Teste',
    anfitriao: { nome: 'Cidade Anfitriã', municipio: { nome: 'Município X' } },
    competicao: { modalidades },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('gerarCongressoXlsx', () => {
  it('especifico: B6 em caixa alta e C6 com a contagem', async () => {
    setupEvento([
      {
        id: 10,
        nome: 'Xadrez',
        sigla: 'XAD',
        tipo_modalidade: { tipo: 'especifico' },
      },
    ])
    // inscritos: Carlos(1), Ana(2) -> alfabético: Ana, Carlos
    p.inscricao.findMany.mockImplementation(async (args: any) => {
      const rows = [inscricao(10, 1), inscricao(10, 2)]
      // simula ordenação por nome asc do prisma
      return rows.sort((a, b) => a.participante.nome.localeCompare(b.participante.nome))
    })
    p.sorteio.findMany.mockResolvedValue([])

    const buf = await gerarCongressoXlsx(1)
    const wb2 = new ExcelJS.Workbook()
    await wb2.xlsx.load(buf as any)
    const ws = wb2.getWorksheet('XAD')!
    expect(ws).toBeTruthy()
    expect(ws.getCell('B6').value).toBe('XADREZ')
    expect((ws.getCell('B6').fill as any).fgColor.argb).toBe('FF156082')
    expect((ws.views?.[0] as any)?.showGridLines).toBe(false)
    expect(ws.getCell('G2').value).toBe('RELATÓRIO REQUER REVISÃO. REVISE ANTES DE PUBLICAR')
    expect((ws.getCell('G2').font.color as any).argb).toBe('FFFF0000')
    expect(ws.getCell('C6').value).toBe(2)
    expect(ws.getCell('B7').value).toBe('Ana')
    expect(ws.getCell('B8').value).toBe('Carlos')
    // cabeçalho
    expect(ws.getCell('C2').value).toBe('Cidade Sede')
    expect(ws.getCell('D2').value).toBe('Cidade Anfitriã')
    expect(ws.getCell('D4').value).toBeFalsy()
    expect(ws.getCell('B5').value).toBe('Modalidade (Inscritos)')
  })

  it('grupos: G6 começa com GRUPO e B7 é o 1º alfabético', async () => {
    setupEvento([
      {
        id: 20,
        nome: 'Bocha',
        sigla: 'BOC',
        tipo_modalidade: { tipo: 'grupos' },
      },
    ])
    p.inscricao.findMany.mockImplementation(async () => {
      const rows = [inscricao(20, 1), inscricao(20, 2), inscricao(20, 3)]
      return rows.sort((a, b) => a.participante.nome.localeCompare(b.participante.nome))
    })
    p.sorteio.findMany.mockResolvedValue([
      {
        modalidade_id: 20,
        resultado: {
          grupos: [
            { letra: 'A', participantes: [2, 1] },
            { letra: 'B', participantes: [3] },
          ],
        },
      },
    ])

    const buf = await gerarCongressoXlsx(1)
    const wb2 = new ExcelJS.Workbook()
    await wb2.xlsx.load(buf as any)
    const ws = wb2.getWorksheet('BOC')!
    expect(ws.getCell('B6').value).toBe('BOCHA')
    expect(ws.getCell('C6').value).toBe(3)
    expect(ws.getCell('B7').value).toBe('Ana') // 1º alfabético
    expect(String(ws.getCell('G6').value)).toMatch(/^GRUPO/)
    expect(ws.getCell('G6').value).toBe('GRUPO A')
    expect(ws.getCell('G7').value).toBe('Ana') // grupo A, pid 2
    expect(ws.getCell('G8').value).toBe('Carlos') // grupo A, pid 1
    expect(ws.getCell('H6').value).toBe('GRUPO B')
    expect(ws.getCell('F7').value).toBe(1)
    // formatação: F6 fundo #156082
    expect((ws.getCell('F6').fill as any).fgColor.argb).toBe('FF156082')
    // cabeçalho do grupo G6: bold, branco sobre #156082
    expect(ws.getCell('G6').font.bold).toBe(true)
    expect((ws.getCell('G6').font.color as any).argb).toBe('FFFFFFFF')
    expect((ws.getCell('G6').fill as any).fgColor.argb).toBe('FF156082')
    // bordas #156082 no bloco de grupos
    const bord = ws.getCell('F6').border as any
    expect(bord.top.color.argb).toBe('FF156082')
    expect(bord.left.color.argb).toBe('FF156082')

    // ── Programação (3 rodadas) ──
    expect(ws.getCell('G14').value).toBe('Programação')
    expect(ws.getCell('G15').value).toBe('1ª Rodada')
    expect(ws.getCell('M15').value).toBe('2ª Rodada')
    expect(ws.getCell('S15').value).toBe('3ª Rodada')
    expect(ws.getCell('G16').value).toBe('Data')
    expect(ws.getCell('G18').value).toBe('Endereço')
    // cabeçalhos da tabela linha 19 (#D9D9D9)
    expect(ws.getCell('G19').value).toBe('Horário')
    expect(ws.getCell('J19').value).toBe('x')
    expect((ws.getCell('G19').fill as any).fgColor.argb).toBe('FFD9D9D9')
    // Rodada 1: Grupo A -> pos1(Ana) x pos4(-); pos2(Carlos) x pos3(-)
    expect(ws.getCell('I20').value).toBe('Ana')
    expect(ws.getCell('J20').value).toBe('x')
    expect(ws.getCell('K20').value).toBe('-')
    expect(ws.getCell('I21').value).toBe('Carlos')
    // Rodada 2 (cols M–Q): Grupo A -> pos3(-) x pos1(Ana)
    expect(ws.getCell('O20').value).toBe('-')
    expect(ws.getCell('Q20').value).toBe('Ana')
    expect(ws.getCell('P20').value).toBe('x')
    // Rodada 3 (cols S–W): Grupo A -> pos1(Ana) x pos2(Carlos)
    expect(ws.getCell('U20').value).toBe('Ana')
    expect(ws.getCell('W20').value).toBe('Carlos')
    // bordas pretas: grade dos jogos (G20) e faixa Data (G16)
    expect((ws.getCell('G20').border as any).top.color.argb).toBe('FF000000')
    expect((ws.getCell('G16').border as any).top.color.argb).toBe('FF000000')
    // aviso de revisão em G13 (grupos), vermelho
    expect(ws.getCell('G13').value).toBe('RELATÓRIO REQUER REVISÃO. REVISE ANTES DE PUBLICAR')
    expect((ws.getCell('G13').font.color as any).argb).toBe('FFFF0000')
  })

  it('ordem: E6 == # , F7 primeiro municipio e E7 == 1', async () => {
    setupEvento([
      {
        id: 30,
        nome: 'Desfile',
        sigla: 'DES',
        tipo_modalidade: { tipo: 'ordem_entrada' },
      },
    ])
    p.inscricao.findMany.mockImplementation(async () => {
      const rows = [inscricao(30, 1), inscricao(30, 2)]
      return rows.sort((a, b) => a.participante.nome.localeCompare(b.participante.nome))
    })
    p.sorteio.findMany.mockResolvedValue([
      { modalidade_id: 30, resultado: { ordem: [1, 2] } }, // Carlos, Ana
    ])

    const buf = await gerarCongressoXlsx(1)
    const wb2 = new ExcelJS.Workbook()
    await wb2.xlsx.load(buf as any)
    const ws = wb2.getWorksheet('DES')!
    expect(ws.getCell('E6').value).toBe('#')
    expect(ws.getCell('F6').value).toBe('DESFILE')
    expect(ws.getCell('E7').value).toBe(1)
    expect(ws.getCell('F7').value).toBe('Carlos') // primeiro da ordem (pid 1)
    expect(ws.getCell('E8').value).toBe(2)
    expect(ws.getCell('F8').value).toBe('Ana')
  })

  it('chaves: aba copiada existe e E na linha onde D==1 recebe slots[0]', async () => {
    // 4 inscritos -> aba "04" existe em CHAVES CT.xlsx
    setupEvento([
      {
        id: 40,
        nome: 'Tênis',
        sigla: 'TEN',
        tipo_modalidade: { tipo: 'chaves' },
      },
    ])
    p.inscricao.findMany.mockImplementation(async () => {
      const rows = [inscricao(40, 1), inscricao(40, 2), inscricao(40, 3), inscricao(40, 4)]
      return rows.sort((a, b) => a.participante.nome.localeCompare(b.participante.nome))
    })
    p.sorteio.findMany.mockResolvedValue([
      { modalidade_id: 40, resultado: { slots: [2, 1, 4, 3], size: 4 } },
    ])

    const buf = await gerarCongressoXlsx(1)
    const wb2 = new ExcelJS.Workbook()
    await wb2.xlsx.load(buf as any)
    const ws = wb2.getWorksheet('TEN')!
    expect(ws).toBeTruthy()
    expect(ws.getCell('B6').value).toBe('TÊNIS')
    expect(ws.getCell('C6').value).toBe(4)
    // achar a linha onde D == 1 e conferir E == slots[0] (pid 2 -> Ana)
    let linhaPos1: number | null = null
    ws.eachRow({ includeEmpty: false }, (row, rn) => {
      if (row.getCell(4).value === 1) linhaPos1 = rn
    })
    expect(linhaPos1).not.toBeNull()
    expect(ws.getRow(linhaPos1!).getCell(5).value).toBe('Ana') // slots[0] = pid 2
    // copiarAba deve preservar bordas/estilos da chave (deep-copy cross-workbook):
    // P5 é uma célula estrutural da chave (não sobrescrita pelo filler) e tem borda no template
    const b = ws.getCell('P5').border
    expect(b && (b.top || b.bottom || b.left || b.right)).toBeTruthy()
  })

  it('chaves sem aba correspondente: fallback para especifico', async () => {
    // 1 inscrito -> não há aba "01"
    setupEvento([
      {
        id: 50,
        nome: 'Solo',
        sigla: 'SOL',
        tipo_modalidade: { tipo: 'chaves' },
      },
    ])
    p.inscricao.findMany.mockImplementation(async () => [inscricao(50, 2)])
    p.sorteio.findMany.mockResolvedValue([])

    const buf = await gerarCongressoXlsx(1)
    const wb2 = new ExcelJS.Workbook()
    await wb2.xlsx.load(buf as any)
    const ws = wb2.getWorksheet('SOL')!
    expect(ws).toBeTruthy()
    expect(ws.getCell('B6').value).toBe('SOLO')
    expect(ws.getCell('C6').value).toBe(1)
    expect(ws.getCell('B7').value).toBe('Ana')
  })
})
