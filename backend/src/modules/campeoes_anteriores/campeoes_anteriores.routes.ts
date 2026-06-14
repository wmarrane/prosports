import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { requireAcessoEvento } from '../../middleware/evento-acesso'
import prisma from '../../lib/prisma'
import * as ctrl from './campeoes_anteriores.controller'

const router = Router()
const acessoBody = requireAcessoEvento(req => Number(req.body?.evento_id))
const acessoCampeaoId = requireAcessoEvento(async req => {
  const c = await prisma.campeaoAnterior.findUnique({ where: { id: Number(req.params.id) }, select: { evento_id: true } })
  return c?.evento_id ?? null
})
const acessoQueryEvento = requireAcessoEvento(req => Number(req.query.evento_id))

router.get('/', requireAuth, acessoQueryEvento, ctrl.listar)
router.post('/', requireAuth, acessoBody, ctrl.criar)
router.post('/import', requireAuth, acessoBody, ctrl.importar)
router.delete('/:id', requireAuth, acessoCampeaoId, ctrl.remover)

export default router
