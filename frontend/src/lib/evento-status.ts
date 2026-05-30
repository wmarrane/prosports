import type { EventoStatus } from '../types/evento'

export const STATUS_LABEL: Record<EventoStatus, string> = {
  rascunho: 'Rascunho',
  inscricoes: 'Inscrições',
  pronto: 'Pronto p/ sorteio',
  sorteado: 'Sorteado',
  parcial: 'Parcial',
}

export const STATUS_COLOR: Record<EventoStatus, string> = {
  rascunho: 'bg-[var(--card-bg-2)] text-[var(--t3)] border border-[var(--card-border)]',
  inscricoes: 'bg-[var(--info-soft)] text-[var(--info-700)] border border-[var(--info)]',
  pronto: 'bg-[var(--warn-soft)] text-[var(--warn-700)] border border-[var(--warn)]',
  sorteado: 'bg-[var(--success-soft)] text-[var(--success-700)] border border-[var(--success)]',
  parcial: 'bg-[var(--info-soft)] text-[var(--info-700)] border border-[var(--info)]',
}
