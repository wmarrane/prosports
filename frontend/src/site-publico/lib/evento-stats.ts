import type { SnapEvento } from '../snapshot-types'
import { esporteBase } from './esporte'

export type TipoSorteio = 'chaves' | 'grupos' | 'ordem_entrada' | 'especifico'

export const TIPO_INFO: Record<TipoSorteio, { grad: string; label: string }> = {
  chaves: { grad: 'var(--grad-brand)', label: 'Chaves eliminatórias' },
  grupos: { grad: 'var(--grad-accent)', label: 'Grupos' },
  ordem_entrada: { grad: 'var(--grad-violet)', label: 'Ordem de entrada' },
  especifico: { grad: 'var(--grad-warn)', label: 'Específico' },
}

export function tiposPresentes(e: SnapEvento): TipoSorteio[] {
  const freq = new Map<TipoSorteio, number>()
  for (const m of e.modalidades) {
    const t = m.tipo as TipoSorteio
    freq.set(t, (freq.get(t) ?? 0) + 1)
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
}

export function tipoDominante(e: SnapEvento): TipoSorteio {
  return tiposPresentes(e)[0] ?? 'chaves'
}

export function inscritos(e: SnapEvento): number {
  return new Set(e.modalidades.flatMap((m) => m.participantes.map((p) => p.id))).size
}

export function totalModalidades(e: SnapEvento): number {
  return e.modalidades.length
}

export function categorias(e: SnapEvento): number {
  return new Set(e.modalidades.map((m) => esporteBase(m.nome))).size
}

export function progressoSorteios(e: SnapEvento): { sorteadas: number; sorteaveis: number; pct: number; done: boolean } {
  const sorteaveis = e.modalidades.filter((m) => m.tipo !== 'especifico').length
  const sorteadas = e.modalidades.filter((m) => m.status === 'sorteado').length
  const pct = sorteaveis > 0 ? Math.round((sorteadas / sorteaveis) * 100) : 0
  return { sorteadas, sorteaveis, pct, done: sorteaveis > 0 && sorteadas === sorteaveis }
}

export function statusEvento(e: SnapEvento): 'Sorteado' | 'Pronto p/ sorteio' {
  return progressoSorteios(e).done ? 'Sorteado' : 'Pronto p/ sorteio'
}
