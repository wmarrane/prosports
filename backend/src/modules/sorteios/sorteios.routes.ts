import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import * as ctrl from './sorteios.controller'

const router = Router()
const admin = [requireAuth, requireRole('ADMIN')]

router.get('/', requireAuth, ctrl.listar)
router.get('/:id', requireAuth, ctrl.buscarPorId)
router.post('/executar', ...admin, ctrl.executar)
router.delete('/evento/:evento_id', ...admin, ctrl.removerTodosDoEvento)
router.delete('/:id', ...admin, ctrl.remover)

export default router
