import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = {
  evento: { findUnique: vi.fn() },
  boletim: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
}
vi.mock('../../lib/prisma', () => ({ default: prismaMock }))

const putMock = vi.fn().mockResolvedValue('http://vm/boletins/eventos/9/boletim-1-abc.pdf')
const removeMock = vi.fn().mockResolvedValue(undefined)
vi.mock('../../lib/storage', () => ({ getStorage: () => ({ put: putMock, remove: removeMock }) }))

const publicarMock = vi.fn().mockResolvedValue(undefined)
vi.mock('../site-publico/site-publico.service', () => ({ publicar: publicarMock }))

beforeEach(() => vi.clearAllMocks())

describe('boletins.service', () => {
  it('cria boletim, sobe arquivo e re-publica se evento publicado', async () => {
    prismaMock.evento.findUnique.mockResolvedValue({ id: 9, site_publicado_em: new Date() })
    prismaMock.boletim.create.mockResolvedValue({ id: 1, evento_id: 9, numero: 1 })
    const { criarBoletim } = await import('./boletins.service')
    const r = await criarBoletim({ eventoId: 9, numero: 1, titulo: 'B1', categoria: 'Resultados', data_publicacao: new Date(), file: { buffer: Buffer.from('x'), originalname: 'b.pdf', size: 1, mimetype: 'application/pdf' } as any })
    expect(putMock).toHaveBeenCalled()
    expect(prismaMock.boletim.create).toHaveBeenCalled()
    expect(publicarMock).toHaveBeenCalledWith(9)
    expect(r.id).toBe(1)
  })

  it('NÃO re-publica se evento não publicado', async () => {
    prismaMock.evento.findUnique.mockResolvedValue({ id: 9, site_publicado_em: null })
    prismaMock.boletim.create.mockResolvedValue({ id: 2, evento_id: 9, numero: 2 })
    const { criarBoletim } = await import('./boletins.service')
    await criarBoletim({ eventoId: 9, numero: 2, titulo: 'B2', categoria: 'Oficial', data_publicacao: new Date(), file: { buffer: Buffer.from('x'), originalname: 'b.pdf', size: 1, mimetype: 'application/pdf' } as any })
    expect(publicarMock).not.toHaveBeenCalled()
  })

  it('remove apaga do storage e do banco', async () => {
    prismaMock.boletim.findFirst.mockResolvedValue({ id: 5, evento_id: 9, object_key: 'eventos/9/boletim-1-abc.pdf' })
    prismaMock.evento.findUnique.mockResolvedValue({ id: 9, site_publicado_em: null })
    const { removerBoletim } = await import('./boletins.service')
    await removerBoletim(9, 5)
    expect(removeMock).toHaveBeenCalledWith('eventos/9/boletim-1-abc.pdf')
    expect(prismaMock.boletim.delete).toHaveBeenCalledWith({ where: { id: 5 } })
  })
})
