import type { Evento } from '../types/evento'

export type GrupoEventos = { competicaoId: number; competicaoNome: string; eventos: Evento[] }

export function agruparEventosPorCompeticao(eventos: Evento[]): GrupoEventos[] {
  const byComp = new Map<number, GrupoEventos>()
  for (const e of eventos) {
    let g = byComp.get(e.competicao_id)
    if (!g) {
      g = { competicaoId: e.competicao_id, competicaoNome: e.competicao?.nome ?? '—', eventos: [] }
      byComp.set(e.competicao_id, g)
    }
    g.eventos.push(e)
  }
  const dataMax = (g: GrupoEventos) =>
    Math.max(...g.eventos.map(e => new Date(e.data_hora).getTime()))
  for (const g of byComp.values()) {
    g.eventos.sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime())
  }
  return Array.from(byComp.values()).sort((a, b) => {
    const d = dataMax(b) - dataMax(a)
    return d !== 0 ? d : a.competicaoNome.localeCompare(b.competicaoNome, 'pt-BR')
  })
}
