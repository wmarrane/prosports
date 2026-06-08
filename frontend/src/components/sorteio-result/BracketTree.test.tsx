import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import BracketTree from './BracketTree'
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
