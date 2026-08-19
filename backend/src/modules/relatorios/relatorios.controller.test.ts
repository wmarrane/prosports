import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: { evento: { findUnique: vi.fn() } },
}))
vi.mock('./relatorio_congresso.service', () => ({
  gerarCongressoXlsx: vi.fn(async () => Buffer.from('PADRAO')),
  nomeArquivo: vi.fn(() => 'padrao.xlsx'),
}))
vi.mock('./relatorio_congresso_jeesp.service', () => ({
  gerarCongressoJeespXlsx: vi.fn(async () => Buffer.from('JEESP')),
  nomeArquivoCongressoJeesp: vi.fn(() => 'jeesp.xlsx'),
}))

import prisma from '../../lib/prisma'
import * as padraoSvc from './relatorio_congresso.service'
import * as jeespSvc from './relatorio_congresso_jeesp.service'
import { congresso } from './relatorios.controller'

const mockPrisma = prisma as any

function mkRes() {
  return {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: null as any,
    status(c: number) { this.statusCode = c; return this },
    json(b: any) { this.body = b; return this },
    setHeader(k: string, v: string) { this.headers[k] = v },
    send(b: any) { this.body = b; return this },
  }
}

const req = { params: { eventoId: '7' } } as any

beforeEach(() => vi.clearAllMocks())

describe('congresso — escolha do modelo de relatório', () => {
  it("modelo 'padrao' gera o relatório dos Jogos Regionais", async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({
      id: 7, nome: 'Jogos Escolares de Praia Grande', competicao: { modelo_congresso: 'padrao' },
    })
    const res = mkRes()
    await congresso(req, res as any, vi.fn())
    expect(padraoSvc.gerarCongressoXlsx).toHaveBeenCalledWith(7)
    expect(jeespSvc.gerarCongressoJeespXlsx).not.toHaveBeenCalled()
    expect(res.headers['Content-Disposition']).toContain('padrao.xlsx')
  })

  it("modelo 'jeesp' gera o relatório de aba por esporte", async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({
      id: 7, nome: 'JEESP Sub 17', competicao: { modelo_congresso: 'jeesp' },
    })
    const res = mkRes()
    await congresso(req, res as any, vi.fn())
    expect(jeespSvc.gerarCongressoJeespXlsx).toHaveBeenCalledWith(7)
    expect(padraoSvc.gerarCongressoXlsx).not.toHaveBeenCalled()
    expect(res.headers['Content-Disposition']).toContain('jeesp.xlsx')
  })

  it('competição sem o campo cai no padrão (nunca no layout do JEESP por acidente)', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({
      id: 7, nome: 'Jogos Regionais', competicao: {},
    })
    const res = mkRes()
    await congresso(req, res as any, vi.fn())
    expect(padraoSvc.gerarCongressoXlsx).toHaveBeenCalledWith(7)
  })

  it('evento inexistente responde 404 sem gerar arquivo', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue(null)
    const res = mkRes()
    await congresso(req, res as any, vi.fn())
    expect(res.statusCode).toBe(404)
    expect(padraoSvc.gerarCongressoXlsx).not.toHaveBeenCalled()
    expect(jeespSvc.gerarCongressoJeespXlsx).not.toHaveBeenCalled()
  })
})
