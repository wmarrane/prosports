import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { requireAcessoEvento } from '../../middleware/evento-acesso'
import prisma from '../../lib/prisma'
import * as ctrl from './sorteios.controller'

const router = Router()
const acessoBody = requireAcessoEvento(req => Number(req.body?.evento_id))
const acessoParamsEvento = requireAcessoEvento(req => Number(req.params.evento_id))
const acessoSorteioId = requireAcessoEvento(async req => {
  const n = Number(req.params.id)
  if (!Number.isInteger(n) || n <= 0) return null
  const s = await prisma.sorteio.findUnique({ where: { id: n }, select: { evento_id: true } })
  return s?.evento_id ?? null
})
const acessoQueryEvento = requireAcessoEvento(req => Number(req.query.evento_id))

router.get('/', requireAuth, acessoQueryEvento, ctrl.listar)
router.get('/:id', requireAuth, acessoSorteioId, ctrl.buscarPorId)
router.post('/executar', requireAuth, acessoBody, ctrl.executar)
router.delete('/evento/:evento_id', requireAuth, acessoParamsEvento, ctrl.removerTodosDoEvento)
router.delete('/:id', requireAuth, acessoSorteioId, ctrl.remover)

export default router
