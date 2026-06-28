import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import EventoPage from './pages/EventoPage'
import type { SnapEvento } from './snapshot-types'

const base = (extra: Partial<SnapEvento> = {}): SnapEvento => ({
  id: 3, nome: 'Jogos Regionais', competicao: 'Regionais 2026', cidade: 'Campinas', local: 'Ginásio',
  data: '2026-06-18T00:00:00.000Z', organizador: 'Org X', publicadoEm: '',
  dataInicio: '2026-06-18T00:00:00.000Z', dataFim: '2026-06-20T00:00:00.000Z',
  boletins: [], modalidades: [
    { id: 1, nome: 'Judô', grupo: null, tipo: 'chaves', status: 'sorteado', seed: null, anfitriaoId: null, participantes: [{ id: 1, nome: 'A', subtitulo: null }], campeoes: [], cabecasPids: [], resultado: null, mensagens_inscritos: [] },
    { id: 2, nome: 'Futsal', grupo: null, tipo: 'grupos', status: 'aguardando', seed: null, anfitriaoId: null, participantes: [{ id: 2, nome: 'B', subtitulo: null }], campeoes: [], cabecasPids: [], resultado: null, mensagens_inscritos: [] },
  ], ...extra,
} as any)

describe('EventoPage hero', () => {
  it('renderiza o hero novo com título, progresso e stat-pair', () => {
    const html = renderToStaticMarkup(<EventoPage evento={base()} />)
    expect(html).toContain('ev-hero2')
    expect(html).toContain('Jogos Regionais')
    expect(html).toContain('Andamento dos sorteios')
    expect(html).toContain('1 / 2')
    expect(html).toContain('Inscritos')
    expect(html).toContain('info-band')
  })
  it('mostra "Baixar boletim oficial" só quando há boletim', () => {
    const semBol = renderToStaticMarkup(<EventoPage evento={base()} />)
    expect(semBol).not.toContain('Baixar boletim oficial')
    const comBol = renderToStaticMarkup(<EventoPage evento={base({ boletins: [{ numero: 1, titulo: 'Of', categoria: 'Oficial', data: '2026-06-18T00:00:00.000Z', url: 'http://x/1.pdf', tamanho: 1, atualizadoEm: '2026-06-18T00:00:00.000Z' }] })} />)
    expect(comBol).toContain('Baixar boletim oficial')
    expect(comBol).toContain('http://x/1.pdf')
  })
})
