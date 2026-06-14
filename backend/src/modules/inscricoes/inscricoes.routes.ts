import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { requireAcessoEvento } from '../../middleware/evento-acesso'
import prisma from '../../lib/prisma'
import * as ctrl from './inscricoes.controller'

const router = Router()
const acessoBody = requireAcessoEvento(req => Number(req.body?.evento_id))
const acessoParamsEvento = requireAcessoEvento(req => Number(req.params.eventoId))
const acessoInscricaoId = requireAcessoEvento(async req => {
  const i = await prisma.inscricao.findUnique({ where: { id: Number(req.params.id) }, select: { evento_id: true } })
  return i?.evento_id ?? null
})
const acessoQueryEvento = requireAcessoEvento(req => Number(req.query.evento_id))

router.get('/counts', requireAuth, acessoQueryEvento, ctrl.counts)
router.get('/', requireAuth, acessoQueryEvento, ctrl.listar)
router.get('/:id', requireAuth, acessoInscricaoId, ctrl.buscarPorId)
router.post('/', requireAuth, acessoBody, ctrl.criar)
router.post('/bulk', requireAuth, acessoBody, ctrl.criarBulk)
router.post('/import', requireAuth, acessoBody, ctrl.importar)
router.delete('/evento/:eventoId/modalidade/:modalidadeId', requireAuth, acessoParamsEvento, ctrl.removerTodosDaModalidade)
router.delete('/:id', requireAuth, acessoInscricaoId, ctrl.remover)

export default router
