import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import EventoCardPreview from './EventoCardPreview'

it('preview: tipo dominante deep quando >1 tipo, status, progresso e rodape', () => {
  const html = renderToStaticMarkup(
    <EventoCardPreview nome="Jogos de Teste" competicaoNome="Regionais" cidade="Campinas" dataLabel="18/06/2026"
      status="pronto" tipos={['chaves', 'grupos']} totalModalidades={5} inscritos={84} sorteadas={2} sorteaveis={4} />,
  )
  expect(html).toContain('evx-prev')
  expect(html).toContain('var(--grad-brand-deep)') // >1 tipo
  expect(html).toContain('Pronto p/ sorteio')
  expect(html).toContain('2/4')
  expect(html).toContain('Jogos de Teste')
  expect(html).toContain('84')
})

it('preview: tipo unico usa o gradiente do tipo e oculta progresso quando sorteaveis=0', () => {
  const html = renderToStaticMarkup(
    <EventoCardPreview nome="X" competicaoNome="C" cidade="Y" dataLabel="" status="rascunho"
      tipos={['grupos']} totalModalidades={1} inscritos={0} sorteadas={0} sorteaveis={0} />,
  )
  expect(html).toContain('var(--grad-accent)') // grupos
  expect(html).not.toContain('Andamento dos sorteios')
})
