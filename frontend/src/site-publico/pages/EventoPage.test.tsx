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

import type { SnapEvento as _SnapEvento } from '../snapshot-types'

const multi = {
  id: 9, nome: 'Multi 2026', competicao: 'Liga', status: 'pronto', cidade: 'X', local: 'L',
  data: '2026-07-01T00:00:00.000Z', organizador: null, publicadoEm: '', dataInicio: null, dataFim: null,
  boletins: [], modalidades: [
    { id: 1, nome: 'Futsal Masculino', grupo: null, tipo: 'grupos', status: 'sorteado', seed: null, anfitriaoId: null, cabecasPids: [], campeoes: [], participantes: [{ id: 1, nome: 'A', subtitulo: null }], mensagens_inscritos: [], resultado: null },
    { id: 2, nome: 'Judô Feminino', grupo: null, tipo: 'chaves', status: 'inscricoes', seed: null, anfitriaoId: null, cabecasPids: [], campeoes: [], participantes: [{ id: 2, nome: 'B', subtitulo: null }], mensagens_inscritos: [], resultado: null },
  ],
} as unknown as _SnapEvento

it('mobile nav: cat-section com data-sport e a 1ª data-on=true', () => {
  const html = renderToStaticMarkup(<EventoPage evento={multi} />)
  expect(html).toContain('cat-section" data-sport="Futsal" data-on="true"')
  expect(html).toContain('data-sport="Judô" data-on="false"')
})

it('mobile nav: mod-acc com data-mstatus coerente e main com data-status-filter', () => {
  const html = renderToStaticMarkup(<EventoPage evento={multi} />)
  expect(html).toContain('data-status-filter="all"')
  expect(html).toContain('data-mstatus="sorteado"')
  expect(html).toContain('data-mstatus="aberto"')
})

it('mobile nav: renderiza EventoEsportesNav e o script de navegação', () => {
  const html = renderToStaticMarkup(<EventoPage evento={multi} />)
  expect(html).toContain('class="em-catbar"')
  expect(html).toContain('setSport')
})

it('hero sem botão compartilhar (removido); título permanece', () => {
  const html = renderToStaticMarkup(<EventoPage evento={multi} />)
  expect(html).toContain('Multi 2026')
  expect(html).not.toContain('Compartilhar evento')
})
