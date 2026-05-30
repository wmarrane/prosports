import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import * as ctrl from './inscricoes.controller'

const router = Router()
const admin = [requireAuth, requireRole('ADMIN')]

router.get('/', requireAuth, ctrl.listar)
router.get('/:id', requireAuth, ctrl.buscarPorId)
router.post('/', ...admin, ctrl.criar)
router.post('/import', ...admin, ctrl.importar)
router.delete('/:id', ...admin, ctrl.remover)

export default router
