import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import { uploadPdf } from '../../lib/upload-pdf'
import * as ctrl from './boletins.controller'

const router = Router()
const admin = [requireAuth, requireRole('ADMIN')]

router.get('/eventos/:eventoId/boletins', ...admin, ctrl.listar)
router.post('/eventos/:eventoId/boletins', ...admin, uploadPdf.single('file'), ctrl.criar)
router.delete('/eventos/:eventoId/boletins/:boletimId', ...admin, ctrl.remover)

export default router
