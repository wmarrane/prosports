import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import BracketView from './BracketView'
import type { SnapModalidade } from '../snapshot-types'

const mod: SnapModalidade = {
  id: 7, nome: 'Judô Feminino Livre', grupo: null, tipo: 'chaves', status: 'sorteado', seed: 'AB',
  anfitriaoId: null, cabecasPids: [10], campeoes: [], resultado: {
    size: 4, slots: [10, 20, 30, 40], byePositions: [1],
    matchesGraph: { final: 'J3', thirdPlace: null, matches: [
      { id: 'J1', round: 1, top: 'P2', bottom: 'P3' },
      { id: 'B1', round: 1, top: 'P1', bottom: 'BYE' },
      { id: 'J3', round: 2, top: 'V:B1', bottom: 'V:J1' },
    ] },
  },
  participantes: [
    { id: 10, nome: 'Ana', subtitulo: null }, { id: 20, nome: 'Bia', subtitulo: null },
    { id: 30, nome: 'Cris', subtitulo: null }, { id: 40, nome: 'Dani', subtitulo: null },
  ],
  mensagens_inscritos: [],
} as any

it('renderiza overlay com as duas visões, resolve nomes e rótulos, e abas por rodada', () => {
  const html = renderToStaticMarkup(<BracketView modalidade={mod} />)
  expect(html).toContain('id="bracket-7"')
  expect(html).toContain('em-vtog')          // alternância de visão
  expect(html).toContain('Por fase')
  expect(html).toContain('Chaveamento')
  expect(html).toContain('Bia')              // P2 → slots[1]=20 → Bia
  expect(html).toContain('Vencedor J1')      // V:J1
  expect(html).toContain('Final')            // rótulo da rodada/jogo final
  expect(html).toContain('em-byes')          // chips de byes (P1=Ana via bye)
  expect(html).not.toContain('em-champ')     // sem faixa de campeão
})
