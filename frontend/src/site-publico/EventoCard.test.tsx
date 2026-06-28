import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import EventoCard from './components/EventoCard'
import type { SnapEvento } from './snapshot-types'

function ev(mods: any[]): SnapEvento {
  return { id: 7, nome: 'Jogos Teste', competicao: 'Copa', cidade: 'Tupã', local: 'Ginásio', data: '2026-06-18T00:00:00.000Z', organizador: null, publicadoEm: '', dataInicio: null, dataFim: null, boletins: [], modalidades: mods } as any
}

describe('EventoCard', () => {
  it('mostra cover, progresso N/M e link para o evento', () => {
    const html = renderToStaticMarkup(<EventoCard evento={ev([
      { nome: 'A', tipo: 'chaves', status: 'sorteado', participantes: [{ id: 1 }] },
      { nome: 'B', tipo: 'grupos', status: 'aguardando', participantes: [{ id: 2 }] },
    ])} />)
    expect(html).toContain('class="ev2"')
    expect(html).toContain('/evento-7.html')
    expect(html).toContain('Jogos Teste')
    expect(html).toContain('1/2')
    expect(html).toContain('Andamento dos sorteios')
  })
  it('oculta o progresso quando só há modalidades específicas', () => {
    const html = renderToStaticMarkup(<EventoCard evento={ev([
      { nome: 'X', tipo: 'especifico', status: 'aguardando', participantes: [] },
    ])} />)
    expect(html).not.toContain('Andamento dos sorteios')
  })
})
