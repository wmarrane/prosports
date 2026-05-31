import { Request, Response, NextFunction } from 'express'
import * as service from './users.service'
import { createSchema, updateSchema, resetarSenhaSchema } from './users.schemas'

function caller(req: Request) {
  const u = (req as any).user as { sub: number; role: string } | undefined
  if (!u) throw Object.assign(new Error('Não autenticado'), { status: 401 })
  return u
}

export async function listar(_req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.listar()) } catch (e) { next(e) }
}

export async function buscarPorId(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.buscarPorId(Number(req.params.id))) } catch (e) { next(e) }
}

export async function criar(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createSchema.parse(req.body)
    res.status(201).json(await service.criar(body))
  } catch (e) { next(e) }
}

export async function editar(req: Request, res: Response, next: NextFunction) {
  try {
    const body = updateSchema.parse(req.body)
    res.json(await service.editar(Number(req.params.id), body, caller(req)))
  } catch (e) { next(e) }
}

export async function remover(req: Request, res: Response, next: NextFunction) {
  try {
    await service.remover(Number(req.params.id), caller(req))
    res.status(204).send()
  } catch (e) { next(e) }
}

export async function resetarSenha(req: Request, res: Response, next: NextFunction) {
  try {
    const body = resetarSenhaSchema.parse(req.body)
    res.json(await service.resetarSenha(Number(req.params.id), body.nova_senha))
  } catch (e) { next(e) }
}
