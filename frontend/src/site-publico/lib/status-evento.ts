export type EventoStatus = 'rascunho' | 'inscricoes' | 'pronto' | 'sorteado' | 'parcial' | 'suspenso'

export const STATUS_PUBLICO: Record<EventoStatus, { label: string; grad: string; dot: string }> = {
  sorteado:   { label: 'Sorteado',          grad: 'var(--grad-accent)', dot: 'var(--accent)' },
  parcial:    { label: 'Parcial',           grad: 'var(--grad-brand)',  dot: 'var(--info)' },
  pronto:     { label: 'Pronto p/ sorteio', grad: 'var(--grad-warn)',   dot: 'var(--warn)' },
  inscricoes: { label: 'Inscrições',        grad: 'var(--grad-brand)',  dot: 'var(--info)' },
  rascunho:   { label: 'Rascunho',          grad: 'var(--grad-warn)',   dot: 'var(--warn)' },
  suspenso:   { label: 'Suspenso',          grad: 'var(--grad-warn)',   dot: 'var(--warn)' },
}

export function statusPublico(s: string): { label: string; grad: string; dot: string } {
  return STATUS_PUBLICO[(s as EventoStatus)] ?? STATUS_PUBLICO.pronto
}

// ordem de exibição das pílulas de filtro
export const STATUS_ORDEM: EventoStatus[] = ['pronto', 'parcial', 'sorteado', 'inscricoes', 'rascunho', 'suspenso']
