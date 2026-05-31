import { Router } from 'express'
import multer from 'multer'
import { requireAuth, requireRole } from '../../middleware/auth'
import * as ctrl from './modalidades.controller'

const router = Router()
const admin = [requireAuth, requireRole('ADMIN')]

const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase()
    if (name.endsWith('.csv') || file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true)
    } else {
      cb(Object.assign(new Error('Apenas arquivos CSV são aceitos.'), { status: 400 }))
    }
  },
})

router.get('/', ...admin, ctrl.listar)
router.get('/:id', ...admin, ctrl.buscarPorId)
router.post('/', ...admin, ctrl.criar)
router.put('/:id', ...admin, ctrl.editar)
router.delete('/:id', ...admin, ctrl.remover)
router.post('/import', ...admin, uploadCsv.single('arquivo'), ctrl.importar)

export default router
