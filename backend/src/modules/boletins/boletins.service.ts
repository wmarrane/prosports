import { randomUUID } from 'crypto'
import { CategoriaBoletim } from '@prisma/client'
import prisma from '../../lib/prisma'
import { getStorage } from '../../lib/storage'
import { publicar } from '../site-publico/site-publico.service'
import { assertPdf, sanitizeFilename } from '../../lib/upload-pdf'

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
  assertPdf(file.buffer)
  const publicUrl = await getStorage().put(objectKey, file.buffer, 'application/pdf')
  try {
    const boletim = await prisma.boletim.create({
      data: {
        evento_id: eventoId, numero, titulo, categoria, data_publicacao,
        filename: sanitizeFilename(file.originalname), object_key: objectKey, public_url: publicUrl,
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

type SubstituirInput = {
  titulo?: string
  categoria?: CategoriaBoletim
  data_publicacao?: Date
  file?: { buffer: Buffer; originalname: string; size: number; mimetype: string }
}

export async function substituirBoletim(eventoId: number, boletimId: number, input: SubstituirInput) {
  const boletim = await prisma.boletim.findFirst({ where: { id: boletimId, evento_id: eventoId } })
  if (!boletim) throw Object.assign(new Error('Boletim não encontrado'), { status: 404 })

  const data: Record<string, unknown> = {}
  if (input.titulo !== undefined) data.titulo = input.titulo
  if (input.categoria !== undefined) data.categoria = input.categoria
  if (input.data_publicacao !== undefined) data.data_publicacao = input.data_publicacao

  let novoObjectKey: string | null = null
  if (input.file) {
    assertPdf(input.file.buffer)
    novoObjectKey = `eventos/${eventoId}/boletim-${boletim.numero}-${randomUUID()}.pdf`
    const url = await getStorage().put(novoObjectKey, input.file.buffer, 'application/pdf')
    data.object_key = novoObjectKey
    data.public_url = url
    data.filename = sanitizeFilename(input.file.originalname)
    data.size_bytes = input.file.size
  }

  try {
    const atualizado = await prisma.boletim.update({ where: { id: boletim.id }, data })
    if (input.file) { try { await getStorage().remove(boletim.object_key) } catch { /* ignore */ } }
    await republicarSePublicado(eventoId)
    return atualizado
  } catch (err) {
    if (novoObjectKey) { try { await getStorage().remove(novoObjectKey) } catch { /* ignore */ } }
    throw err
  }
}
