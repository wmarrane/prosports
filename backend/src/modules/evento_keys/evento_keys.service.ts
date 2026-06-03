import prisma from '../../lib/prisma'
import { randomBytes } from 'crypto'

function novoToken(): string {
  // 16 bytes = 32 hex chars; suficiente para ser "unguessable" mas curto na URL
  return randomBytes(16).toString('hex')
}

async function mapPrismaError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw Object.assign(
        new Error('Já existe chave para este email neste evento.'),
        { status: 409 }
      )
    }
    throw err
  }
}

export async function listarPorEvento(evento_id: number) {
  return prisma.eventoKey.findMany({
    where: { evento_id },
    orderBy: { criado_em: 'desc' },
  })
}

export async function criar(input: { evento_id: number; email: string; criada_por: number }) {
  // Após 24h da data/hora do evento, nenhuma nova chave pode ser gerada
  // (acesso mobile encerrou). Vale tanto pra nova quanto pra reativação.
  const evento = await prisma.evento.findUnique({
    where: { id: input.evento_id },
    select: { data_hora: true },
  })
  if (!evento) {
    throw Object.assign(new Error('Evento não encontrado.'), { status: 404 })
  }
  const expiraEm = new Date(evento.data_hora.getTime() + 24 * 60 * 60 * 1000)
  if (expiraEm < new Date()) {
    throw Object.assign(
      new Error('Evento já encerrado (mais de 24h da data/hora). Não é possível gerar acesso mobile.'),
      { status: 403, code: 'event_expired' }
    )
  }

  // Se existe chave revogada pra esse email, reativa com token novo
  // (invalida link/QR antigos sem precisar apagar o registro histórico).
  const existing = await prisma.eventoKey.findUnique({
    where: { evento_id_email: { evento_id: input.evento_id, email: input.email } },
  })

  if (existing) {
    if (existing.revogado_em === null) {
      throw Object.assign(
        new Error('Já existe chave ativa para este email neste evento.'),
        { status: 409 }
      )
    }
    return prisma.eventoKey.update({
      where: { id: existing.id },
      data: {
        token: novoToken(),
        revogado_em: null,
        device_fp: null,
        device_label: null,
        first_used_at: null,
        last_seen_at: null,
        criada_por: input.criada_por,
        criado_em: new Date(),
      },
    })
  }

  return mapPrismaError(() =>
    prisma.eventoKey.create({
      data: {
        evento_id: input.evento_id,
        email: input.email,
        criada_por: input.criada_por,
        token: novoToken(),
      },
    })
  )
}

export async function revogar(id: number, evento_id: number) {
  const existing = await prisma.eventoKey.findUnique({ where: { id } })
  if (!existing || existing.evento_id !== evento_id) {
    throw Object.assign(new Error('Chave não encontrada'), { status: 404 })
  }
  return prisma.eventoKey.update({
    where: { id },
    data: { revogado_em: new Date() },
  })
}

export async function resetDevice(id: number, evento_id: number) {
  const existing = await prisma.eventoKey.findUnique({ where: { id } })
  if (!existing || existing.evento_id !== evento_id) {
    throw Object.assign(new Error('Chave não encontrada'), { status: 404 })
  }
  return prisma.eventoKey.update({
    where: { id },
    data: { device_fp: null, device_label: null, first_used_at: null, last_seen_at: null },
  })
}

export async function apagar(id: number, evento_id: number) {
  const key = await prisma.eventoKey.findUnique({ where: { id } })
  if (!key || key.evento_id !== evento_id) {
    throw Object.assign(new Error('Chave não encontrada'), { status: 404 })
  }
  if (key.device_fp !== null) {
    throw Object.assign(
      new Error('Esta chave já foi usada. Use Revogar ao invés de Apagar.'),
      { status: 409 }
    )
  }
  return prisma.eventoKey.delete({ where: { id } })
}
