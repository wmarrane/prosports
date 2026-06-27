import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import { uploadPdf } from '../../lib/upload-pdf'
import * as ctrl from './boletins.controller'

const router = Router()
const admin = [requireAuth, requireRole('ADMIN')]

router.get('/:eventoId/boletins', ...admin, ctrl.listar)
router.post('/:eventoId/boletins', ...admin, uploadPdf.single('file'), ctrl.criar)
router.delete('/:eventoId/boletins/:boletimId', ...admin, ctrl.remover)

export default router
