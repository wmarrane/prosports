import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    municipio: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import prisma from '../../lib/prisma'
import { importarCsv } from './import.service'

const mockPrisma = prisma as any
beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.municipio.findMany.mockResolvedValue([])
  mockPrisma.municipio.createMany.mockResolvedValue({ count: 0 })
  mockPrisma.municipio.update.mockResolvedValue({})
})

const HEADER_PT = 'Código Município Completo;Nome_Município;Nome_UF'

describe('import.service', () => {
  it('importa linhas válidas e retorna resumo de criados', async () => {
    const csv = `${HEADER_PT}\n3550308;São Paulo;São Paulo\n3304557;Rio de Janeiro;Rio de Janeiro`
    mockPrisma.municipio.createMany.mockResolvedValue({ count: 2 })
    const res = await importarCsv(csv)
    expect(res.criados).toBe(2)
    expect(res.atualizados).toBe(0)
    expect(res.erros).toEqual([])
    expect(mockPrisma.municipio.createMany).toHaveBeenCalledWith({
      data: [
        { codigo_ibge: '3550308', nome: 'São Paulo', uf: 'SP' },
        { codigo_ibge: '3304557', nome: 'Rio de Janeiro', uf: 'RJ' },
      ],
      skipDuplicates: true,
    })
  })

  it('atualiza municípios já existentes (upsert por codigo_ibge)', async () => {
    const csv = `${HEADER_PT}\n3550308;São Paulo Renomeado;SP`
    mockPrisma.municipio.findMany.mockResolvedValue([
      { id: 7, codigo_ibge: '3550308', nome: 'São Paulo', uf: 'SP' },
    ])
    mockPrisma.municipio.createMany.mockResolvedValue({ count: 0 })
    const res = await importarCsv(csv)
    expect(res.atualizados).toBe(1)
    expect(res.criados).toBe(0)
    expect(mockPrisma.municipio.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { nome: 'São Paulo Renomeado', uf: 'SP' },
    })
  })

  it('aceita aliases de header (codigo_ibge / nome / uf)', async () => {
    const csv = 'codigo_ibge,nome,uf\n3550308,São Paulo,SP'
    mockPrisma.municipio.createMany.mockResolvedValue({ count: 1 })
    const res = await importarCsv(csv)
    expect(res.criados).toBe(1)
    expect(res.erros).toEqual([])
  })

  it('linha com codigo_ibge inválido vai para erros sem abortar', async () => {
    const csv = `${HEADER_PT}\nABC;Cidade A;SP\n3550308;São Paulo;SP`
    mockPrisma.municipio.createMany.mockResolvedValue({ count: 1 })
    const res = await importarCsv(csv)
    expect(res.criados).toBe(1)
    expect(res.erros).toHaveLength(1)
    expect(res.erros[0]).toMatchObject({ linha: 2, motivo: expect.stringContaining('codigo_ibge') })
  })

  it('linha com UF desconhecida vai para erros', async () => {
    const csv = `${HEADER_PT}\n3550308;X;Estado Fantasma`
    const res = await importarCsv(csv)
    expect(res.criados).toBe(0)
    expect(res.erros[0]).toMatchObject({ linha: 2, motivo: expect.stringContaining('UF') })
  })

  it('arquivo sem coluna obrigatória lança erro 400', async () => {
    const csv = 'foo,bar\n1,2'
    await expect(importarCsv(csv)).rejects.toMatchObject({ status: 400 })
  })

  it('processa em lotes de 500', async () => {
    const lines = [HEADER_PT]
    for (let i = 0; i < 1200; i++) {
      const code = String(3550000 + i).padStart(7, '0')
      lines.push(`${code};Cidade ${i};SP`)
    }
    mockPrisma.municipio.createMany.mockResolvedValue({ count: 500 })
    await importarCsv(lines.join('\n'))
    expect(mockPrisma.municipio.createMany).toHaveBeenCalledTimes(3)
    expect((mockPrisma.municipio.createMany.mock.calls[0][0] as any).data).toHaveLength(500)
    expect((mockPrisma.municipio.createMany.mock.calls[2][0] as any).data).toHaveLength(200)
  })
})
