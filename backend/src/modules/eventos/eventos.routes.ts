import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import { requireAcessoEvento } from '../../middleware/evento-acesso'
import { createUpload } from '../../lib/upload'
import * as ctrl from './eventos.controller'
import eventoKeysRoutes from '../evento_keys/evento_keys.routes'
import * as sitePublico from '../site-publico/site-publico.controller'
import * as anfitriaoOrdem from './anfitriao-ordem.controller'
import * as modalidadesExcluidas from './modalidades-excluidas.controller'

const router = Router()
const admin = [requireAuth, requireRole('ADMIN')]
const acessoEventoIdParam = requireAcessoEvento(req => Number(req.params.id))
const uploadLogo = createUpload('eventos')

router.get('/', requireAuth, ctrl.listar)
router.get('/:id', requireAuth, ctrl.buscarPorId)
router.post('/', ...admin, ctrl.criar)
router.put('/:id', ...admin, ctrl.editar)
router.delete('/:id', ...admin, ctrl.remover)
router.post('/:id/logo', ...admin, uploadLogo.single('logo'), ctrl.uploadLogo)
router.delete('/:id/logo', ...admin, ctrl.removerLogo)
router.post('/:id/publicar', ...admin, sitePublico.publicar)
router.post('/:id/despublicar', ...admin, sitePublico.despublicar)
// Publicação parcial (auto-publish do Modo Congresso): acessível a quem opera o
// evento (ex.: COMISSÃO_TÉCNICA), igual ao sorteio — não é admin-only.
router.post('/:id/publicar-parcial', requireAuth, acessoEventoIdParam, sitePublico.publicarParcial)

router.get('/:id/anfitriao-ordem', requireAuth, acessoEventoIdParam, anfitriaoOrdem.getAnfitriaoOrdem)
router.put('/:id/anfitriao-ordem', ...admin, anfitriaoOrdem.setAnfitriaoOrdem)

router.get('/:id/modalidades', requireAuth, acessoEventoIdParam, modalidadesExcluidas.getModalidadesDoEvento)
router.get('/:id/modalidades-excluidas', requireAuth, acessoEventoIdParam, modalidadesExcluidas.getExcluidas)
router.put('/:id/modalidades-excluidas', ...admin, modalidadesExcluidas.setExcluidas)

router.get('/:id/progresso-sorteio', requireAuth, acessoEventoIdParam, ctrl.progressoSorteio)

router.use('/:evento_id/keys', eventoKeysRoutes)

export default router
