import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { requireAcessoEvento } from '../../middleware/evento-acesso'
import prisma from '../../lib/prisma'
import * as ctrl from './sorteios.controller'

const router = Router()
const acessoBody = requireAcessoEvento(req => Number(req.body?.evento_id))
const acessoParamsEvento = requireAcessoEvento(req => Number(req.params.evento_id))
const acessoSorteioId = requireAcessoEvento(async req => {
  const s = await prisma.sorteio.findUnique({ where: { id: Number(req.params.id) }, select: { evento_id: true } })
  return s?.evento_id ?? null
})

router.get('/', requireAuth, ctrl.listar)
router.get('/:id', requireAuth, ctrl.buscarPorId)
router.post('/executar', requireAuth, acessoBody, ctrl.executar)
router.delete('/evento/:evento_id', requireAuth, acessoParamsEvento, ctrl.removerTodosDoEvento)
router.delete('/:id', requireAuth, acessoSorteioId, ctrl.remover)

export default router
