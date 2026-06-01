import { Router, Request, Response, NextFunction } from 'express'
import prisma from '../../lib/prisma'

const router = Router()

router.get('/public', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const [inscritos_ativos, sorteios_realizados] = await Promise.all([
      prisma.inscricao.count({ where: { evento: { data_hora: { gte: hoje } } } }),
      prisma.sorteio.count(),
    ])

    res.json({ inscritos_ativos, sorteios_realizados })
  } catch (err) {
    next(err)
  }
})

export default router
