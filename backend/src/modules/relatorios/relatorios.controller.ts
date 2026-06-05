import { Request, Response, NextFunction } from 'express'
import prisma from '../../lib/prisma'
import { gerarCongressoXlsx, nomeArquivo } from './relatorio_congresso.service'

export async function congresso(req: Request, res: Response, next: NextFunction) {
  try {
    const eventoId = Number(req.params.eventoId)
    const evento = await prisma.evento.findUnique({
      where: { id: eventoId },
      select: { id: true, nome: true },
    })
    if (!evento) {
      res.status(404).json({ message: 'Evento não encontrado' })
      return
    }

    const buf = await gerarCongressoXlsx(eventoId)

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo(evento)}"`)
    res.send(buf)
  } catch (err) {
    next(err)
  }
}
