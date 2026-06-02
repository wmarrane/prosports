import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import * as ctrl from './evento_keys.controller'

// Mounted at /eventos/:evento_id/keys (sub-router)
const router = Router({ mergeParams: true })
const admin = [requireAuth, requireRole('ADMIN')]

router.get('/', ...admin, ctrl.listar)
router.post('/', ...admin, ctrl.criar)
router.post('/:keyId/revoke', ...admin, ctrl.revogar)
router.post('/:keyId/reset-device', ...admin, ctrl.resetDevice)
router.delete('/:keyId', ...admin, ctrl.apagar)

export default router
