import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import * as ctrl from './campeoes_anteriores.controller'

const router = Router()
const admin = [requireAuth, requireRole('ADMIN')]

router.get('/', requireAuth, ctrl.listar)
router.post('/', ...admin, ctrl.criar)
router.post('/import', ...admin, ctrl.importar)
router.delete('/:id', ...admin, ctrl.remover)

export default router
