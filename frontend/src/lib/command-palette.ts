export type PaletteItem = { id: number; label: string; sublabel?: string; to: string }
export type PaletteResults = { eventos: PaletteItem[]; modalidades: PaletteItem[]; competicoes: PaletteItem[] }

export function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

const LIMIT = 6

type EventoLite = { id: number; nome: string }
type ModalidadeLite = { id: number; nome: string; sigla: string }
type CompeticaoLite = { id: number; nome: string }

export function filterEntities(
  query: string,
  data: { eventos: EventoLite[]; modalidades: ModalidadeLite[]; competicoes: CompeticaoLite[] },
): PaletteResults {
  const q = normalize(query)
  if (!q) return { eventos: [], modalidades: [], competicoes: [] }

  const eventos = data.eventos
    .filter(e => normalize(e.nome).includes(q))
    .slice(0, LIMIT)
    .map(e => ({ id: e.id, label: e.nome, to: `/eventos/${e.id}/inscricoes` }))

  const modalidades = data.modalidades
    .filter(m => normalize(m.nome).includes(q) || normalize(m.sigla).includes(q))
    .slice(0, LIMIT)
    .map(m => ({ id: m.id, label: m.nome, sublabel: m.sigla, to: `/modalidades/${m.id}/editar` }))

  const competicoes = data.competicoes
    .filter(c => normalize(c.nome).includes(q))
    .slice(0, LIMIT)
    .map(c => ({ id: c.id, label: c.nome, to: `/competicoes/${c.id}/editar` }))

  return { eventos, modalidades, competicoes }
}
