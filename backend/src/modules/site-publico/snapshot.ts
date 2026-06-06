import { applyAnfitriaoRule } from '../sorteios/sorteios.service'
import type {
  SnapEvento, SnapModalidade, SnapParticipante, SnapCampeao,
} from './snapshot-types'

type EventoRow = {
  id: number; nome: string; local: string; organizador: string | null
  data_hora: Date; anfitriao_id: number | null
  competicao: { nome: string; considerar_anfitriao: boolean }
  municipio: { nome: string }
}
type ModalidadeRow = { id: number; nome: string; tipo_modalidade: { tipo: string } }
type InscricaoRow = { participante: { id: number; nome: string; subtitulo: string | null } }
type CampeaoRow = { participante_id: number; posicao: number }
type SorteioRow = { tipo: string; seed: string; resultado: unknown }

export type MontaSnapshotInput = {
  evento: EventoRow
  modalidades: ModalidadeRow[]
  inscricoesPorModalidade: Map<number, InscricaoRow[]>
  campeoesPorModalidade: Map<number, CampeaoRow[]>
  sorteiosPorModalidade: Map<number, SorteioRow>
  subtituloFn: (p: { id: number; nome: string; subtitulo: string | null }) => string | null
}

function calcCabecas(
  tipo: string,
  resultado: any,
  campeoesPidsInscritos: number[],
  anfitriaoPid: number | null,
  anfitriaoInscrito: boolean,
  consideraAnfitriao: boolean,
): number[] {
  if (tipo === 'grupos') {
    const qtd = (resultado?.grupos ?? []).length
    if (qtd === 0) return []
    const finais = applyAnfitriaoRule({
      campeoesPidsInscritos, anfitriaoPid, anfitriaoInscrito, consideraAnfitriao,
      tipo: 'grupos', quantidadeGrupos: qtd,
    })
    return finais.slice(0, qtd)
  }
  if (tipo === 'chaves') {
    const finais = applyAnfitriaoRule({
      campeoesPidsInscritos, anfitriaoPid, anfitriaoInscrito, consideraAnfitriao, tipo: 'chaves',
    })
    return finais.slice(0, 4)
  }
  return []
}

export function montaSnapshot(input: MontaSnapshotInput): SnapEvento {
  const { evento, modalidades, inscricoesPorModalidade, campeoesPorModalidade, sorteiosPorModalidade, subtituloFn } = input

  const modalidadesSnap: SnapModalidade[] = modalidades.map((mod) => {
    const inscricoes = inscricoesPorModalidade.get(mod.id) ?? []
    const campeoes = campeoesPorModalidade.get(mod.id) ?? []
    const sorteio = sorteiosPorModalidade.get(mod.id) ?? null

    const participantes: SnapParticipante[] = inscricoes.map((i) => ({
      id: i.participante.id,
      nome: i.participante.nome,
      subtitulo: subtituloFn(i.participante),
    }))
    const campeoesSnap: SnapCampeao[] = [...campeoes]
      .sort((a, b) => a.posicao - b.posicao)
      .map((c) => ({ participanteId: c.participante_id, posicao: c.posicao }))

    const inscritosSet = new Set(participantes.map((p) => p.id))
    const anfitriaoPid = evento.anfitriao_id
    const anfitriaoInscrito = anfitriaoPid !== null && inscritosSet.has(anfitriaoPid)
    const consideraAnfitriao = evento.competicao.considerar_anfitriao
    const campeoesInscritosPids = campeoesSnap
      .map((c) => c.participanteId)
      .filter((pid) => inscritosSet.has(pid))

    const tipo = mod.tipo_modalidade.tipo as SnapModalidade['tipo']
    const cabecasPids = sorteio
      ? calcCabecas(tipo, sorteio.resultado as any, campeoesInscritosPids, anfitriaoPid, anfitriaoInscrito, consideraAnfitriao)
      : []

    return {
      id: mod.id,
      nome: mod.nome,
      grupo: null,
      tipo,
      status: sorteio ? 'sorteado' : 'aguardando',
      seed: sorteio?.seed ?? null,
      anfitriaoId: anfitriaoPid,
      participantes,
      campeoes: campeoesSnap,
      cabecasPids,
      resultado: sorteio?.resultado ?? null,
    }
  })

  return {
    id: evento.id,
    nome: evento.nome,
    competicao: evento.competicao.nome,
    esporte: evento.competicao.nome,
    cidade: evento.municipio.nome,
    local: evento.local,
    data: evento.data_hora.toISOString(),
    organizador: evento.organizador,
    publicadoEm: new Date().toISOString(),
    modalidades: modalidadesSnap,
  }
}
