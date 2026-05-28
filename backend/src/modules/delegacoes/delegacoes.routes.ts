import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import { createUpload } from '../../lib/upload'
import * as ctrl from './delegacoes.controller'

const router = Router()
const upload = createUpload('delegacoes')
const admin = [requireAuth, requireRole('ADMIN')]

router.get('/', ...admin, ctrl.listar)
router.get('/:id', ...admin, ctrl.buscarPorId)
router.post('/', ...admin, upload.single('logo'), ctrl.criar)
router.put('/:id', ...admin, upload.single('logo'), ctrl.editar)
router.delete('/:id', ...admin, ctrl.remover)

export default router
