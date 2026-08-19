import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as service from './modalidades.service'
import { importarCsv } from './import.service'
import { parseIntParam } from '../../lib/parse-id'

const createSchema = z.object({
  nome: z.string().min(1),
  sigla: z.string().min(1),
  competicao_id: z.number().int().positive(),
  tipo_modalidade_id: z.number().int().positive(),
  chave_versao: z.enum(['V1', 'V2']).optional(),
  usa_metade_chave: z.boolean().optional(),
  mascarar_nome: z.boolean().optional(),
  mensagens_inscritos: z.array(z.object({
    min: z.number().int().min(1),
    max: z.number().int().min(1).nullable(),
    mensagem: z.string(),
    pular_sorteio: z.boolean(),
  })).optional(),
})
const updateSchema = createSchema.partial()

const replicarSchema = z.object({
  origem_id: z.number().int().positive(),
  destino_ids: z.array(z.number().int().positive()).min(1),
  mensagens: z.array(z.object({
    min: z.number().int().min(1),
    max: z.number().int().min(1).nullable(),
    mensagem: z.string(),
    pular_sorteio: z.boolean(),
  })),
})

export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    const competicao_id = req.query.competicao_id ? Number(req.query.competicao_id) : undefined
    res.json(await service.listar(competicao_id))
  } catch (err) { next(err) }
}

export async function buscarPorId(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.buscarPorId(parseIntParam(req.params.id, 'id'))) } catch (err) { next(err) }
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

export async function replicarMensagens(req: Request, res: Response, next: NextFunction) {
  try {
    const body = replicarSchema.parse(req.body)
    res.json(await service.replicarMensagens(body.origem_id, body.destino_ids, body.mensagens))
  } catch (err) { next(err) }
}

const ativaSchema = z.object({ ativa: z.boolean() })

export async function setAtiva(req: Request, res: Response, next: NextFunction) {
  try {
    const { ativa } = ativaSchema.parse(req.body)
    res.json(await service.setAtiva(parseIntParam(req.params.id, 'id'), ativa))
  } catch (err) { next(err) }
}

export async function remover(req: Request, res: Response, next: NextFunction) {
  try {
    await service.remover(parseIntParam(req.params.id, 'id'))
    res.status(204).send()
  } catch (err) { next(err) }
}

export async function importar(req: Request, res: Response, next: NextFunction) {
  try {
    const file = (req as any).file as Express.Multer.File | undefined
    if (!file) {
      res.status(400).json({ message: 'Arquivo CSV obrigatório no campo "arquivo".' })
      return
    }
    const competicao_id = Number(req.body.competicao_id ?? req.query.competicao_id)
    if (!Number.isInteger(competicao_id) || competicao_id <= 0) {
      res.status(400).json({ message: 'competicao_id é obrigatório.' })
      return
    }
    const content = file.buffer.toString('utf8')
    res.json(await importarCsv(competicao_id, content))
  } catch (err) { next(err) }
}
