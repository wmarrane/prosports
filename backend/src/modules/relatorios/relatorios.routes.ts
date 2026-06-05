import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import * as ctrl from './relatorios.controller'

const router = Router()
const admin = [requireAuth, requireRole('ADMIN')]

// GET /relatorios/eventos/:eventoId/congresso  -> xlsx
router.get('/eventos/:eventoId/congresso', ...admin, ctrl.congresso)

export default router
