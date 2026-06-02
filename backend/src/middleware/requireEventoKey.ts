import { Request, Response, NextFunction } from 'express'
import prisma from '../lib/prisma'
import { verifyKeyToken } from '../lib/key-jwt'

export async function requireEventoKey(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Token não fornecido' })
    return
  }

  let payload
  try {
    payload = verifyKeyToken(header.slice(7))
  } catch {
    res.status(401).json({ message: 'Token inválido ou expirado' })
    return
  }

  const key = await prisma.eventoKey.findUnique({
    where: { id: payload.keyId },
    include: { evento: { include: { competicao: true } } },
  })

  if (!key || key.revogado_em !== null) {
    res.status(401).json({ message: 'Chave revogada ou inexistente' })
    return
  }

  if (key.device_fp && key.device_fp !== payload.deviceFp) {
    res.status(401).json({ message: 'Dispositivo não reconhecido' })
    return
  }

  // Atualiza last_seen_at sincronamente (admin precisa ver atividade ao vivo).
  // O custo é 1 UPDATE por request — aceitável no volume atual; reavaliar se virar gargalo.
  await prisma.eventoKey.update({
    where: { id: key.id },
    data: { last_seen_at: new Date() },
  })

  ;(req as any).eventoKey = key
  next()
}
