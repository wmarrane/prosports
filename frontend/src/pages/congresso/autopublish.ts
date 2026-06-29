export const MARCOS = [25, 50, 75, 100] as const

export function pctSorteado(sorteadas: number, sorteaveis: number): number {
  return sorteaveis > 0 ? Math.round((sorteadas / sorteaveis) * 100) : 0
}

// Maior marco já atingido pela % atual que ainda não foi publicado; null se nenhum novo.
export function proximoMarcoCruzado(pct: number, ultimoMarcoPublicado: number): number | null {
  const novos = MARCOS.filter((m) => m <= pct && m > ultimoMarcoPublicado)
  return novos.length ? novos[novos.length - 1] : null
}
