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

type ModInfo = { id: number; nome: string; tipo: 'grupos' | 'chaves' | 'especifico' | 'ordem_entrada' }

export type SemRegraInput = {
  eventosAtivos: Array<{ id: number; nome: string; competicao_id: number }>
  modalidadesById: Record<number, ModInfo>
  countsByEvento: Record<number, Record<number, number>>
  rulesByCompeticao: Record<number, { grupos: number[]; chaves: number[] }>
}

export function deriveSemRegraAlerts(input: SemRegraInput): Alerta[] {
  const { eventosAtivos, modalidadesById, countsByEvento, rulesByCompeticao } = input
  const out: Alerta[] = []
  for (const ev of eventosAtivos) {
    const counts = countsByEvento[ev.id] ?? {}
    const rules = rulesByCompeticao[ev.competicao_id] ?? { grupos: [], chaves: [] }
    for (const [modIdStr, n] of Object.entries(counts)) {
      if (!n || n <= 0) continue
      const mod = modalidadesById[Number(modIdStr)]
      if (!mod) continue
      if (mod.tipo !== 'grupos' && mod.tipo !== 'chaves') continue
      const temRegra = mod.tipo === 'grupos' ? rules.grupos.includes(n) : rules.chaves.includes(n)
      if (temRegra) continue
      out.push({
        id: `semregra-${ev.id}-${mod.id}`,
        tipo: 'sem_regra',
        titulo: 'Modalidade sem regra',
        descricao: `${ev.nome} · ${mod.nome} (${n})`,
        to: `/eventos/${ev.id}/inscricoes`,
      })
    }
  }
  return out
}
