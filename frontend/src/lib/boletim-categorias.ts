export type CategoriaBoletimValor =
  | 'Oficial' | 'Regulamento' | 'Resultados' | 'Convocacao' | 'ComunicadoErrata'

export type CategoriaInfo = {
  value: CategoriaBoletimValor
  label: string
  grupo: string
  badgeClass: string
  swatch: string
}

export const CATEGORIAS_BOLETIM: CategoriaInfo[] = [
  { value: 'Oficial',          label: 'Oficial',              grupo: 'Oficiais',    badgeClass: 'b-brand',   swatch: 'var(--brand-500)' },
  { value: 'Regulamento',      label: 'Regulamento',          grupo: 'Regulamento', badgeClass: 'b-violet',  swatch: '#8b5cf6' },
  { value: 'Resultados',       label: 'Resultados',           grupo: 'Resultados',  badgeClass: 'b-success', swatch: 'var(--accent)' },
  { value: 'Convocacao',       label: 'Convocação',           grupo: 'Convocação',  badgeClass: 'b-warn',    swatch: 'var(--warn)' },
  { value: 'ComunicadoErrata', label: 'Comunicado / Errata',  grupo: 'Comunicados', badgeClass: 'b-neutral', swatch: 'var(--t4)' },
]

export function categoriaInfo(v: string): CategoriaInfo {
  return CATEGORIAS_BOLETIM.find((c) => c.value === v) ?? CATEGORIAS_BOLETIM[0]
}

export function formatBytes(n: number): string {
  if (!n || n < 1024) return `${n || 0} B`
  const kb = n / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  return `${(kb / 1024).toFixed(1).replace('.', ',')} MB`
}

export function dataPtBr(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}
