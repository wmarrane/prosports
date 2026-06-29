export type RefResolvido = { pid: number | null; nome: string | null; label: string | null; seed: number | null }

export function resolveRef(ref: string, slots: (number | null)[], nomePorId: Map<number, string>): RefResolvido {
  if (ref === 'BYE') return { pid: null, nome: null, label: 'BYE', seed: null }
  if (ref.startsWith('V:')) return { pid: null, nome: null, label: `Vencedor ${ref.slice(2)}`, seed: null }
  if (ref.startsWith('L:')) return { pid: null, nome: null, label: `Perdedor ${ref.slice(2)}`, seed: null }
  if (ref.startsWith('P')) {
    const pos = Number(ref.slice(1))
    const pid = Number.isFinite(pos) ? (slots[pos - 1] ?? null) : null
    const nome = pid != null ? (nomePorId.get(pid) ?? null) : null
    return { pid, nome, label: pid != null ? null : '—', seed: Number.isFinite(pos) ? pos : null }
  }
  return { pid: null, nome: null, label: ref, seed: null }
}
