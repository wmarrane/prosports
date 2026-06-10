import { Router } from 'express'
import { loginHandler, refreshHandler, logoutHandler, meHandler, alterarSenhaHandler } from './auth.controller'
import { requireAuth } from '../../middleware/auth'
import { loginRateLimit } from '../../middleware/security'

const router = Router()

router.post('/login', loginRateLimit, loginHandler)
router.post('/refresh', refreshHandler)
router.post('/logout', requireAuth, logoutHandler)
router.post('/alterar-senha', requireAuth, alterarSenhaHandler)
router.get('/me', requireAuth, meHandler)

export default router
