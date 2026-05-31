import { describe, it, expect } from 'vitest'
import { composeSubtituloLine } from './compose-subtitulo'

const fullP = {
  subtitulo: 'Clube XYZ',
  municipio: { nome: 'Campinas', uf: 'SP' },
  inspetoria: { id: 1, nome: 'Inspetoria Sul', criado_em: '', atualizado_em: '' },
  delegacia: { id: 1, nome: 'Delegacia Centro', criado_em: '', atualizado_em: '' },
}

describe('composeSubtituloLine', () => {
  it('retorna null quando campos vazios', () => {
    expect(composeSubtituloLine(fullP as any, [])).toBeNull()
  })

  it('retorna campo único quando só um selecionado', () => {
    expect(composeSubtituloLine(fullP as any, ['subtitulo'])).toBe('Clube XYZ')
  })

  it('junta múltiplos campos na ordem com " | "', () => {
    expect(composeSubtituloLine(fullP as any, ['subtitulo', 'municipio'])).toBe('Clube XYZ | Campinas/SP')
  })

  it('preserva ordem do array', () => {
    expect(composeSubtituloLine(fullP as any, ['municipio', 'subtitulo'])).toBe('Campinas/SP | Clube XYZ')
  })

  it('omite silenciosamente campos vazios/null', () => {
    const p = { ...fullP, subtitulo: null }
    expect(composeSubtituloLine(p as any, ['subtitulo', 'municipio'])).toBe('Campinas/SP')
  })

  it('retorna null se TODOS os campos selecionados são vazios', () => {
    const p = { subtitulo: null, municipio: null, inspetoria: null, delegacia: null }
    expect(composeSubtituloLine(p as any, ['subtitulo', 'inspetoria'])).toBeNull()
  })

  it('omite inspetoria/delegacia quando relação é null', () => {
    const p = { ...fullP, inspetoria: null }
    expect(composeSubtituloLine(p as any, ['subtitulo', 'inspetoria', 'delegacia']))
      .toBe('Clube XYZ | Delegacia Centro')
  })

  it('formata municipio como nome/UF', () => {
    expect(composeSubtituloLine(fullP as any, ['municipio'])).toBe('Campinas/SP')
  })
})
