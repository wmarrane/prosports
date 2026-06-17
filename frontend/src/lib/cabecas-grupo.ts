import { applyAnfitriaoRuleFront } from './anfitriao-rule'

export type CabecaCampeao = { participante_id: number; posicao: number; nome: string }

export function cabecasComGrupo(args: {
  campeoes: CabecaCampeao[]
  inscritosIds: Set<number>
  anfitriaoPid: number | null
  anfitriaoNome: string | null
  consideraAnfitriao: boolean
  grupos: { letra: string; participantes: number[] }[] | null
}): { nome: string; grupo: string | null }[] {
  const { campeoes, inscritosIds, anfitriaoPid, anfitriaoNome, consideraAnfitriao, grupos } = args
  const ordenados = [...campeoes].sort((a, b) => a.posicao - b.posicao)
  const anfitriaoInscrito = anfitriaoPid != null && inscritosIds.has(anfitriaoPid)
  const anfitriaoEhCampeao = anfitriaoPid != null && ordenados.some(c => c.participante_id === anfitriaoPid)

  const itens: { pid: number; nome: string }[] = ordenados.map(c => ({ pid: c.participante_id, nome: c.nome }))
  if (consideraAnfitriao && anfitriaoInscrito && anfitriaoPid != null && !anfitriaoEhCampeao) {
    itens.push({ pid: anfitriaoPid, nome: anfitriaoNome ?? '—' })
  }

  const headMap = new Map<number, string>()
  if (grupos && grupos.length > 0) {
    const campeoesInscritosPids = ordenados
      .filter(c => inscritosIds.has(c.participante_id))
      .map(c => c.participante_id)
    const cabecaList = applyAnfitriaoRuleFront(
      campeoesInscritosPids, anfitriaoPid, anfitriaoInscrito, consideraAnfitriao, 'grupos', grupos.length,
    )
    const n = Math.min(cabecaList.length, grupos.length)
    for (let i = 0; i < n; i++) headMap.set(cabecaList[i], grupos[i].letra)
  }

  return itens.map(it => ({ nome: it.nome, grupo: headMap.has(it.pid) ? `Grupo ${headMap.get(it.pid)}` : null }))
}
