import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import EventoPage from './pages/EventoPage'
import type { SnapEvento } from './snapshot-types'

const base: SnapEvento = {
  id: 1, nome: 'Ev', competicao: 'C', cidade: 'M', local: 'L',
  data: '2026-07-01T00:00:00.000Z', organizador: null, publicadoEm: '2026-07-01T00:00:00.000Z',
  dataInicio: '2026-07-01T00:00:00.000Z', dataFim: '2026-07-03T00:00:00.000Z',
  boletins: [
    { numero: 1, titulo: 'Abertura', categoria: 'Oficial', data: '2026-07-01T00:00:00.000Z', url: 'http://vm/1.pdf', tamanho: 2516582 },
    { numero: 2, titulo: 'Resultados R1', categoria: 'Resultados', data: '2026-07-02T00:00:00.000Z', url: 'http://vm/2.pdf', tamanho: 1258291 },
  ],
  modalidades: [],
}

describe('EventoPage boletins (reskin)', () => {
  it('mostra a seção, destaque (mais recente) e badges de tipo', () => {
    const html = renderToStaticMarkup(<EventoPage evento={base} />)
    expect(html).toContain('Boletins')
    expect(html).toContain('doc-feature')
    expect(html).toContain('http://vm/2.pdf') // destaque = numero 2 (data maior)
    expect(html).toContain('Resultados')
    expect(html).toContain('Oficial')
  })
  it('omite a seção quando não há boletins', () => {
    const html = renderToStaticMarkup(<EventoPage evento={{ ...base, boletins: [] }} />)
    expect(html).not.toContain('id="boletins-evento"')
  })
})
