import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import * as ctrl from './users.controller'

const router = Router()
const admin = [requireAuth, requireRole('ADMIN')]

router.get('/', ...admin, ctrl.listar)
router.get('/:id', ...admin, ctrl.buscarPorId)
router.post('/', ...admin, ctrl.criar)
router.patch('/:id', ...admin, ctrl.editar)
router.delete('/:id', ...admin, ctrl.remover)
router.post('/:id/resetar-senha', ...admin, ctrl.resetarSenha)

export default router
