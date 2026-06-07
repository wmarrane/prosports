import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import EventoPage from './EventoPage'
import grupos from '../__fixtures__/evento-grupos.json'
import type { SnapEvento } from '../snapshot-types'

it('renderiza nome do evento, modalidade e seed', () => {
  const html = renderToStaticMarkup(<EventoPage evento={grupos as SnapEvento} />)
  expect(html).toContain('Jogos Regionais 2026')
  expect(html).toContain('Futsal Masculino')
  expect(html).toContain('DE5B-8022-5193-ED3B')
  expect(html).toContain('Tigres do Vale')
})
