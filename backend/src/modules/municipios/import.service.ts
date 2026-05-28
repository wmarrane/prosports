import prisma from '../../lib/prisma'
import { parseCsv } from './csv-parser'
import { normalizarUf } from './uf'

const BATCH_SIZE = 500

type Row = { codigo_ibge: string; nome: string; uf: string }
type Erro = { linha: number; motivo: string }
type Resumo = { criados: number; atualizados: number; ignorados: number; erros: Erro[] }

const HEADER_ALIASES: Record<keyof Row, string[]> = {
  codigo_ibge: ['codigoibge', 'codigomunicipiocompleto'],
  nome: ['nomemunicipio', 'nome'],
  uf: ['uf', 'nomeuf', 'siglauf'],
}

function normalizeHeader(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s_]+/g, '')
}

function buildHeaderMap(actualHeaders: string[]): Record<keyof Row, string> | null {
  const norm = actualHeaders.map(normalizeHeader)
  const map: Partial<Record<keyof Row, string>> = {}
  for (const field of Object.keys(HEADER_ALIASES) as (keyof Row)[]) {
    const aliases = HEADER_ALIASES[field]
    const idx = norm.findIndex((h) => aliases.includes(h))
    if (idx === -1) return null
    map[field] = actualHeaders[idx]
  }
  return map as Record<keyof Row, string>
}

export async function importarCsv(content: string): Promise<Resumo> {
  const rows = parseCsv(content)
  if (rows.length === 0) {
    return { criados: 0, atualizados: 0, ignorados: 0, erros: [] }
  }
  const actualHeaders = Object.keys(rows[0])
  const headerMap = buildHeaderMap(actualHeaders)
  if (!headerMap) {
    throw Object.assign(
      new Error('Cabeçalho inválido. Esperado colunas para código IBGE, nome do município e UF.'),
      { status: 400 }
    )
  }

  const validas: Row[] = []
  const erros: Erro[] = []
  rows.forEach((raw, i) => {
    const linha = i + 2 // +1 header, +1 zero-based
    const codigo = (raw[headerMap.codigo_ibge] ?? '').trim()
    const nome = (raw[headerMap.nome] ?? '').trim()
    const ufRaw = (raw[headerMap.uf] ?? '').trim()
    if (!/^\d{7}$/.test(codigo)) {
      erros.push({ linha, motivo: 'codigo_ibge inválido (esperado 7 dígitos)' }); return
    }
    if (!nome) { erros.push({ linha, motivo: 'nome vazio' }); return }
    const uf = normalizarUf(ufRaw)
    if (!uf) { erros.push({ linha, motivo: `UF inválida: "${ufRaw}"` }); return }
    validas.push({ codigo_ibge: codigo, nome, uf })
  })

  const codigos = validas.map((r) => r.codigo_ibge)
  const existentes = codigos.length > 0
    ? await prisma.municipio.findMany({ where: { codigo_ibge: { in: codigos } } })
    : []
  const existentesByCodigo = new Map(existentes.map((m) => [m.codigo_ibge, m]))

  const novos: Row[] = []
  const updates: { id: number; data: Pick<Row, 'nome' | 'uf'> }[] = []
  for (const r of validas) {
    const ex = existentesByCodigo.get(r.codigo_ibge)
    if (ex) {
      if (ex.nome !== r.nome || ex.uf !== r.uf) {
        updates.push({ id: ex.id, data: { nome: r.nome, uf: r.uf } })
      }
    } else {
      novos.push(r)
    }
  }

  let criados = 0
  for (let i = 0; i < novos.length; i += BATCH_SIZE) {
    const batch = novos.slice(i, i + BATCH_SIZE)
    const res = await prisma.municipio.createMany({ data: batch, skipDuplicates: true })
    criados += res.count
  }

  let atualizados = 0
  for (const u of updates) {
    await prisma.municipio.update({ where: { id: u.id }, data: u.data })
    atualizados += 1
  }

  const ignorados = existentes.length - updates.length

  return { criados, atualizados, ignorados, erros }
}
