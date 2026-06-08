import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import BracketTree, { computeLayout } from './BracketTree'
import type { Participante } from '../../types/participante'

const participantesById = new Map<number, Participante>([
  [10, { id: 10, nome: 'Fulano', subtitulo: null } as any],
  [20, { id: 20, nome: 'Beltrano', subtitulo: null } as any],
  [30, { id: 30, nome: 'Sicrano', subtitulo: null } as any],
])

// Grafo V2: B1 = P1 (slot 0 = Fulano) vs BYE; J1 = P2 vs P3; J2 = V:B1 vs V:J1
const graphV2 = {
  matches: [
    { id: 'J1', top: 'P2', bottom: 'P3', round: 1 },
    { id: 'B1', top: 'P1', bottom: 'BYE', round: 1 },
    { id: 'J2', top: 'V:B1', bottom: 'V:J1', round: 2 },
  ],
  final: 'J2',
  thirdPlace: null,
}

describe('BracketTree (V2)', () => {
  it('renderiza o rótulo BYE e o nome do participante do stub', () => {
    const html = renderToStaticMarkup(
      <BracketTree matchesGraph={graphV2} slots={[10, 20, 30]} participantesById={participantesById} />
    )
    expect(html).toContain('BYE')
    expect(html).toContain('Fulano')
  })

  it('resolve V:B1 para o nome (sem "Vencedor B1") e oculta o id do stub', () => {
    const html = renderToStaticMarkup(
      <BracketTree matchesGraph={graphV2} slots={[10, 20, 30]} participantesById={participantesById} />
    )
    expect(html).not.toContain('B1')
    expect(html).toContain('J1')
    expect(html).toContain('Vencedor J1')
  })
})

describe('computeLayout — ordem da 1ª rodada (V2)', () => {
  it('o stub de BYE fica ABAIXO do jogo anterior (pela posição), não no topo', () => {
    const g = {
      matches: [
        { id: 'J1', top: 'P3', bottom: 'P4', round: 1 },
        { id: 'B1', top: 'P5', bottom: 'BYE', round: 1 },
        { id: 'J2', top: 'V:J1', bottom: 'V:B1', round: 2 },
      ],
      final: 'J2', thirdPlace: null,
    }
    const layout = computeLayout(g, 5)
    const r1 = layout.matches.filter(m => m.round === 1).sort((a, b) => a.y - b.y).map(m => m.id)
    // J1 (posições 3-4) acima do stub B1 (posição 5)
    expect(r1).toEqual(['J1', 'B1'])
  })

  it('N=22 (Judô Feminino Livre): 1ª rodada segue a ordem de posição da planilha CHAVES CT', () => {
    // Grafo V2 = transform do grafo V1 de N=22 (byes P1,P6,P11,P12,P17,P22 elevados p/ B1..B6)
    const g = {
      matches: [
        { id: 'J1', top: 'P2', bottom: 'P3', round: 1 },
        { id: 'J2', top: 'P7', bottom: 'P8', round: 1 },
        { id: 'J3', top: 'P9', bottom: 'P10', round: 1 },
        { id: 'J4', top: 'P13', bottom: 'P14', round: 1 },
        { id: 'J5', top: 'P18', bottom: 'P19', round: 1 },
        { id: 'J6', top: 'P20', bottom: 'P21', round: 1 },
        { id: 'J8', top: 'P4', bottom: 'P5', round: 1 },
        { id: 'J12', top: 'P15', bottom: 'P16', round: 1 },
        { id: 'B1', top: 'P1', bottom: 'BYE', round: 1 },
        { id: 'B2', top: 'P6', bottom: 'BYE', round: 1 },
        { id: 'B3', top: 'P11', bottom: 'BYE', round: 1 },
        { id: 'B4', top: 'P12', bottom: 'BYE', round: 1 },
        { id: 'B5', top: 'P17', bottom: 'BYE', round: 1 },
        { id: 'B6', top: 'P22', bottom: 'BYE', round: 1 },
        { id: 'J7', top: 'V:B1', bottom: 'V:J1', round: 2 },
        { id: 'J9', top: 'V:B2', bottom: 'V:J2', round: 2 },
        { id: 'J10', top: 'V:J3', bottom: 'V:B3', round: 2 },
        { id: 'J11', top: 'V:B4', bottom: 'V:J4', round: 2 },
        { id: 'J13', top: 'V:B5', bottom: 'V:J5', round: 2 },
        { id: 'J14', top: 'V:J6', bottom: 'V:B6', round: 2 },
        { id: 'J15', top: 'V:J7', bottom: 'V:J8', round: 3 },
        { id: 'J16', top: 'V:J9', bottom: 'V:J10', round: 3 },
        { id: 'J17', top: 'V:J11', bottom: 'V:J12', round: 3 },
        { id: 'J18', top: 'V:J13', bottom: 'V:J14', round: 3 },
        { id: 'J20', top: 'V:J17', bottom: 'V:J18', round: 4 },
        { id: 'J21', top: 'V:J15', bottom: 'V:J16', round: 4 },
        { id: 'J22', top: 'V:J21', bottom: 'V:J20', round: 5 },
        { id: 'J19', top: 'L:J21', bottom: 'L:J20', round: 5 },
      ],
      final: 'J22', thirdPlace: 'J19',
    }
    const layout = computeLayout(g, 22)
    const r1 = layout.matches.filter(m => m.round === 1).sort((a, b) => a.y - b.y).map(m => m.id)
    expect(r1).toEqual([
      'B1', 'J1', 'J8', 'B2', 'J2', 'J3', 'B3', 'B4', 'J4', 'J12', 'B5', 'J5', 'J6', 'B6',
    ])
    // Conferência dos pedidos do usuário:
    const idx = (id: string) => r1.indexOf(id)
    expect(idx('B2')).toBe(idx('J8') + 1)  // Alfredo Marcondes (P6) abaixo do J8
    expect(idx('B3')).toBe(idx('J3') + 1)  // Campinas (P11) abaixo do J3
    expect(idx('B4')).toBe(idx('B3') + 1)  // Adolfo (P12) abaixo de Campinas
    expect(idx('B6')).toBe(idx('J6') + 1)  // Aguaí (P22) abaixo do J6
  })
})
