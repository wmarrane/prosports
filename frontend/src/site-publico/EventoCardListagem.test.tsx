import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import EventoCardListagem from './components/EventoCardListagem'
import type { SnapEvento, SnapModalidade } from './snapshot-types'

function mod(over: Partial<SnapModalidade>): SnapModalidade {
  return { id: 1, nome: 'Judô', grupo: null, tipo: 'chaves', status: 'aguardando', seed: null, anfitriaoId: null, participantes: [], campeoes: [], cabecasPids: [], resultado: null, mensagens_inscritos: [], ...over }
}
function ev(mods: SnapModalidade[], status = 'pronto'): SnapEvento {
  return { id: 5, nome: '68º Jogos Regionais de Penápolis', competicao: 'Jogos Regionais', cidade: 'Penápolis', local: 'Ginásio', data: '2026-06-18T00:00:00.000Z', organizador: null, publicadoEm: '', dataInicio: null, dataFim: null, status, boletins: [], modalidades: mods }
}

it('status pronto → aguardando visual', () => {
  const html = renderToStaticMarkup(<EventoCardListagem evento={ev([mod({ id: 1, participantes: [{ id: 1, nome: 'A', subtitulo: null }] })], 'pronto')} />)
  expect(html).toContain('data-status="pronto"')
  expect(html).toContain('Pronto p/ sorteio')
  expect(html).toContain('var(--grad-warn)')
  expect(html).toContain('/evento-5.html')
  expect(html).toContain('class="zero"')
})
it('status parcial → andamento visual', () => {
  const html = renderToStaticMarkup(<EventoCardListagem evento={ev([mod({ id: 1, status: 'sorteado', participantes: [{ id: 1, nome: 'A', subtitulo: null }] })], 'parcial')} />)
  expect(html).toContain('data-status="parcial"')
  expect(html).toContain('Parcial')
  expect(html).toContain('var(--grad-brand)')
})
it('status sorteado → verde', () => {
  const html = renderToStaticMarkup(<EventoCardListagem evento={ev([mod({ id: 1, status: 'sorteado', participantes: [{ id: 1, nome: 'A', subtitulo: null }] })], 'sorteado')} />)
  expect(html).toContain('data-status="sorteado"')
  expect(html).toContain('Sorteado')
  expect(html).toContain('var(--grad-accent)')
  expect(html).toContain('class="hl"')
})
