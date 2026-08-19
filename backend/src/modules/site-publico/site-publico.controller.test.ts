import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'

vi.mock('./site-publico.service', () => ({
  publicar: vi.fn(async () => {}),
  despublicar: vi.fn(async () => {}),
}))

import * as service from './site-publico.service'
import * as controller from './site-publico.controller'

function fakeReq(params: any, query: any = {}): Request {
  return { params, query } as unknown as Request
}

function fakeRes(): Response {
  const res: any = {}
  res.json = vi.fn().mockReturnValue(res)
  return res as Response
}

const next: NextFunction = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

describe('publicarParcial', () => {
  it('auto=1 na query manda origem automatica pro service', async () => {
    const req = fakeReq({ id: '10' }, { auto: '1' })
    const res = fakeRes()
    await controller.publicarParcial(req, res, next)
    expect(service.publicar).toHaveBeenCalledWith(10, { permitirParcial: true, origem: 'automatica' })
    expect(res.json).toHaveBeenCalledWith({ ok: true })
  })

  it('sem query manda origem manual pro service (default preserva o botão Republicar)', async () => {
    const req = fakeReq({ id: '10' })
    const res = fakeRes()
    await controller.publicarParcial(req, res, next)
    expect(service.publicar).toHaveBeenCalledWith(10, { permitirParcial: true, origem: 'manual' })
  })
})

describe('publicar', () => {
  it('sempre manda origem manual pro service (botão do admin)', async () => {
    const req = fakeReq({ id: '10' })
    const res = fakeRes()
    await controller.publicar(req, res, next)
    expect(service.publicar).toHaveBeenCalledWith(10, { permitirParcial: false, origem: 'manual' })
  })
})
