import type { Evento, EventoStatus } from '../types/evento'

export type AlertaTipo = 'pronto' | 'parcial' | 'inscricoes' | 'sem_regra'

export type Alerta = {
  id: string
  tipo: AlertaTipo
  titulo: string
  descricao: string
  to: string
}

const STATUS_TITULO: Partial<Record<EventoStatus, string>> = {
  pronto: 'Pronto para sortear',
  parcial: 'Sorteio incompleto',
  inscricoes: 'Inscrições abertas',
}

export function deriveEventoAlerts(
  eventos: Array<Pick<Evento, 'id' | 'nome' | 'status'>>,
): Alerta[] {
  const out: Alerta[] = []
  for (const e of eventos) {
    const titulo = STATUS_TITULO[e.status]
    if (!titulo) continue
    out.push({
      id: `evt-${e.id}-${e.status}`,
      tipo: e.status as AlertaTipo,
      titulo,
      descricao: e.nome,
      to: `/eventos/${e.id}/inscricoes`,
    })
  }
  return out
}
