import { Router } from 'express'
import { requireEventoKey } from '../../middleware/requireEventoKey'
import { loginRateLimit } from '../../middleware/security'
import * as ctrl from './key_access.controller'

const router = Router()

// Public: login com token + device (rate-limited contra brute force)
router.post('/login', loginRateLimit, ctrl.login)

// Protegido por keyToken
router.get('/me', requireEventoKey, ctrl.me)
router.get('/modalidades', requireEventoKey, ctrl.modalidades)
router.get('/modalidade/:id', requireEventoKey, ctrl.modalidadeDetail)

export default router
