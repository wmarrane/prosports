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
vi.mock('./github', () => ({
  putSnapshot: vi.fn(async () => {}),
  deleteSnapshot: vi.fn(async () => {}),
  dispatchBuild: vi.fn(async () => {}),
}))

import prisma from '../../lib/prisma'
import * as github from './github'
import * as service from './site-publico.service'

const mp = prisma as any
beforeEach(() => {
  vi.clearAllMocks()
  mp.evento.findUnique.mockResolvedValue({
    id: 10, nome: 'Jogos', local: 'Gin', organizador: 'M', data_hora: new Date('2026-05-10T12:00:00Z'),
    anfitriao_id: null, competicao_id: 7,
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
  expect(github.putSnapshot).toHaveBeenCalledTimes(1)
  const [eid, snap] = (github.putSnapshot as any).mock.calls[0]
  expect(eid).toBe(10)
  expect(snap.modalidades[0].status).toBe('sorteado')
  expect(github.dispatchBuild).toHaveBeenCalledTimes(1)
  expect(mp.evento.update).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: 10 }, data: expect.objectContaining({ site_publicado_em: expect.any(Date) }),
  }))
})

it('publicar 404 se evento inexistente', async () => {
  mp.evento.findUnique.mockResolvedValue(null)
  await expect(service.publicar(999)).rejects.toMatchObject({ status: 404 })
})

it('despublicar remove snapshot, dispara e limpa', async () => {
  await service.despublicar(10)
  expect(github.deleteSnapshot).toHaveBeenCalledWith(10)
  expect(github.dispatchBuild).toHaveBeenCalledTimes(1)
  expect(mp.evento.update).toHaveBeenCalledWith({ where: { id: 10 }, data: { site_publicado_em: null } })
})
