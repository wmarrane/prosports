import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import EventoPage from './pages/EventoPage'
import type { SnapEvento } from './snapshot-types'

const base: SnapEvento = {
  id: 1, nome: 'Ev', competicao: 'C', cidade: 'M', local: 'L',
  data: '2026-07-01T00:00:00.000Z', organizador: null, publicadoEm: '2026-07-01T00:00:00.000Z',
  dataInicio: '2026-07-01T00:00:00.000Z', dataFim: '2026-07-03T00:00:00.000Z',
  boletins: [
    { numero: 1, titulo: 'B1', categoria: 'Resultados', data: '2026-07-01T00:00:00.000Z', url: 'http://vm/1.pdf' },
    { numero: 2, titulo: 'B2', categoria: 'Comunicado', data: '2026-07-02T00:00:00.000Z', url: 'http://vm/2.pdf' },
  ],
  modalidades: [],
}

describe('EventoPage boletins', () => {
  it('renderiza a seção de boletins com link e categoria, mais recente primeiro', () => {
    const html = renderToStaticMarkup(<EventoPage evento={base} />)
    expect(html).toContain('Boletins')
    expect(html).toContain('http://vm/2.pdf')
    expect(html).toContain('Comunicado')
    // ordem desc por numero: B2 antes de B1
    expect(html.indexOf('http://vm/2.pdf')).toBeLessThan(html.indexOf('http://vm/1.pdf'))
  })
  it('omite a seção quando não há boletins', () => {
    const html = renderToStaticMarkup(<EventoPage evento={{ ...base, boletins: [] }} />)
    expect(html).not.toContain('id="boletins-evento"')
  })
})
