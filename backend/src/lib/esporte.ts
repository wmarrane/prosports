export function esporteBase(nome: string): string {
  const i = nome.indexOf('·')
  return (i > 0 ? nome.slice(0, i) : nome.split(' ')[0]).trim()
}
