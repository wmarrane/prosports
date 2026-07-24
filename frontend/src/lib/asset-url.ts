/**
 * Resolve a URL de um asset servido pelo backend em `/uploads/...` (ex.: logo do evento).
 *
 * Em produção o admin roda em outra origem (Firebase) que não serve `/uploads`; um
 * `src="/uploads/..."` resolveria contra o domínio do front e cairia no rewrite da SPA.
 * Quando a `VITE_API_URL` é absoluta (prod), prefixamos com a origem da API. Em dev
 * (mesma origem / base relativa) mantemos o caminho relativo. Valores já absolutos
 * (`http(s)://`, `blob:`, `data:`) passam direto.
 */
export function assetUrl(
  path?: string | null,
  apiBase: string | undefined = import.meta.env.VITE_API_URL as string | undefined,
): string | undefined {
  if (!path) return undefined
  if (!path.startsWith('/')) return path
  if (apiBase && /^https?:\/\//.test(apiBase)) {
    return `${apiBase.replace(/\/+$/, '')}${path}`
  }
  return path
}
