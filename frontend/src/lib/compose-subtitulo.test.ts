import { describe, it, expect } from 'vitest'
import { composeSubtituloLine, participanteEfetivo } from './compose-subtitulo'

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
    const efetivo = participanteEfetivo(inscComOverride as any, true)
    expect(efetivo.subtitulo).toBe('Colégio ABC')
    expect(efetivo.municipio).toEqual({ nome: 'Campinas', uf: 'SP' })
  })

  it('escolar sem override (null) → subtítulo/município null (não herda do participante)', () => {
    const efetivo = participanteEfetivo(inscSemOverride as any, true)
    expect(efetivo.subtitulo).toBeNull()
    expect(efetivo.municipio).toBeNull()
  })

  it('não-escolar → retorna o participante diretamente (mesmo objeto)', () => {
    const efetivo = participanteEfetivo(inscComOverride as any, false)
    expect(efetivo).toBe(participante)
  })

  it('não-escolar → subtítulo/município são os do participante original', () => {
    const efetivo = participanteEfetivo(inscComOverride as any, false)
    expect(efetivo.subtitulo).toBe('Escola Estadual X')
    expect(efetivo.municipio).toEqual({ nome: 'São Paulo', uf: 'SP' })
  })
})
