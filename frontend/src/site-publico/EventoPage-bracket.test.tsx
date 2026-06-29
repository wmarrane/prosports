import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import EventoPage from './pages/EventoPage'
import type { SnapEvento, SnapModalidade } from './snapshot-types'

function modChaves(over: Partial<SnapModalidade> = {}): SnapModalidade {
  return { id: 7, nome: 'Judô', grupo: null, tipo: 'chaves', status: 'sorteado', seed: null, anfitriaoId: null,
    cabecasPids: [], campeoes: [], participantes: [{ id: 1, nome: 'A', subtitulo: null }, { id: 2, nome: 'B', subtitulo: null }],
    mensagens_inscritos: [], resultado: { size: 2, slots: [1, 2], byePositions: [],
      matchesGraph: { final: 'J1', thirdPlace: null, matches: [{ id: 'J1', round: 1, top: 'P1', bottom: 'P2' }] } }, ...over } as any
}
const base = (mods: SnapModalidade[]): SnapEvento => ({ id: 3, nome: 'E', competicao: 'C', status: 'sorteado',
  cidade: 'X', local: 'L', data: '2026-06-18T00:00:00.000Z', organizador: null, publicadoEm: '', dataInicio: null, dataFim: null,
  boletins: [], modalidades: mods } as any)

it('mostra "Ver chave" e o overlay para chaves+sorteado com matchesGraph', () => {
  const html = renderToStaticMarkup(<EventoPage evento={base([modChaves()])} />)
  expect(html).toContain('Ver chave')
  expect(html).toContain('id="bracket-7"')
  expect(html).toContain('data-bracket="7"') // botão de abrir
})
it('não mostra "Ver chave" para modalidade aguardando', () => {
  const html = renderToStaticMarkup(<EventoPage evento={base([modChaves({ status: 'aguardando', resultado: null } as any)])} />)
  expect(html).not.toContain('Ver chave')
})
