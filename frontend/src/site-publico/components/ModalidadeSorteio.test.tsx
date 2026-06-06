import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ModalidadeSorteio from './ModalidadeSorteio'
import grupos from '../__fixtures__/evento-grupos.json'
import chaves from '../__fixtures__/evento-chaves.json'
import type { SnapModalidade } from '../snapshot-types'

it('renderiza grupos com nome do participante e letra do grupo', () => {
  const html = renderToStaticMarkup(<ModalidadeSorteio modalidade={grupos.modalidades[0] as SnapModalidade} />)
  expect(html).toContain('Tigres do Vale')
  expect(html).toContain('Grupo')
})

it('renderiza chaves com os jogos', () => {
  const html = renderToStaticMarkup(<ModalidadeSorteio modalidade={chaves.modalidades[0] as SnapModalidade} />)
  expect(html).toContain('Ana')
  expect(html).toContain('Bia')
})

it('renderiza estado aguardando quando sem resultado', () => {
  const m = { ...(chaves.modalidades[0] as SnapModalidade), status: 'aguardando' as const, resultado: null }
  const html = renderToStaticMarkup(<ModalidadeSorteio modalidade={m} />)
  expect(html).toContain('Aguardando sorteio')
})
