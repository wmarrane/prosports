import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import EventoPage from './pages/EventoPage'
import type { SnapEvento } from './snapshot-types'

const base: SnapEvento = {
  id: 1, nome: 'Ev', competicao: 'C', cidade: 'M', local: 'L',
  data: '2026-07-01T00:00:00.000Z', organizador: null, publicadoEm: '2026-07-01T00:00:00.000Z',
  dataInicio: '2026-07-01T00:00:00.000Z', dataFim: '2026-07-03T00:00:00.000Z',
  boletins: [
    { numero: 1, titulo: 'Abertura', categoria: 'Oficial', data: '2026-07-01T00:00:00.000Z', url: 'http://vm/1.pdf', tamanho: 2516582, atualizadoEm: '2026-07-05T12:00:00.000Z' },
    { numero: 2, titulo: 'Resultados R1', categoria: 'Resultados', data: '2026-07-02T00:00:00.000Z', url: 'http://vm/2.pdf', tamanho: 1258291, atualizadoEm: '2026-07-03T09:00:00.000Z' },
  ],
  modalidades: [],
}

describe('EventoPage boletins (reskin)', () => {
  it('destaque usa atualizadoEm (mais recente), não a data nem o número', () => {
    const html = renderToStaticMarkup(<EventoPage evento={base} />)
    expect(html).toContain('doc-feature')
    const featureIdx = html.indexOf('doc-feature')
    // o destaque (numero 1, Oficial) deve aparecer e seu url no bloco do destaque
    expect(html).toContain('http://vm/1.pdf')
    expect(html.slice(featureIdx, featureIdx + 800)).toContain('Abertura')
  })
  it('omite a seção quando não há boletins', () => {
    const html = renderToStaticMarkup(<EventoPage evento={{ ...base, boletins: [] }} />)
    expect(html).not.toContain('id="boletins-evento"')
  })
})
