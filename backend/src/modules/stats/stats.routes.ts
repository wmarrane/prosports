import { Router, Request, Response, NextFunction } from 'express'
import prisma from '../../lib/prisma'

const router = Router()

router.get('/public', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const [participantesDistintos, sorteios_realizados, eventos_sorteados] = await Promise.all([
      prisma.inscricao.findMany({
        where: { evento: { data_hora: { gte: hoje } } },
        distinct: ['evento_id', 'participante_id'],
        select: { evento_id: true },
      }),
      prisma.sorteio.count(),
      prisma.evento.count({ where: { status: 'sorteado' } }),
    ])

    const inscritos_ativos = participantesDistintos.length
    res.json({ inscritos_ativos, sorteios_realizados, eventos_sorteados })
  } catch (err) {
    next(err)
  }
})

export default router
