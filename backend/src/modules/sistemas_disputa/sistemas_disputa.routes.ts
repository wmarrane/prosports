import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import * as ctrl from './sistemas_disputa.controller'

const router = Router()
const admin = [requireAuth, requireRole('ADMIN')]

router.get('/grupos', ...admin, ctrl.grupos.listar)
router.post('/grupos', ...admin, ctrl.grupos.criar)
router.put('/grupos/:id', ...admin, ctrl.grupos.editar)
router.delete('/grupos/:id', ...admin, ctrl.grupos.remover)

router.get('/chaves', ...admin, ctrl.chaves.listar)
router.post('/chaves', ...admin, ctrl.chaves.criar)
router.put('/chaves/:id', ...admin, ctrl.chaves.editar)
router.delete('/chaves/:id', ...admin, ctrl.chaves.remover)

router.post('/copiar', ...admin, ctrl.copiar)

export default router
