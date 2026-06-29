import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import EventoPage from './pages/EventoPage'
import type { SnapEvento } from './snapshot-types'

const base = (extra: Partial<SnapEvento> = {}): SnapEvento => ({
  id: 3, nome: 'Jogos Regionais', competicao: 'Regionais 2026', cidade: 'Campinas', local: 'Ginásio',
  data: '2026-06-18T00:00:00.000Z', organizador: 'Org X', publicadoEm: '',
  dataInicio: '2026-06-18T00:00:00.000Z', dataFim: '2026-06-20T00:00:00.000Z',
  status: 'pronto',
  boletins: [], modalidades: [
    { id: 1, nome: 'Judô', grupo: null, tipo: 'chaves', status: 'sorteado', seed: null, anfitriaoId: null, participantes: [{ id: 1, nome: 'A', subtitulo: null }], campeoes: [], cabecasPids: [], resultado: null, mensagens_inscritos: [] },
    { id: 2, nome: 'Futsal', grupo: null, tipo: 'grupos', status: 'aguardando', seed: null, anfitriaoId: null, participantes: [{ id: 2, nome: 'B', subtitulo: null }], campeoes: [], cabecasPids: [], resultado: null, mensagens_inscritos: [] },
  ], ...extra,
} as any)

describe('EventoPage hero', () => {
  it('renderiza o hero com título e badge de status', () => {
    const html = renderToStaticMarkup(<EventoPage evento={base()} />)
    expect(html).toContain('ev-hero2')
    expect(html).toContain('Jogos Regionais')
    expect(html).toContain('Pronto p/ sorteio')
    expect(html).not.toContain('Categorias')
  })
  it('não renderiza barra de progresso, quadros de indicadores nem ações do hero', () => {
    const html = renderToStaticMarkup(<EventoPage evento={base()} />)
    expect(html).not.toContain('Andamento dos sorteios')
    expect(html).not.toContain('stat-pair')
    expect(html).not.toContain('info-band')
    expect(html).not.toContain('Compartilhar evento')
    expect(html).not.toContain('Baixar o último boletim oficial')
  })
  it('badge do hero segue o status real do evento', () => {
    expect(renderToStaticMarkup(<EventoPage evento={base({ status: 'parcial' } as any)} />)).toContain('Parcial')
    expect(renderToStaticMarkup(<EventoPage evento={base({ status: 'sorteado' } as any)} />)).toContain('Sorteado')
  })
})
