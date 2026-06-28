import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import EventosPage from './pages/EventosPage'
import type { SnapEvento, SnapModalidade } from './snapshot-types'

function mod(over: Partial<SnapModalidade>): SnapModalidade {
  return { id: 1, nome: 'Judô', grupo: null, tipo: 'chaves', status: 'aguardando', seed: null, anfitriaoId: null, participantes: [], campeoes: [], cabecasPids: [], resultado: null, mensagens_inscritos: [], ...over }
}
function ev(id: number, status: 'sorteado' | 'aguardando'): SnapEvento {
  return { id, nome: `Evento ${id}`, competicao: 'Jogos', cidade: 'Cidade', local: 'Ginásio', data: '2026-06-18T00:00:00.000Z', organizador: null, publicadoEm: '', dataInicio: null, dataFim: null, boletins: [], modalidades: [mod({ id: 1, status, participantes: [{ id: 1, nome: 'A', subtitulo: null }] })] }
}

it('renderiza cabecalho de ano, filtro e grade', () => {
  const html = renderToStaticMarkup(<EventosPage eventos={[ev(1, 'aguardando'), ev(2, 'sorteado')]} />)
  expect(html).toContain('yr-head')
  expect(html).toContain('2026')
  expect(html).toContain('eventos ·')
  expect(html).toContain('ev-grid3')
  expect(html).toContain('data-filter="todos"')
  expect(html).toContain('data-filter="andamento"')
  expect(html).toContain('data-filter="aguardando"')
  expect(html).toContain('data-filter="sorteado"')
  expect(html).toContain('data-status="aguardando"')
  expect(html).toContain('data-status="sorteado"')
})

it('inclui o script de filtro escopado por grupo de ano', () => {
  const html = renderToStaticMarkup(<EventosPage eventos={[ev(1, 'aguardando')]} />)
  expect(html).toContain('.year-group')
  expect(html).toContain('addEventListener')
})
