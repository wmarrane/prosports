export type AlvoModalidade = { id: number; nome: string; sigla: string; competicao: string }
export type GrupoAlvos = { competicao: string; itens: AlvoModalidade[] }

type ModLike = {
  id: number
  nome: string
  sigla: string
  competicao?: { nome: string } | null
  tipo_modalidade: { tipo: string }
}

export function agruparAlvosPorCompeticao(
  modalidades: ModLike[],
  opts: { tipo: string; excluirId: number },
): GrupoAlvos[] {
  const alvos: AlvoModalidade[] = modalidades
    .filter(m => m.tipo_modalidade.tipo === opts.tipo && m.id !== opts.excluirId)
    .map(m => ({ id: m.id, nome: m.nome, sigla: m.sigla, competicao: m.competicao?.nome ?? '—' }))

  const byComp = new Map<string, AlvoModalidade[]>()
  for (const a of alvos) {
    const arr = byComp.get(a.competicao) ?? []
    arr.push(a)
    byComp.set(a.competicao, arr)
  }

  return Array.from(byComp.entries())
    .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
    .map(([competicao, itens]) => ({
      competicao,
      itens: itens.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR')),
    }))
}
