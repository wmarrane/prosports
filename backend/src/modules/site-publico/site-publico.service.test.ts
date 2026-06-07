import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    evento: { findUnique: vi.fn(), update: vi.fn() },
    modalidade: { findMany: vi.fn() },
    inscricao: { findMany: vi.fn() },
    campeaoAnterior: { findMany: vi.fn() },
    sorteio: { findMany: vi.fn() },
  },
}))
vi.mock('./snapshot-store', () => ({
  putSnapshot: vi.fn(async () => {}),
  deleteSnapshot: vi.fn(async () => {}),
  dispatchBuild: vi.fn(async () => {}),
}))

import prisma from '../../lib/prisma'
import * as store from './snapshot-store'
import * as service from './site-publico.service'

const mp = prisma as any
beforeEach(() => {
  vi.clearAllMocks()
  mp.evento.findUnique.mockResolvedValue({
    id: 10, nome: 'Jogos', local: 'Gin', organizador: 'M', data_hora: new Date('2026-05-10T12:00:00Z'),
    anfitriao_id: null, competicao_id: 7, status: 'sorteado',
    competicao: { nome: 'Regionais', considerar_anfitriao: false, subtitulo_campos: [] },
    municipio: { nome: 'São Manuel' },
  })
  mp.modalidade.findMany.mockResolvedValue([{ id: 1, nome: 'Futsal', sigla: 'F', tipo_modalidade: { tipo: 'grupos' } }])
  mp.inscricao.findMany.mockResolvedValue([{ modalidade_id: 1, participante: { id: 100, nome: 'Tigres', subtitulo: null } }])
  mp.campeaoAnterior.findMany.mockResolvedValue([])
  mp.sorteio.findMany.mockResolvedValue([{ modalidade_id: 1, tipo: 'grupos', seed: 'S', resultado: { grupos: [{ letra: 'A', participantes: [100] }] } }])
  mp.evento.update.mockResolvedValue({})
})

it('publicar monta snapshot, commita, dispara e marca publicado', async () => {
  await service.publicar(10)
  expect(store.putSnapshot).toHaveBeenCalledTimes(1)
  const [eid, snap] = (store.putSnapshot as any).mock.calls[0]
  expect(eid).toBe(10)
  expect(snap.modalidades[0].status).toBe('sorteado')
  expect(store.dispatchBuild).toHaveBeenCalledTimes(1)
  expect(mp.evento.update).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: 10 }, data: expect.objectContaining({ site_publicado_em: expect.any(Date) }),
  }))
})

it('publicar 404 se evento inexistente', async () => {
  mp.evento.findUnique.mockResolvedValue(null)
  await expect(service.publicar(999)).rejects.toMatchObject({ status: 404 })
})

it('publicar 400 se evento nao esta sorteado', async () => {
  mp.evento.findUnique.mockResolvedValue({
    id: 10, nome: 'Jogos', local: 'Gin', organizador: 'M', data_hora: new Date('2026-05-10T12:00:00Z'),
    anfitriao_id: null, competicao_id: 7, status: 'inscricoes',
    competicao: { nome: 'Regionais', considerar_anfitriao: false, subtitulo_campos: [] },
    municipio: { nome: 'São Manuel' },
  })
  await expect(service.publicar(10)).rejects.toMatchObject({ status: 400 })
  expect(store.putSnapshot).not.toHaveBeenCalled()
  expect(store.dispatchBuild).not.toHaveBeenCalled()
})

it('despublicar remove snapshot, dispara e limpa', async () => {
  await service.despublicar(10)
  expect(store.deleteSnapshot).toHaveBeenCalledWith(10)
  expect(store.dispatchBuild).toHaveBeenCalledTimes(1)
  expect(mp.evento.update).toHaveBeenCalledWith({ where: { id: 10 }, data: { site_publicado_em: null } })
})

it('publicar compõe subtitulo a partir de subtitulo_campos', async () => {
  mp.evento.findUnique.mockResolvedValue({
    id: 10, nome: 'Jogos', local: 'Gin', organizador: 'M', data_hora: new Date('2026-05-10T12:00:00Z'),
    anfitriao_id: null, competicao_id: 7, status: 'sorteado',
    competicao: { nome: 'Regionais', considerar_anfitriao: false, subtitulo_campos: ['municipio'] },
    municipio: { nome: 'São Manuel' },
  })
  mp.inscricao.findMany.mockResolvedValue([
    { modalidade_id: 1, participante: { id: 100, nome: 'Tigres', subtitulo: null, municipio: { nome: 'Bauru', uf: 'SP' } } },
  ])
  await service.publicar(10)
  const [, snap] = (store.putSnapshot as any).mock.calls[0]
  expect(snap.modalidades[0].participantes[0].subtitulo).toBe('Bauru/SP')
})
