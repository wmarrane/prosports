import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import SorteioPrint, { SorteioPrintContent } from './SorteioPrint'

const base = {
  eventoNome: 'Jogos 2026', anfitriao: 'São Manuel',
  modalidadeNome: 'Futsal', modalidadeTipo: 'grupos' as const, sigla: 'FUT',
  cidadeLocalData: 'São Manuel · Ginásio · 10/05/2026',
  seed: 'ABC-123',
  resultado: { regra_id: 1, classificados_por_grupo: 2, grupos: [{ letra: 'A', participantes: [100] }] },
  participantesById: new Map([[100, { id: 100, nome: 'Tigres', subtitulo: null } as any]]),
  campeoesByParticipanteId: new Map<number, number>(),
  anfitriaoPid: null as number | null,
  subtituloLine: () => null,
  inscritos: [{ id: 100, nome: 'Tigres' }],
  campeoes: [] as { posicao: number; nome: string }[],
}

it('SorteioPrint renderiza cabecalho, seed e o sorteio', () => {
  const html = renderToStaticMarkup(<SorteioPrint {...base} />)
  expect(html).toContain('class="sorteio-print"')
  expect(html).toContain('Jogos 2026')
  expect(html).toContain('Futsal')
  expect(html).toContain('ABC-123')
  expect(html).toContain('Tigres')
})

it('SorteioPrintContent renderiza inline com a classe sorteio-print', () => {
  const html = renderToStaticMarkup(<SorteioPrintContent {...base} />)
  expect(html).toContain('class="sorteio-print"')
  expect(html).toContain('Jogos 2026')
  expect(html).toContain('Tigres')
})

it('SorteioPrintContent omite seed e bloco de sorteio quando nao ha sorteio', () => {
  const html = renderToStaticMarkup(
    <SorteioPrintContent {...base} resultado={null} seed="" />
  )
  expect(html).not.toContain('seed:')
  expect(html).toContain('Tigres')
})
