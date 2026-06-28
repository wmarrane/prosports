import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import EventoAdminCard from './EventoAdminCard'
import type { Evento } from '../../types/evento'

function ev(over: Partial<Evento> = {}): Evento {
  return {
    id: 7, nome: 'Jogos Regionais de Araçatuba', data_hora: '2026-06-18T13:00:00.000Z',
    local: 'Ginásio Municipal', organizador: null, status: 'sorteado',
    competicao_id: 1,
    competicao: { id: 1, nome: 'Jogos Regionais', modalidades: [
      { id: 1, tipo_modalidade: { tipo: 'chaves' } },
      { id: 2, tipo_modalidade: { tipo: 'chaves' } },
      { id: 3, tipo_modalidade: { tipo: 'grupos' } },
      { id: 4, tipo_modalidade: { tipo: 'ordem_entrada' } },
    ] } as any,
    municipio_id: 1, municipio: { id: 1, nome: 'Araçatuba', uf: 'SP' } as any,
    anfitriao_id: null, anfitriao: null, logo_url: null,
    site_publicado_em: null, criado_em: '', atualizado_em: '',
    _count: { inscricoes: 0, sorteios: 2 },
    modalidades_sorteaveis: 3, modalidades_distintas: 4, total_participantes: 84,
    ...over,
  } as Evento
}

const noop = () => {}
const cbs = { isAdmin: true, publicando: false, despublicando: false, onAbrir: noop, onInscricoes: noop, onPublicar: noop, onDespublicar: noop, onRemover: noop }

it('renderiza cover, status, progresso N/M e ações', () => {
  const html = renderToStaticMarkup(<EventoAdminCard evento={ev()} {...cbs} />)
  expect(html).toContain('Jogos Regionais de Araçatuba')
  expect(html).toContain('Araçatuba/SP')
  expect(html).toContain('Sorteado')
  expect(html).toContain('2/3')
  expect(html).toContain('+1') // 3 tipos distintos → 2 tiles + "+1"
  expect(html).toContain('Inscrições')
  expect(html).toContain('Remover')
  expect(html).toContain('var(--grad-brand)') // tipo dominante = chaves
})

it('mostra Despublicar quando publicado', () => {
  const html = renderToStaticMarkup(<EventoAdminCard evento={ev({ site_publicado_em: '2026-06-19T00:00:00Z' })} {...cbs} />)
  expect(html).toContain('Despublicar')
  expect(html).not.toContain('Publicar no site')
})

it('oculta o progresso quando não há modalidades sorteáveis', () => {
  const html = renderToStaticMarkup(<EventoAdminCard evento={ev({ modalidades_sorteaveis: 0, competicao: { id: 1, nome: 'X', modalidades: [{ id: 1, tipo_modalidade: { tipo: 'especifico' } }] } as any })} {...cbs} />)
  expect(html).not.toContain('Andamento dos sorteios')
})
