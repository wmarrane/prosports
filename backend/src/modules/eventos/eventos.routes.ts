import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import { createUpload } from '../../lib/upload'
import * as ctrl from './eventos.controller'

const router = Router()
const admin = [requireAuth, requireRole('ADMIN')]
const uploadLogo = createUpload('eventos')

router.get('/', requireAuth, ctrl.listar)
router.get('/:id', requireAuth, ctrl.buscarPorId)
router.post('/', ...admin, ctrl.criar)
router.put('/:id', ...admin, ctrl.editar)
router.delete('/:id', ...admin, ctrl.remover)
router.post('/:id/logo', ...admin, uploadLogo.single('logo'), ctrl.uploadLogo)
router.delete('/:id/logo', ...admin, ctrl.removerLogo)

export default router
