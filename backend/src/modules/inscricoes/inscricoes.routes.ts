import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import * as ctrl from './inscricoes.controller'

const router = Router()
const admin = [requireAuth, requireRole('ADMIN')]

router.get('/counts', requireAuth, ctrl.counts)
router.get('/', requireAuth, ctrl.listar)
router.get('/:id', requireAuth, ctrl.buscarPorId)
router.post('/', ...admin, ctrl.criar)
router.post('/bulk', ...admin, ctrl.criarBulk)
router.post('/import', ...admin, ctrl.importar)
router.delete('/evento/:eventoId/modalidade/:modalidadeId', ...admin, ctrl.removerTodosDaModalidade)
router.delete('/:id', ...admin, ctrl.remover)

export default router
