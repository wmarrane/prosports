import { randomUUID } from 'crypto'
import { CategoriaBoletim } from '@prisma/client'
import prisma from '../../lib/prisma'
import { getStorage } from '../../lib/storage'
import { publicar } from '../site-publico/site-publico.service'

type CriarInput = {
  eventoId: number
  numero: number
  titulo: string
  categoria: CategoriaBoletim
  data_publicacao: Date
  file: { buffer: Buffer; originalname: string; size: number; mimetype: string }
}

async function republicarSePublicado(eventoId: number) {
  const ev = await prisma.evento.findUnique({ where: { id: eventoId }, select: { id: true, site_publicado_em: true } })
  if (ev?.site_publicado_em) await publicar(eventoId)
}

export async function criarBoletim(input: CriarInput) {
  const { eventoId, numero, titulo, categoria, data_publicacao, file } = input
  const objectKey = `eventos/${eventoId}/boletim-${numero}-${randomUUID()}.pdf`
  const publicUrl = await getStorage().put(objectKey, file.buffer, 'application/pdf')
  try {
    const boletim = await prisma.boletim.create({
      data: {
        evento_id: eventoId, numero, titulo, categoria, data_publicacao,
        filename: file.originalname, object_key: objectKey, public_url: publicUrl,
        size_bytes: file.size, content_type: 'application/pdf',
      },
    })
    await republicarSePublicado(eventoId)
    return boletim
  } catch (err: any) {
    // rollback do arquivo se o insert falhar (ex.: numero duplicado)
    try { await getStorage().remove(objectKey) } catch { /* ignore */ }
    if (err?.code === 'P2002') throw Object.assign(new Error('Já existe um boletim com este número neste evento.'), { status: 409 })
    throw err
  }
}

export async function listarBoletins(eventoId: number) {
  return prisma.boletim.findMany({ where: { evento_id: eventoId }, orderBy: { numero: 'asc' } })
}

export async function removerBoletim(eventoId: number, boletimId: number) {
  const boletim = await prisma.boletim.findFirst({ where: { id: boletimId, evento_id: eventoId } })
  if (!boletim) throw Object.assign(new Error('Boletim não encontrado'), { status: 404 })
  await getStorage().remove(boletim.object_key)
  await prisma.boletim.delete({ where: { id: boletim.id } })
  await republicarSePublicado(eventoId)
}
