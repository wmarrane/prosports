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
        competicao: { select: { modelo_congresso: true } },
      },
    })
    if (!evento) {
      res.status(404).json({ message: 'Evento não encontrado' })
      return
    }

    // O layout é escolha da competição, não consequência de outra flag: o
    // modelo 'jeesp' tem uma aba por esporte com um bloco por modalidade; o
    // 'padrao' é o relatório visual dos Jogos Regionais, que também sabe
    // mostrar o subtítulo por inscrição das competições escolares.
    const jeesp = evento.competicao?.modelo_congresso === 'jeesp'
    const buf = jeesp ? await gerarCongressoJeespXlsx(eventoId) : await gerarCongressoXlsx(eventoId)
    const filename = jeesp ? nomeArquivoCongressoJeesp(evento) : nomeArquivo(evento)

    res.setHeader('Content-Type', XLSX_MIME)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buf)
  } catch (err) {
    next(err)
  }
}
