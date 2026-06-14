import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import path from 'path'
import * as service from './eventos.service'
import { deleteFile } from '../../lib/upload'
import { usuarioTemAcessoAoEvento } from '../../middleware/evento-acesso'
import { parseIntParam } from '../../lib/parse-id'

const STATUS_VALUES = ['rascunho','inscricoes','pronto','sorteado','parcial','suspenso'] as const

const createSchema = z.object({
  nome: z.string().min(1),
  data_hora: z.coerce.date(),
  local: z.string().min(1),
  organizador: z.string().optional(),
  status: z.enum(STATUS_VALUES).optional(),
  competicao_id: z.coerce.number().int().positive(),
  municipio_id: z.coerce.number().int().positive(),
  anfitriao_id: z.coerce.number().int().positive().nullable().optional(),
  comissao_ids: z.array(z.coerce.number().int().positive()).optional(),
})
const updateSchema = createSchema.partial()
const listQuerySchema = z.object({
  competicao_id: z.coerce.number().int().positive().optional(),
})

export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    const { competicao_id } = listQuerySchema.parse(req.query)
    res.json(await service.listar(competicao_id, (req as any).user))
  } catch (err) { next(err) }
}

export async function buscarPorId(req: Request, res: Response, next: NextFunction) {
  try {
    const evento = await service.buscarPorId(parseIntParam(req.params.id, 'id'))
    const user = (req as any).user
    if (user?.role === 'COMISSAO_TECNICA' && !(await usuarioTemAcessoAoEvento(user, evento.id))) {
      res.status(403).json({ message: 'Acesso negado a este evento.' })
      return
    }
    res.json(evento)
  } catch (err) { next(err) }
}

export async function criar(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createSchema.parse(req.body)
    res.status(201).json(await service.criar(body))
  } catch (err) { next(err) }
}

export async function editar(req: Request, res: Response, next: NextFunction) {
  try {
    const body = updateSchema.parse(req.body)
    res.json(await service.editar(parseIntParam(req.params.id, 'id'), body))
  } catch (err) { next(err) }
}

export async function remover(req: Request, res: Response, next: NextFunction) {
  try {
    await service.remover(parseIntParam(req.params.id, 'id'))
    res.status(204).send()
  } catch (err) { next(err) }
}

export async function uploadLogo(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseIntParam(req.params.id, 'id')
    const file = (req as any).file as Express.Multer.File | undefined
    if (!file) {
      res.status(400).json({ message: 'Arquivo de logo obrigatório no campo "logo".' })
      return
    }
    // Apaga logo antiga se houver, antes de salvar a nova
    const existente = await service.getLogoUrl(id)
    if (existente) {
      try { deleteFile('eventos', path.basename(existente)) } catch { /* ignore */ }
    }
    const logo_url = `/uploads/eventos/${file.filename}`
    const evento = await service.setLogoUrl(id, logo_url)
    res.json(evento)
  } catch (err) { next(err) }
}

export async function removerLogo(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseIntParam(req.params.id, 'id')
    const existente = await service.getLogoUrl(id)
    if (existente) {
      try { deleteFile('eventos', path.basename(existente)) } catch { /* ignore */ }
    }
    const evento = await service.setLogoUrl(id, null)
    res.json(evento)
  } catch (err) { next(err) }
}
