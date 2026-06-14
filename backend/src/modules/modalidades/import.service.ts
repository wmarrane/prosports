import prisma from '../../lib/prisma'
import { parseCsv } from '../municipios/csv-parser'

type Row = { nome: string; sigla: string; tipo_modalidade: string }
type Erro = { linha: number; motivo: string }
type Resumo = { criados: number; atualizados: number; ignorados: number; erros: Erro[] }

function normalize(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export async function importarCsv(competicao_id: number, content: string): Promise<Resumo> {
  const rows = parseCsv(content)
  if (rows.length > 5000) {
    throw Object.assign(new Error('Arquivo CSV excede o limite de 5000 linhas.'), { status: 400 })
  }
  if (rows.length === 0) {
    return { criados: 0, atualizados: 0, ignorados: 0, erros: [] }
  }

  // Verifica cabeçalho (aceita "nome", "sigla", "tipo_modalidade" case-insensitive)
  const actualHeaders = Object.keys(rows[0]).map(h => h.trim().toLowerCase())
  const required = ['nome', 'sigla', 'tipo_modalidade']
  const missing = required.filter(r => !actualHeaders.includes(r))
  if (missing.length > 0) {
    throw Object.assign(
      new Error(`Cabeçalho inválido. Coluna(s) obrigatória(s) ausente(s): ${missing.join(', ')}.`),
      { status: 400 }
    )
  }

  // Verifica competição existe
  const competicao = await prisma.competicao.findUnique({ where: { id: competicao_id }, select: { id: true } })
  if (!competicao) {
    throw Object.assign(new Error('Competição não encontrada.'), { status: 404 })
  }

  // Carrega lookup de TipoModalidade por nome normalizado
  const tipos = await prisma.tipoModalidade.findMany({ select: { id: true, nome: true } })
  const tipoByName = new Map(tipos.map(t => [normalize(t.nome), t.id]))

  // Carrega modalidades existentes na competição
  const existentes = await prisma.modalidade.findMany({
    where: { competicao_id },
    select: { id: true, nome: true, sigla: true, tipo_modalidade_id: true },
  })
  const existentesByNome = new Map(existentes.map(m => [normalize(m.nome), m]))
  const siglasOcupadas = new Map(existentes.map(m => [normalize(m.sigla), m.id]))

  const validas: { row: Row; linha: number; tipoId: number }[] = []
  const erros: Erro[] = []
  const nomesVistos = new Set<string>()
  const siglasVistas = new Map<string, number>()

  rows.forEach((raw, i) => {
    const linha = i + 2 // +1 header, +1 zero-based
    // Lookup case-insensitive by lowercased headers
    const lcRaw: Record<string, string> = {}
    for (const k of Object.keys(raw)) lcRaw[k.trim().toLowerCase()] = (raw[k] ?? '').trim()
    const nome = lcRaw['nome'] ?? ''
    const sigla = (lcRaw['sigla'] ?? '').toUpperCase()
    const tipo = lcRaw['tipo_modalidade'] ?? ''
    if (!nome) { erros.push({ linha, motivo: 'nome vazio' }); return }
    if (!sigla) { erros.push({ linha, motivo: 'sigla vazia' }); return }
    if (!tipo) { erros.push({ linha, motivo: 'tipo_modalidade vazio' }); return }
    const tipoId = tipoByName.get(normalize(tipo))
    if (!tipoId) {
      erros.push({ linha, motivo: `tipo_modalidade não encontrado: "${tipo}"` })
      return
    }
    const nomeNorm = normalize(nome)
    if (nomesVistos.has(nomeNorm)) {
      erros.push({ linha, motivo: `nome duplicado no CSV: "${nome}"` })
      return
    }
    nomesVistos.add(nomeNorm)
    const siglaNorm = normalize(sigla)
    if (siglasVistas.has(siglaNorm)) {
      erros.push({ linha, motivo: `sigla duplicada no CSV: "${sigla}"` })
      return
    }
    siglasVistas.set(siglaNorm, linha)

    // Verifica conflito de sigla com modalidade EXISTENTE de OUTRO nome
    const conflictId = siglasOcupadas.get(siglaNorm)
    const existentePorNome = existentesByNome.get(nomeNorm)
    if (conflictId !== undefined && conflictId !== existentePorNome?.id) {
      erros.push({ linha, motivo: `sigla "${sigla}" já está em uso por outra modalidade nesta competição` })
      return
    }

    validas.push({ row: { nome, sigla, tipo_modalidade: tipo }, linha, tipoId })
  })

  let criados = 0, atualizados = 0, ignorados = 0
  for (const v of validas) {
    const existente = existentesByNome.get(normalize(v.row.nome))
    if (existente) {
      if (existente.sigla !== v.row.sigla || existente.tipo_modalidade_id !== v.tipoId) {
        await prisma.modalidade.update({
          where: { id: existente.id },
          data: { sigla: v.row.sigla, tipo_modalidade_id: v.tipoId },
        })
        atualizados += 1
      } else {
        ignorados += 1
      }
    } else {
      await prisma.modalidade.create({
        data: {
          nome: v.row.nome,
          sigla: v.row.sigla,
          competicao_id,
          tipo_modalidade_id: v.tipoId,
        },
      })
      criados += 1
    }
  }

  return { criados, atualizados, ignorados, erros }
}
