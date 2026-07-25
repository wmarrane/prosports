import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import prisma from '../../lib/prisma'
import { parseIntParam } from '../../lib/parse-id'
import { gerarCongressoXlsx, nomeArquivo } from './relatorio_congresso.service'
import {
  gerarConfirmacaoJeespXlsx,
  nomeArquivoConfirmacao,
} from './relatorio_confirmacao_jeesp.service'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

// Valores do sistema legado do JEESP: não existem no prosports, vêm do form
// que o admin preenche no momento do export.
const jeespParamsSchema = z.object({
  codCompeticao: z.coerce.number().int(),
  competicao: z.string().min(1).max(120),
  divisao: z.string().max(120).default(''),
  codMunicipioSede: z.coerce.number().int(),
  municipioSede: z.string().min(1).max(120),
  codModalidade: z.coerce.number().int().default(0),
})

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

    // Competição escolar (JEESP) troca o relatório visual pela planilha de
    // confirmação. Qualquer outra competição segue com o relatório atual.
    const escolar = evento.competicao?.subtitulo_municipio_por_modalidade === true
    let buf: Buffer
    let filename: string
    if (escolar) {
      const params = jeespParamsSchema.parse(req.query)
      buf = await gerarConfirmacaoJeespXlsx(eventoId, params)
      filename = nomeArquivoConfirmacao(evento)
    } else {
      buf = await gerarCongressoXlsx(eventoId)
      filename = nomeArquivo(evento)
    }

    res.setHeader('Content-Type', XLSX_MIME)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buf)
  } catch (err) {
    next(err)
  }
}
