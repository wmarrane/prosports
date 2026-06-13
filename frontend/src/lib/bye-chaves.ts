export function isByeRef(ref: string, slots: (number | null)[]): boolean {
  if (ref === 'BYE') return true
  if (ref.startsWith('P')) {
    const pos = parseInt(ref.slice(1), 10)
    if (!Number.isFinite(pos)) return false
    return (slots[pos - 1] ?? null) === null
  }
  return false
}

export function matchIsBye(
  match: { top: string; bottom: string },
  slots: (number | null)[],
): boolean {
  return isByeRef(match.top, slots) || isByeRef(match.bottom, slots)
}
