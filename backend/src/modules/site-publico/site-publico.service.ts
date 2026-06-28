import prisma from '../../lib/prisma'
import { montaSnapshot } from './snapshot'
import { putSnapshot, deleteSnapshot, dispatchBuild } from './snapshot-store'
import { composeSubtituloLine, type CampoSubtitulo } from '../../lib/compose-subtitulo'
import { getModalidadeIdsExcluidas } from '../eventos/evento-modalidades.service'

const STATUS_PARCIAL_OK = ['pronto', 'parcial', 'sorteado']

export async function publicar(eventoId: number, opts: { permitirParcial?: boolean } = {}): Promise<void> {
  const evento = await prisma.evento.findUnique({
    where: { id: eventoId },
    select: {
      id: true, nome: true, local: true, organizador: true, data_hora: true,
      anfitriao_id: true, competicao_id: true, status: true,
      data_inicio: true, data_fim: true,
      boletins: { select: { numero: true, titulo: true, categoria: true, data_publicacao: true, public_url: true, size_bytes: true, atualizado_em: true } },
      competicao: { select: { nome: true, considerar_anfitriao: true, subtitulo_campos: true } },
      municipio: { select: { nome: true } },
    },
  })
  if (!evento) throw Object.assign(new Error('Evento não encontrado'), { status: 404 })
  if (opts.permitirParcial) {
    if (!STATUS_PARCIAL_OK.includes(evento.status)) {
      throw Object.assign(
        new Error('Publicação parcial requer evento a partir de "Pronto p/ sorteio".'),
        { status: 400 },
      )
    }
  } else if (evento.status !== 'sorteado') {
    throw Object.assign(
      new Error('Só é possível publicar eventos com status "Sorteado".'),
      { status: 400 },
    )
  }

  const modalidades = await prisma.modalidade.findMany({
    where: { competicao_id: evento.competicao_id, ativa: true },
    select: { id: true, nome: true, tipo_modalidade: { select: { tipo: true } }, mensagens_inscritos: true },
    orderBy: { nome: 'asc' },
  })

  const excluidasIds = await getModalidadeIdsExcluidas(eventoId)
  const modalidadesFiltradas = modalidades.filter(m => !excluidasIds.has(m.id))

  const [inscricoes, campeoes, sorteios] = await Promise.all([
    prisma.inscricao.findMany({
      where: { evento_id: eventoId },
      select: { modalidade_id: true, participante: { select: { id: true, nome: true, subtitulo: true, municipio: true, inspetoria: true, delegacia: true } } },
      orderBy: { criado_em: 'asc' },
    }),
    prisma.campeaoAnterior.findMany({
      where: { evento_id: eventoId },
      select: { modalidade_id: true, participante_id: true, posicao: true },
    }),
    prisma.sorteio.findMany({
      where: { evento_id: eventoId },
      select: { modalidade_id: true, tipo: true, seed: true, resultado: true },
    }),
  ])

  const inscricoesPorModalidade = new Map<number, any[]>()
  for (const i of inscricoes) {
    const arr = inscricoesPorModalidade.get(i.modalidade_id) ?? []
    arr.push(i); inscricoesPorModalidade.set(i.modalidade_id, arr)
  }
  const campeoesPorModalidade = new Map<number, any[]>()
  for (const c of campeoes) {
    const arr = campeoesPorModalidade.get(c.modalidade_id) ?? []
    arr.push(c); campeoesPorModalidade.set(c.modalidade_id, arr)
  }
  const sorteiosPorModalidade = new Map<number, any>()
  for (const s of sorteios) sorteiosPorModalidade.set(s.modalidade_id, s)

  const campos = (evento.competicao.subtitulo_campos as CampoSubtitulo[]) ?? []
  const snapshot = montaSnapshot({
    evento,
    modalidades: modalidadesFiltradas,
    inscricoesPorModalidade,
    campeoesPorModalidade,
    sorteiosPorModalidade,
    subtituloFn: (p: any) => composeSubtituloLine(p, campos),
  })

  await putSnapshot(eventoId, snapshot)
  await dispatchBuild()
  // Trailing write: marca a flag no DB só depois do commit + dispatch no GitHub.
  // Se este update falhar, o site já está publicado e um retry é idempotente
  // (re-commita o snapshot idêntico), apenas reescrevendo a mesma data.
  await prisma.evento.update({ where: { id: eventoId }, data: { site_publicado_em: new Date() } })
}

export async function despublicar(eventoId: number): Promise<void> {
  await deleteSnapshot(eventoId)
  await dispatchBuild()
  await prisma.evento.update({ where: { id: eventoId }, data: { site_publicado_em: null } })
}
