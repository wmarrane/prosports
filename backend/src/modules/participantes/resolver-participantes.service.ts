import prisma from '../../lib/prisma'

export type ResolucaoParticipante = {
  municipio_id: number | null
  participante_id: number | null
}

export type ResolucaoEscolar = {
  municipio_id: number | null
  ambiguo_municipio: boolean
  participante_id: number | null  // null = não existe (deve ser criado)
}

// Resolve município por NOME dentro dos estados da competição e participante por NOME.
// Nunca cria; a criação é decidida por importar() (respeita dry_run).
export async function resolverEscolar(
  rows: { nome: string; municipio_nome: string }[],
  estados: string[],
): Promise<ResolucaoEscolar[]> {
  const municipios = estados.length > 0
    ? await prisma.municipio.findMany({ where: { uf: { in: estados } }, select: { id: true, nome: true } })
    : []
  const munByNome = new Map<string, number[]>()
  for (const m of municipios) {
    const k = m.nome.toLowerCase()
    munByNome.set(k, [...(munByNome.get(k) ?? []), m.id])
  }
  const nomes = Array.from(new Set(rows.map(r => r.nome.trim().toLowerCase())))
  const participantes = nomes.length > 0
    ? await prisma.participante.findMany({ select: { id: true, nome: true } })
    : []
  const partByNome = new Map<string, number>()
  for (const p of participantes) partByNome.set(p.nome.trim().toLowerCase(), p.id)

  return rows.map(r => {
    const ids = munByNome.get(r.municipio_nome.trim().toLowerCase()) ?? []
    const municipio_id = ids.length === 1 ? ids[0] : null
    return {
      municipio_id,
      ambiguo_municipio: ids.length > 1,
      participante_id: partByNome.get(r.nome.trim().toLowerCase()) ?? null,
    }
  })
}

type RowLite = { nome: string; municipio_uf: string; municipio_nome: string }

// Resolve cada linha para o município e o participante EXISTENTES.
// Nunca cria nada. municipio_id null = município não encontrado;
// participante_id null = participante não cadastrado (mesmo com município ok).
export async function resolverParticipantes(rows: RowLite[]): Promise<ResolucaoParticipante[]> {
  const ufs = Array.from(new Set(rows.map(r => r.municipio_uf.trim().toUpperCase())))
  const municipios = ufs.length > 0
    ? await prisma.municipio.findMany({
        where: { uf: { in: ufs } },
        select: { id: true, nome: true, uf: true },
      })
    : []
  const municipioByKey = new Map<string, number>()
  for (const m of municipios) {
    municipioByKey.set(`${m.uf.toUpperCase()}:${m.nome.toLowerCase()}`, m.id)
  }

  const municipioIds = municipios.map(m => m.id)
  const participantes = municipioIds.length > 0
    ? await prisma.participante.findMany({
        where: { municipio_id: { in: municipioIds } },
        select: { id: true, nome: true, municipio_id: true },
      })
    : []
  const participanteByKey = new Map<string, number>()
  for (const p of participantes) {
    participanteByKey.set(`${p.municipio_id}:${p.nome.toLowerCase()}`, p.id)
  }

  return rows.map(r => {
    const uf = r.municipio_uf.trim().toUpperCase()
    const munNome = r.municipio_nome.trim().toLowerCase()
    const municipio_id = municipioByKey.get(`${uf}:${munNome}`) ?? null
    if (municipio_id == null) return { municipio_id: null, participante_id: null }
    const participante_id = participanteByKey.get(`${municipio_id}:${r.nome.trim().toLowerCase()}`) ?? null
    return { municipio_id, participante_id }
  })
}
