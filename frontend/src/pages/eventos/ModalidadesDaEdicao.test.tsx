import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ModalidadesDaEdicao from './ModalidadesDaEdicao'

const mods = [
  { id: 1, nome: 'Judô Masculino', tipo: 'chaves' as const },
  { id: 2, nome: 'Futsal', tipo: 'grupos' as const },
]

it('lista modalidades e marca a desativada (data-off)', () => {
  const html = renderToStaticMarkup(<ModalidadesDaEdicao modalidades={mods} excluidas={new Set([2])} onToggle={() => {}} />)
  expect(html).toContain('Judô Masculino')
  expect(html).toContain('Futsal')
  expect(html).toContain('data-off="true"')   // a modalidade 2 está excluída
  expect(html).toContain('var(--grad-brand)')  // ícone da modalidade 'chaves'
})
