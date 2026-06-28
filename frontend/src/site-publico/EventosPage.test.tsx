import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import EventosPage from './pages/EventosPage'
import type { SnapEvento, SnapModalidade } from './snapshot-types'

function mod(over: Partial<SnapModalidade>): SnapModalidade {
  return { id: 1, nome: 'Judô', grupo: null, tipo: 'chaves', status: 'aguardando', seed: null, anfitriaoId: null, participantes: [], campeoes: [], cabecasPids: [], resultado: null, mensagens_inscritos: [], ...over }
}
function ev(id: number, statusEvento: string): SnapEvento {
  return { id, nome: `Evento ${id}`, competicao: 'Jogos', cidade: 'Cidade', local: 'Ginásio', data: '2026-06-18T00:00:00.000Z', organizador: null, publicadoEm: '', dataInicio: null, dataFim: null, status: statusEvento, boletins: [], modalidades: [mod({ id: 1, status: 'sorteado', participantes: [{ id: 1, nome: 'A', subtitulo: null }] })] } as any
}

it('renderiza cabecalho de ano, filtro por status e grade', () => {
  const html = renderToStaticMarkup(<EventosPage eventos={[ev(1, 'pronto'), ev(2, 'sorteado')]} />)
  expect(html).toContain('yr-head')
  expect(html).toContain('ev-grid3')
  expect(html).toContain('data-filter="todos"')
  expect(html).toContain('data-filter="pronto"')
  expect(html).toContain('data-filter="sorteado"')
  expect(html).toContain('data-status="pronto"')
  expect(html).toContain('data-status="sorteado"')
})

it('inclui o script de filtro escopado por grupo de ano', () => {
  const html = renderToStaticMarkup(<EventosPage eventos={[ev(1, 'pronto')]} />)
  expect(html).toContain('.year-group')
  expect(html).toContain('addEventListener')
})
