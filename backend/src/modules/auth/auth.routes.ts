import { Router } from 'express'
import { loginHandler, refreshHandler, logoutHandler, meHandler } from './auth.controller'
import { requireAuth } from '../../middleware/auth'

const router = Router()

router.post('/login', loginHandler)
router.post('/refresh', refreshHandler)
router.post('/logout', requireAuth, logoutHandler)
router.get('/me', requireAuth, meHandler)

export default router
