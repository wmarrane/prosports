import 'dotenv/config'
import path from 'path'
import express from 'express'
import cookieParser from 'cookie-parser'
import pino from 'pino'
import { connectRedis } from './lib/redis'
import authRoutes from './modules/auth/auth.routes'
import modalidadesRoutes from './modules/modalidades/modalidades.routes'
import municipiosRoutes from './modules/municipios/municipios.routes'
import inspetoriasRoutes from './modules/inspetorias/inspetorias.routes'
import delegaciasRoutes from './modules/delegacias/delegacias.routes'
import participantesRoutes from './modules/participantes/participantes.routes'
import competicoesRoutes from './modules/competicoes/competicoes.routes'
import eventosRoutes from './modules/eventos/eventos.routes'
import inscricoesRoutes from './modules/inscricoes/inscricoes.routes'
import sorteiosRoutes from './modules/sorteios/sorteios.routes'
import campeoesAnterioresRoutes from './modules/campeoes_anteriores/campeoes_anteriores.routes'
import tiposModalidadeRoutes from './modules/tipos_modalidade/tipos_modalidade.routes'
import usersRoutes from './modules/users/users.routes'
import statsRoutes from './modules/stats/stats.routes'
import sistemasDisputaRoutes from './modules/sistemas_disputa/sistemas_disputa.routes'
import keyAccessRoutes from './modules/key_access/key_access.routes'
import relatoriosRoutes from './modules/relatorios/relatorios.routes'
import boletinsRoutes from './modules/boletins/boletins.routes'
import {
  helmetMiddleware,
  corsMiddleware,
  globalRateLimit,
  errorHandler,
} from './middleware/security'

const app = express()
const logger = pino()
const PORT = process.env.PORT ?? 3000
const UPLOADS_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), 'uploads')

app.set('trust proxy', 1)

app.use(helmetMiddleware)
app.use(corsMiddleware)
app.use(globalRateLimit)
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

app.use('/uploads', express.static(UPLOADS_DIR))
app.use('/stats', statsRoutes)
app.use('/auth', authRoutes)
app.use('/users', usersRoutes)
app.use('/tipos-modalidade', tiposModalidadeRoutes)
app.use('/modalidades', modalidadesRoutes)
app.use('/municipios', municipiosRoutes)
app.use('/inspetorias', inspetoriasRoutes)
app.use('/delegacias', delegaciasRoutes)
app.use('/participantes', participantesRoutes)
app.use('/sorteios', sorteiosRoutes)
app.use('/campeoes-anteriores', campeoesAnterioresRoutes)
app.use('/inscricoes', inscricoesRoutes)
app.use('/eventos', eventosRoutes)
app.use('/competicoes', competicoesRoutes)
app.use('/sistemas-disputa', sistemasDisputaRoutes)
app.use('/key-access', keyAccessRoutes)
app.use('/relatorios', relatoriosRoutes)
app.use('/', boletinsRoutes)

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.use(errorHandler)

function validarSegredos() {
  const s = process.env.JWT_SECRET
  const r = process.env.JWT_REFRESH_SECRET
  const probs: string[] = []
  if (!s) probs.push('JWT_SECRET ausente')
  if (!r) probs.push('JWT_REFRESH_SECRET ausente')
  if (s && r && s === r) probs.push('JWT_SECRET e JWT_REFRESH_SECRET devem ser diferentes')
  if (process.env.NODE_ENV === 'production') {
    if (s && s.length < 32) probs.push('JWT_SECRET deve ter >= 32 chars em produção')
    if (r && r.length < 32) probs.push('JWT_REFRESH_SECRET deve ter >= 32 chars em produção')
  }
  if (probs.length > 0) {
    logger.error({ probs }, 'Configuração de segredos JWT inválida')
    process.exit(1)
  }
}

async function start() {
  validarSegredos()
  await connectRedis()
  app.listen(PORT, () => logger.info(`Server running on port ${PORT}`))
}

start().catch((err) => {
  logger.error(err, 'Falha ao iniciar o servidor')
  process.exit(1)
})
