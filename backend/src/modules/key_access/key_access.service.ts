import prisma from '../../lib/prisma'
import { signKeyToken } from '../../lib/key-jwt'

type Evento = { id: number; competicao_id: number; [k: string]: any }

export async function login(input: { token: string; device_fp: string; device_label: string }) {
  const key = await prisma.eventoKey.findUnique({
    where: { token: input.token },
    include: { evento: { include: { competicao: true } } },
  })
  if (!key || key.revogado_em !== null) {
    throw Object.assign(new Error('Chave inválida ou revogada.'), { status: 401, code: 'invalid_or_revoked' })
  }

  // Acesso expira 24h após o início do evento
  const expiraEm = new Date(key.evento.data_hora.getTime() + 24 * 60 * 60 * 1000)
  if (expiraEm < new Date()) {
    throw Object.assign(
      new Error('Acesso ao evento encerrado.'),
      { status: 401, code: 'event_expired' }
    )
  }

  const now = new Date()
  const firstUse = key.device_fp === null

  if (!firstUse && key.device_fp !== input.device_fp) {
    throw Object.assign(
      new Error('Esta chave já está em uso em outro aparelho. Solicite ao organizador o reset.'),
      { status: 403, code: 'device_mismatch' }
    )
  }

  await prisma.eventoKey.update({
    where: { id: key.id },
    data: firstUse
      ? { device_fp: input.device_fp, device_label: input.device_label, first_used_at: now, last_seen_at: now }
      : { last_seen_at: now },
  })

  const keyToken = signKeyToken({ keyId: key.id, eventoId: key.evento_id, deviceFp: input.device_fp })
  return { keyToken, evento: key.evento }
}

export async function getModalidades(evento: Evento) {
  return prisma.modalidade.findMany({
    where: { competicao_id: evento.competicao_id },
    orderBy: { nome: 'asc' },
    include: { tipo_modalidade: { select: { tipo: true } } },
  })
}

export async function getModalidadeDetail(evento: Evento, modalidade_id: number) {
  const modalidade = await prisma.modalidade.findUnique({
    where: { id: modalidade_id },
    include: { tipo_modalidade: { select: { tipo: true } } },
  })
  if (!modalidade || modalidade.competicao_id !== evento.competicao_id) {
    throw Object.assign(new Error('Modalidade não encontrada neste evento'), { status: 404 })
  }

  const [inscritos, campeoes, sorteio] = await Promise.all([
    prisma.inscricao.findMany({
      where: { evento_id: evento.id, modalidade_id },
      include: {
        participante: { include: { municipio: true, inspetoria: true, delegacia: true } },
      },
    }),
    prisma.campeaoAnterior.findMany({
      where: { evento_id: evento.id, modalidade_id },
      include: {
        participante: { include: { municipio: true, inspetoria: true, delegacia: true } },
      },
      orderBy: { posicao: 'asc' },
    }),
    prisma.sorteio.findUnique({
      where: { evento_id_modalidade_id: { evento_id: evento.id, modalidade_id } },
    }),
  ])

  return { modalidade, inscritos, campeoes, sorteio }
}
