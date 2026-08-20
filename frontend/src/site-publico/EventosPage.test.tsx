import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import EventosPage from './pages/EventosPage'
import type { SnapEvento, SnapModalidade } from './snapshot-types'

function mod(over: Partial<SnapModalidade>): SnapModalidade {
  return { id: 1, nome: 'Judô', grupo: null, tipo: 'chaves', status: 'aguardando', seed: null, anfitriaoId: null, participantes: [], campeoes: [], cabecasPids: [], resultado: null, mensagens_inscritos: [], ...over }
}
function ev(over: Partial<SnapEvento> & { id: number }): SnapEvento {
  return {
    nome: `Evento ${over.id}`, competicao: 'Jogos Regionais', cidade: 'Cidade', local: 'Ginásio',
    data: '2026-06-18T00:00:00.000Z', organizador: null, publicadoEm: '', dataInicio: null, dataFim: null,
    status: 'sorteado', boletins: [],
    modalidades: [mod({ id: 1, status: 'sorteado', participantes: [{ id: 1, nome: 'A', subtitulo: null }] })],
    ...over,
  } as any
}

it('agrupa por competição, não por ano', () => {
  const html = renderToStaticMarkup(<EventosPage eventos={[
    ev({ id: 1, competicao: 'Jogos Regionais' }),
    ev({ id: 2, competicao: 'JEESP' }),
  ]} />)
  expect(html).toContain('data-competicao="Jogos Regionais"')
  expect(html).toContain('data-competicao="JEESP"')
  expect(html).toContain('ev-grid3')
})

it('ordena os blocos pelo evento mais recente de cada competição', () => {
  const html = renderToStaticMarkup(<EventosPage eventos={[
    ev({ id: 1, competicao: 'Regionais', data: '2026-06-15T00:00:00.000Z' }),
    ev({ id: 2, competicao: 'JEESP', data: '2026-08-14T00:00:00.000Z' }),
  ]} />)
  // JEESP é de agosto: precisa vir antes do bloco de junho.
  expect(html.indexOf('data-competicao="JEESP"')).toBeLessThan(html.indexOf('data-competicao="Regionais"'))
})

it('conta eventos e inscritos por competição no cabeçalho', () => {
  const doisInscritos = [mod({ id: 1, participantes: [{ id: 1, nome: 'A', subtitulo: null }, { id: 2, nome: 'B', subtitulo: null }] as any })]
  const html = renderToStaticMarkup(<EventosPage eventos={[
    ev({ id: 1, competicao: 'JEESP', modalidades: doisInscritos as any }),
    ev({ id: 2, competicao: 'JEESP', modalidades: doisInscritos as any }),
  ]} />)
  expect(html).toContain('<b>2</b> eventos')
  expect(html).toContain('<b>4</b> inscritos')
})

it('usa singular quando a competição tem um evento só', () => {
  const html = renderToStaticMarkup(<EventosPage eventos={[ev({ id: 1, competicao: 'Melhor Idade' })]} />)
  expect(html).toContain('<b>1</b> evento ·')
})

it('esconde o filtro de ano quando só existe um ano publicado', () => {
  const html = renderToStaticMarkup(<EventosPage eventos={[
    ev({ id: 1, data: '2026-06-15T00:00:00.000Z' }),
    ev({ id: 2, data: '2026-08-14T00:00:00.000Z' }),
  ]} />)
  // A string aparece dentro do script inline; o que importa é a barra existir.
  expect(html).not.toContain('<div class="yr-filter" data-grupo="ano">')
})

it('mostra o filtro de ano quando há mais de um ano', () => {
  const html = renderToStaticMarkup(<EventosPage eventos={[
    ev({ id: 1, data: '2025-06-15T00:00:00.000Z' }),
    ev({ id: 2, data: '2026-08-14T00:00:00.000Z' }),
  ]} />)
  expect(html).toContain('<div class="yr-filter" data-grupo="ano">')
  expect(html).toContain('data-ano="2026"')
  expect(html).toContain('data-ano="2025"')
})

it('esconde o filtro de status quando todos os eventos têm o mesmo status', () => {
  const html = renderToStaticMarkup(<EventosPage eventos={[ev({ id: 1 }), ev({ id: 2 })]} />)
  expect(html).not.toContain('<div class="yr-filter" data-grupo="status">')
})

it('mostra o filtro de status quando há mais de um', () => {
  const html = renderToStaticMarkup(<EventosPage eventos={[ev({ id: 1, status: 'pronto' }), ev({ id: 2, status: 'sorteado' })]} />)
  expect(html).toContain('<div class="yr-filter" data-grupo="status">')
  expect(html).toContain('data-filter="pronto"')
  expect(html).toContain('data-filter="sorteado"')
})

it('cada card carrega ano, status e chave de busca sem acento', () => {
  const html = renderToStaticMarkup(<EventosPage eventos={[
    ev({ id: 1, nome: 'Jogos de Penápolis', cidade: 'São Paulo', data: '2026-06-15T00:00:00.000Z' }),
  ]} />)
  expect(html).toContain('data-ano="2026"')
  expect(html).toContain('data-status="sorteado"')
  expect(html).toContain('data-busca="jogos de penapolis sao paulo"')
})

it('traz a busca e o aviso de lista vazia', () => {
  const html = renderToStaticMarkup(<EventosPage eventos={[ev({ id: 1 })]} />)
  expect(html).toContain('id="ev-busca"')
  expect(html).toContain('Nenhum evento encontrado')
  expect(html).toContain('addEventListener')
})
