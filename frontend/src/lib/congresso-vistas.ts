const KEY = (eventoId: number) => `prosports.congresso.vistas.${eventoId}`

export function addVista(ids: number[], modalidadeId: number): number[] {
  return ids.includes(modalidadeId) ? ids : [...ids, modalidadeId]
}

export function loadVistas(eventoId: number): number[] {
  try {
    const raw = localStorage.getItem(KEY(eventoId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : []
  } catch {
    return []
  }
}

export function saveVistas(eventoId: number, ids: number[]): void {
  try {
    localStorage.setItem(KEY(eventoId), JSON.stringify(ids))
  } catch {
    /* storage indisponível — ignora */
  }
}

export function clearVistas(eventoId: number): void {
  try {
    localStorage.removeItem(KEY(eventoId))
  } catch {
    /* storage indisponível — ignora */
  }
}
