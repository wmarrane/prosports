import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import SorteioPrint, { SorteioPrintContent, SorteioPrintHeader } from './SorteioPrint'

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

it('SorteioPrintContent com omitEventoHeader nao repete dados do evento', () => {
  const html = renderToStaticMarkup(<SorteioPrintContent {...base} omitEventoHeader />)
  expect(html).not.toContain('Jogos 2026')
  expect(html).not.toContain('Cidade Sede')
  expect(html).toContain('Futsal')
  expect(html).toContain('Tigres')
})

it('SorteioPrintHeader renderiza nome e dados do evento uma vez', () => {
  const html = renderToStaticMarkup(
    <SorteioPrintHeader eventoNome="Jogos 2026" anfitriao="São Manuel" cidadeLocalData="São Manuel · Ginásio · 10/05/2026" />
  )
  expect(html).toContain('Jogos 2026')
  expect(html).toContain('Cidade Sede')
  expect(html).toContain('São Manuel')
})

it('inscritos mostram o subtítulo numa 2ª linha quando presente', () => {
  const html = renderToStaticMarkup(
    <SorteioPrintContent
      {...base}
      omitEventoHeader
      inscritos={[{ id: 1, nome: 'SREL Araçatuba', subtitulo: 'EE Dr Carlos Rosa | Birigui/SP' }]}
    />
  )
  expect(html).toContain('SREL Araçatuba')
  expect(html).toContain('EE Dr Carlos Rosa | Birigui/SP')
  expect(html).toContain('#64748b') // cor da 2ª linha discreta
})

it('inscritos sem subtítulo mostram só o nome (sem 2ª linha)', () => {
  const html = renderToStaticMarkup(
    <SorteioPrintContent
      {...base}
      omitEventoHeader
      inscritos={[{ id: 2, nome: 'Time X', subtitulo: null }]}
    />
  )
  expect(html).toContain('Time X')
  expect(html).not.toContain('#64748b')
})
