import { describe, it, expect, vi, beforeEach } from 'vitest'
process.env.JWT_SECRET = 'test-secret'

vi.mock('../../lib/prisma', () => ({
  default: {
    eventoKey: { findUnique: vi.fn(), update: vi.fn() },
    modalidade: { findMany: vi.fn(), findUnique: vi.fn() },
    inscricao: { findMany: vi.fn() },
    campeaoAnterior: { findMany: vi.fn() },
    sorteio: { findUnique: vi.fn() },
  },
}))

import prisma from '../../lib/prisma'
import * as service from './key_access.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

describe('key_access.service', () => {
  it('login 401 quando token não existe', async () => {
    mockPrisma.eventoKey.findUnique.mockResolvedValue(null)
    await expect(service.login({ token: 'x', device_fp: 'fp', device_label: 'iPhone' }))
      .rejects.toMatchObject({ status: 401 })
  })

  it('login 401 quando revogado_em != null', async () => {
    mockPrisma.eventoKey.findUnique.mockResolvedValue({
      id: 1, evento_id: 5, device_fp: null, revogado_em: new Date(),
    })
    await expect(service.login({ token: 'x', device_fp: 'fp', device_label: 'iPhone' }))
      .rejects.toMatchObject({ status: 401 })
  })

  it('login first-use grava device_fp, label, first_used_at + retorna keyToken', async () => {
    mockPrisma.eventoKey.findUnique.mockResolvedValue({
      id: 1, evento_id: 5, device_fp: null, revogado_em: null,
      evento: { id: 5, nome: 'E', data_hora: new Date(), local: 'L', logo_url: null,
                competicao: { subtitulo_campos: [] } },
    })
    mockPrisma.eventoKey.update.mockResolvedValue({})
    const r = await service.login({ token: 'x', device_fp: 'fp1', device_label: 'iPhone' })
    expect(r.keyToken).toBeTruthy()
    expect(r.evento.id).toBe(5)
    const call = mockPrisma.eventoKey.update.mock.calls[0][0]
    expect(call.where).toEqual({ id: 1 })
    expect(call.data.device_fp).toBe('fp1')
    expect(call.data.device_label).toBe('iPhone')
    expect(call.data.first_used_at).toBeInstanceOf(Date)
    expect(call.data.last_seen_at).toBeInstanceOf(Date)
  })

  it('login com mesmo device_fp regrava device_fp/label e atualiza last_seen_at (sem first_used_at)', async () => {
    mockPrisma.eventoKey.findUnique.mockResolvedValue({
      id: 1, evento_id: 5, device_fp: 'fp1', revogado_em: null,
      evento: { id: 5, nome: 'E', data_hora: new Date(), local: 'L', logo_url: null,
                competicao: { subtitulo_campos: [] } },
    })
    mockPrisma.eventoKey.update.mockResolvedValue({})
    const r = await service.login({ token: 'x', device_fp: 'fp1', device_label: 'iPhone' })
    expect(r.keyToken).toBeTruthy()
    const call = mockPrisma.eventoKey.update.mock.calls[0][0]
    expect(call.data.device_fp).toBe('fp1')
    expect(call.data.device_label).toBe('iPhone')
    expect(call.data.last_seen_at).toBeInstanceOf(Date)
    expect(call.data.first_used_at).toBeUndefined()
  })

  it('login com device_fp diferente faz takeover (sobrescreve device_fp, invalida sessao antiga)', async () => {
    mockPrisma.eventoKey.findUnique.mockResolvedValue({
      id: 1, evento_id: 5, device_fp: 'fp-ANTIGO', revogado_em: null,
      evento: { id: 5, data_hora: new Date(), competicao: { subtitulo_campos: [] } },
    })
    mockPrisma.eventoKey.update.mockResolvedValue({})
    const r = await service.login({ token: 'x', device_fp: 'fp-NOVO', device_label: 'Android Chrome' })
    expect(r.keyToken).toBeTruthy()
    const call = mockPrisma.eventoKey.update.mock.calls[0][0]
    expect(call.data.device_fp).toBe('fp-NOVO')
    expect(call.data.device_label).toBe('Android Chrome')
    expect(call.data.first_used_at).toBeUndefined()
  })

  it('login 401 com code event_expired quando evento começou há mais de 24h', async () => {
    const ontem = new Date(Date.now() - 25 * 60 * 60 * 1000)
    mockPrisma.eventoKey.findUnique.mockResolvedValue({
      id: 1, evento_id: 5, device_fp: null, revogado_em: null,
      evento: { id: 5, data_hora: ontem, competicao: { subtitulo_campos: [] } },
    })
    await expect(service.login({ token: 'x', device_fp: 'fp', device_label: 'iPhone' }))
      .rejects.toMatchObject({ status: 401, code: 'event_expired' })
    expect(mockPrisma.eventoKey.update).not.toHaveBeenCalled()
  })

  it('getModalidades lista do evento, ordenadas', async () => {
    const evento = { id: 5, competicao_id: 10 } as any
    mockPrisma.modalidade.findMany.mockResolvedValue([{ id: 1, nome: 'A' }])
    await service.getModalidades(evento)
    expect(mockPrisma.modalidade.findMany).toHaveBeenCalledWith({
      where: { competicao_id: 10 },
      orderBy: { nome: 'asc' },
      include: { tipo_modalidade: { select: { tipo: true } } },
    })
  })

  it('getModalidadeDetail 404 quando modalidade não é da competição do evento', async () => {
    const evento = { id: 5, competicao_id: 10 } as any
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 1, competicao_id: 99 })
    await expect(service.getModalidadeDetail(evento, 1)).rejects.toMatchObject({ status: 404 })
  })

  it('getModalidadeDetail retorna inscritos com nested + sorteio opcional', async () => {
    const evento = { id: 5, competicao_id: 10 } as any
    mockPrisma.modalidade.findUnique.mockResolvedValue({
      id: 1, competicao_id: 10, nome: 'M', tipo_modalidade: { tipo: 'grupos' },
    })
    mockPrisma.inscricao.findMany.mockResolvedValue([{ id: 1, participante: { id: 1 } }])
    mockPrisma.campeaoAnterior.findMany.mockResolvedValue([])
    mockPrisma.sorteio.findUnique.mockResolvedValue({ id: 5, resultado: {} })
    const r = await service.getModalidadeDetail(evento, 1)
    expect(r.modalidade.id).toBe(1)
    expect(r.inscritos).toHaveLength(1)
    expect(r.sorteio).toBeTruthy()
    expect(mockPrisma.inscricao.findMany.mock.calls[0][0].include).toEqual({
      participante: { include: { municipio: true, inspetoria: true, delegacia: true } },
    })
  })
})
