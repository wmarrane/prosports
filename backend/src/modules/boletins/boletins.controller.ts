import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as service from './boletins.service'
import { parseIntParam } from '../../lib/parse-id'

const CATEGORIAS = ['Oficial','Regulamento','Resultados','Convocacao','ComunicadoErrata'] as const

const criarSchema = z.object({
  numero: z.coerce.number().int().positive(),
  titulo: z.string().min(1),
  categoria: z.enum(CATEGORIAS),
  data_publicacao: z.coerce.date(),
})

export async function criar(req: Request, res: Response, next: NextFunction) {
  try {
    const eventoId = parseIntParam(req.params.eventoId, 'eventoId')
    const file = (req as any).file as Express.Multer.File | undefined
    if (!file) { res.status(400).json({ message: 'Arquivo PDF obrigatório no campo "file".' }); return }
    const body = criarSchema.parse(req.body)
    const boletim = await service.criarBoletim({ eventoId, ...body, file })
    res.status(201).json(boletim)
  } catch (err) { next(err) }
}

export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    const eventoId = parseIntParam(req.params.eventoId, 'eventoId')
    res.json(await service.listarBoletins(eventoId))
  } catch (err) { next(err) }
}

export async function remover(req: Request, res: Response, next: NextFunction) {
  try {
    const eventoId = parseIntParam(req.params.eventoId, 'eventoId')
    const boletimId = parseIntParam(req.params.boletimId, 'boletimId')
    await service.removerBoletim(eventoId, boletimId)
    res.status(204).send()
  } catch (err) { next(err) }
}
