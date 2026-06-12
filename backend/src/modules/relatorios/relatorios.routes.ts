import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { requireAcessoEvento } from '../../middleware/evento-acesso'
import * as ctrl from './relatorios.controller'

const router = Router()
const acessoParamsEvento = requireAcessoEvento(req => Number(req.params.eventoId))

router.get('/eventos/:eventoId/congresso', requireAuth, acessoParamsEvento, ctrl.congresso)

export default router
