import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import EventoCardListagem from './components/EventoCardListagem'
import type { SnapEvento, SnapModalidade } from './snapshot-types'

function mod(over: Partial<SnapModalidade>): SnapModalidade {
  return { id: 1, nome: 'Judô', grupo: null, tipo: 'chaves', status: 'aguardando', seed: null, anfitriaoId: null, participantes: [], campeoes: [], cabecasPids: [], resultado: null, mensagens_inscritos: [], ...over }
}
function ev(mods: SnapModalidade[]): SnapEvento {
  return { id: 5, nome: '68º Jogos Regionais de Penápolis', competicao: 'Jogos Regionais', cidade: 'Penápolis', local: 'Ginásio', data: '2026-06-18T00:00:00.000Z', organizador: null, publicadoEm: '', dataInicio: null, dataFim: null, boletins: [], modalidades: mods }
}

it('aguardando quando nada foi sorteado', () => {
  const html = renderToStaticMarkup(<EventoCardListagem evento={ev([mod({ id: 1, participantes: [{ id: 1, nome: 'A', subtitulo: null }] })])} />)
  expect(html).toContain('data-status="aguardando"')
  expect(html).toContain('Aguardando sorteio')
  expect(html).toContain('var(--grad-warn)')
  expect(html).toContain('/evento-5.html')
  expect(html).toContain('Modalidades')
  expect(html).toContain('Inscritos')
  expect(html).toContain('Sorteios')
})

it('em andamento quando parte sorteada', () => {
  const html = renderToStaticMarkup(<EventoCardListagem evento={ev([mod({ id: 1, status: 'sorteado' }), mod({ id: 2, status: 'aguardando' })])} />)
  expect(html).toContain('data-status="andamento"')
  expect(html).toContain('Sorteios em andamento')
  expect(html).toContain('var(--grad-brand)')
})

it('sorteado quando 100% das sorteaveis', () => {
  const html = renderToStaticMarkup(<EventoCardListagem evento={ev([mod({ id: 1, status: 'sorteado' }), mod({ id: 2, status: 'sorteado' })])} />)
  expect(html).toContain('data-status="sorteado"')
  expect(html).toContain('var(--grad-accent)')
})
