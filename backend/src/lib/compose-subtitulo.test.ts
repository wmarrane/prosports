import { describe, it, expect } from 'vitest'
import { composeSubtituloLine, participanteEfetivo } from './compose-subtitulo'

// ---------------------------------------------------------------------------
// composeSubtituloLine (existing)
// ---------------------------------------------------------------------------
const fullP = {
  subtitulo: 'Clube XYZ',
  municipio: { nome: 'Campinas', uf: 'SP' },
  inspetoria: { nome: 'Inspetoria Sul' },
  delegacia: { nome: 'Delegacia Centro' },
}

describe('composeSubtituloLine', () => {
  it('retorna null quando campos vazios', () => {
    expect(composeSubtituloLine(fullP, [])).toBeNull()
  })

  it('retorna campo único quando só um selecionado', () => {
    expect(composeSubtituloLine(fullP, ['subtitulo'])).toBe('Clube XYZ')
  })

  it('junta múltiplos campos na ordem com " | "', () => {
    expect(composeSubtituloLine(fullP, ['subtitulo', 'municipio'])).toBe('Clube XYZ | Campinas/SP')
  })

  it('omite silenciosamente campos vazios/null', () => {
    const p = { ...fullP, subtitulo: null }
    expect(composeSubtituloLine(p, ['subtitulo', 'municipio'])).toBe('Campinas/SP')
  })

  it('retorna null se TODOS os campos selecionados são vazios', () => {
    const p = { subtitulo: null, municipio: null, inspetoria: null, delegacia: null }
    expect(composeSubtituloLine(p, ['subtitulo', 'inspetoria'])).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// participanteEfetivo
// ---------------------------------------------------------------------------
const participante = {
  subtitulo: 'Escola Estadual X',
  municipio: { nome: 'São Paulo', uf: 'SP' },
  inspetoria: null,
  delegacia: null,
}

const inscComOverride = {
  participante,
  subtitulo: 'Colégio ABC',
  municipio: { nome: 'Campinas', uf: 'SP' },
}

const inscSemOverride = {
  participante,
  subtitulo: null,
  municipio: null,
}

describe('participanteEfetivo', () => {
  it('escolar com override → retorna subtítulo/município do override', () => {
    const efetivo = participanteEfetivo(inscComOverride, true)
    expect(efetivo.subtitulo).toBe('Colégio ABC')
    expect(efetivo.municipio).toEqual({ nome: 'Campinas', uf: 'SP' })
  })

  it('escolar com override → não altera outros campos do participante', () => {
    const efetivo = participanteEfetivo(inscComOverride, true)
    expect(efetivo.inspetoria).toBeNull()
    expect(efetivo.delegacia).toBeNull()
  })

  it('escolar sem override (null) → subtítulo null (não herda do participante)', () => {
    const efetivo = participanteEfetivo(inscSemOverride, true)
    expect(efetivo.subtitulo).toBeNull()
  })

  it('escolar sem override (null) → município null (não herda do participante)', () => {
    const efetivo = participanteEfetivo(inscSemOverride, true)
    expect(efetivo.municipio).toBeNull()
  })

  it('não-escolar → retorna o participante diretamente (mesmo objeto)', () => {
    const efetivo = participanteEfetivo(inscComOverride, false)
    expect(efetivo).toBe(participante)
  })

  it('não-escolar → subtítulo/município são os do participante original', () => {
    const efetivo = participanteEfetivo(inscComOverride, false)
    expect(efetivo.subtitulo).toBe('Escola Estadual X')
    expect(efetivo.municipio).toEqual({ nome: 'São Paulo', uf: 'SP' })
  })
})
