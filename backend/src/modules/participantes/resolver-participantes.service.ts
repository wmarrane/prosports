import prisma from '../../lib/prisma'

export type ResolucaoParticipante = {
  municipio_id: number | null
  participante_id: number | null
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
