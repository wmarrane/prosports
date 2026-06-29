export type EventoStatus = 'rascunho' | 'inscricoes' | 'pronto' | 'sorteado' | 'parcial' | 'suspenso'

const PUBLICAVEIS: EventoStatus[] = ['pronto', 'parcial', 'sorteado']

/**
 * Decide a ação no site público a partir da transição de status.
 * - vira pronto/parcial/sorteado  -> 'publicar'
 * - vira rascunho/inscricoes/suspenso -> 'despublicar' (só se já publicado)
 * - status ausente ou inalterado  -> null
 */
export function decidirAcaoPublicacao(
  statusAntes: EventoStatus | undefined,
  statusDepois: EventoStatus | undefined,
  publicado: boolean,
): 'publicar' | 'despublicar' | null {
  if (!statusDepois || statusDepois === statusAntes) return null
  if (PUBLICAVEIS.includes(statusDepois)) return 'publicar'
  return publicado ? 'despublicar' : null
}
