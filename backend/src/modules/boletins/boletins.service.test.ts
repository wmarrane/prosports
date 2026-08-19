import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = {
  evento: { findUnique: vi.fn() },
  boletim: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), delete: vi.fn(), update: vi.fn() },
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
    const r = await criarBoletim({ eventoId: 9, numero: 1, titulo: 'B1', categoria: 'Resultados', data_publicacao: new Date(), file: { buffer: Buffer.from('%PDF-1.7\n'), originalname: 'b.pdf', size: 1, mimetype: 'application/pdf' } as any })
    expect(putMock).toHaveBeenCalled()
    expect(prismaMock.boletim.create).toHaveBeenCalled()
    expect(publicarMock).toHaveBeenCalledWith(9, { origem: 'automatica' })
    expect(r.id).toBe(1)
  })

  it('NÃO re-publica se evento não publicado', async () => {
    prismaMock.evento.findUnique.mockResolvedValue({ id: 9, site_publicado_em: null })
    prismaMock.boletim.create.mockResolvedValue({ id: 2, evento_id: 9, numero: 2 })
    const { criarBoletim } = await import('./boletins.service')
    await criarBoletim({ eventoId: 9, numero: 2, titulo: 'B2', categoria: 'Oficial', data_publicacao: new Date(), file: { buffer: Buffer.from('%PDF-1.7\n'), originalname: 'b.pdf', size: 1, mimetype: 'application/pdf' } as any })
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

describe('falha ao republicar o site não desfaz nem aborta a operação', () => {
  const arquivo = { buffer: Buffer.from('%PDF-1.7\n'), originalname: 'b.pdf', size: 1, mimetype: 'application/pdf' } as any
  const publicado = { id: 9, site_publicado_em: new Date() }

  it('criar: devolve o boletim criado e mantém o arquivo', async () => {
    prismaMock.evento.findUnique.mockResolvedValue(publicado)
    prismaMock.boletim.create.mockResolvedValue({ id: 7, evento_id: 9, numero: 1 })
    publicarMock.mockRejectedValueOnce(Object.assign(new Error('Só é possível publicar eventos com status "Sorteado".'), { status: 400 }))

    const { criarBoletim } = await import('./boletins.service')
    const r = await criarBoletim({ eventoId: 9, numero: 1, titulo: 'B1', categoria: 'Oficial', data_publicacao: new Date(), file: arquivo })

    expect(r.id).toBe(7)
    expect(removeMock).not.toHaveBeenCalled()
  })

  it('remover: conclui sem lançar', async () => {
    prismaMock.boletim.findFirst.mockResolvedValue({ id: 5, evento_id: 9, object_key: 'eventos/9/b.pdf' })
    prismaMock.evento.findUnique.mockResolvedValue(publicado)
    publicarMock.mockRejectedValueOnce(new Error('falhou'))

    const { removerBoletim } = await import('./boletins.service')
    await expect(removerBoletim(9, 5)).resolves.toBeUndefined()
    expect(prismaMock.boletim.delete).toHaveBeenCalledWith({ where: { id: 5 } })
  })

  it('substituir: devolve o atualizado e mantém o arquivo novo', async () => {
    prismaMock.boletim.findFirst.mockResolvedValue({ id: 5, evento_id: 9, numero: 3, object_key: 'eventos/9/antigo.pdf' })
    prismaMock.boletim.update.mockResolvedValue({ id: 5, evento_id: 9, numero: 3 })
    prismaMock.evento.findUnique.mockResolvedValue(publicado)
    publicarMock.mockRejectedValueOnce(new Error('falhou'))

    const { substituirBoletim } = await import('./boletins.service')
    const r = await substituirBoletim(9, 5, { file: arquivo })

    expect(r.id).toBe(5)
    // só o arquivo ANTIGO é removido; o novo (recém-gravado) permanece
    expect(removeMock).toHaveBeenCalledTimes(1)
    expect(removeMock).toHaveBeenCalledWith('eventos/9/antigo.pdf')
  })
})

describe('substituirBoletim', () => {
  it('substitui com novo PDF: sobe novo, remove antigo, atualiza e re-publica se publicado', async () => {
    prismaMock.boletim.findFirst.mockResolvedValue({ id: 5, evento_id: 9, numero: 3, object_key: 'eventos/9/boletim-3-old.pdf' })
    prismaMock.boletim.update.mockResolvedValue({ id: 5, evento_id: 9, numero: 3 })
    prismaMock.evento.findUnique.mockResolvedValue({ id: 9, site_publicado_em: new Date() })
    const { substituirBoletim } = await import('./boletins.service')
    await substituirBoletim(9, 5, { titulo: 'Novo', file: { buffer: Buffer.from('%PDF-1.7\n'), originalname: 'n.pdf', size: 2, mimetype: 'application/pdf' } as any })
    expect(putMock).toHaveBeenCalled()
    expect(removeMock).toHaveBeenCalledWith('eventos/9/boletim-3-old.pdf')
    expect(prismaMock.boletim.update).toHaveBeenCalled()
    expect(publicarMock).toHaveBeenCalledWith(9, { origem: 'automatica' })
  })
  it('substitui só campos (sem arquivo): não mexe no storage', async () => {
    prismaMock.boletim.findFirst.mockResolvedValue({ id: 5, evento_id: 9, numero: 3, object_key: 'k' })
    prismaMock.boletim.update.mockResolvedValue({ id: 5 })
    prismaMock.evento.findUnique.mockResolvedValue({ id: 9, site_publicado_em: null })
    const { substituirBoletim } = await import('./boletins.service')
    await substituirBoletim(9, 5, { titulo: 'Corrigido' })
    expect(putMock).not.toHaveBeenCalled()
    expect(removeMock).not.toHaveBeenCalled()
    expect(publicarMock).not.toHaveBeenCalled()
  })
  it('404 se o boletim não existe', async () => {
    prismaMock.boletim.findFirst.mockResolvedValue(null)
    const { substituirBoletim } = await import('./boletins.service')
    await expect(substituirBoletim(9, 999, { titulo: 'x' })).rejects.toMatchObject({ status: 404 })
  })
})
