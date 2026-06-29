import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import EventoEsportesNav, { type SecaoNav } from './EventoEsportesNav'

const secoes: SecaoNav[] = [
  { key: 'Futsal', count: 3, tipo: 'grupos', sorteadas: 1 },
  { key: 'Judô', count: 2, tipo: 'chaves', sorteadas: 2 },
]

it('renderiza uma pill por seção com data-sport e contagem; primeira data-on', () => {
  const html = renderToStaticMarkup(<EventoEsportesNav secoes={secoes} />)
  expect(html).toContain('data-sport="Futsal" data-on="true"')
  expect(html).toContain('data-sport="Judô" data-on="false"')
  expect(html).toContain('class="pc">3<')
})

it('renderiza a régua de filtro com 3 botões (Todas data-on)', () => {
  const html = renderToStaticMarkup(<EventoEsportesNav secoes={secoes} />)
  expect(html).toContain('data-sf="all" data-on="true"')
  expect(html).toContain('data-sf="aberto"')
  expect(html).toContain('data-sf="sorteado"')
})

it('renderiza itens do sheet com mini-barra sorteadas/total', () => {
  const html = renderToStaticMarkup(<EventoEsportesNav secoes={secoes} />)
  expect(html).toContain('class="em-sheet-item"')
  expect(html).toContain('>2/2<')
})
