import type { Alerta } from './alertas'

export type AlertaLido = Alerta & { lidaEm: string }

const KEY = 'prosports.notif.lidas'
const CAP = 10

export function aplicarLida(lidas: AlertaLido[], alerta: Alerta, agora?: Date): AlertaLido[] {
  const lidaEm = (agora ?? new Date()).toISOString()
  const semDuplicata = lidas.filter(l => l.id !== alerta.id)
  return [{ ...alerta, lidaEm }, ...semDuplicata].slice(0, CAP)
}

export function carregarLidas(): AlertaLido[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (l): l is AlertaLido =>
        l && typeof l.id === 'string' && typeof l.to === 'string' && typeof l.lidaEm === 'string',
    )
  } catch {
    return []
  }
}

export function salvarLidas(lidas: AlertaLido[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(lidas))
  } catch {
    /* storage indisponível — ignora */
  }
}
