import { Request, Response, NextFunction } from 'express'
import prisma from '../../lib/prisma'
import { parseIntParam } from '../../lib/parse-id'
import { gerarCongressoXlsx, nomeArquivo } from './relatorio_congresso.service'
import {
  gerarCongressoJeespXlsx,
  nomeArquivoCongressoJeesp,
} from './relatorio_congresso_jeesp.service'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export async function congresso(req: Request, res: Response, next: NextFunction) {
  try {
    const eventoId = parseIntParam(req.params.eventoId, 'eventoId')
    const evento = await prisma.evento.findUnique({
      where: { id: eventoId },
      select: {
        id: true,
        nome: true,
        competicao: { select: { subtitulo_municipio_por_modalidade: true } },
      },
    })
    if (!evento) {
      res.status(404).json({ message: 'Evento não encontrado' })
      return
    }

    // Competição escolar (JEESP) tem layout próprio: uma aba por esporte, com um
    // bloco por modalidade. As demais seguem no relatório visual de sempre.
    const escolar = evento.competicao?.subtitulo_municipio_por_modalidade === true
    const buf = escolar ? await gerarCongressoJeespXlsx(eventoId) : await gerarCongressoXlsx(eventoId)
    const filename = escolar ? nomeArquivoCongressoJeesp(evento) : nomeArquivo(evento)

    res.setHeader('Content-Type', XLSX_MIME)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buf)
  } catch (err) {
    next(err)
  }
}
