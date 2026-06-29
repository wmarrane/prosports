import { describe, it, expect } from 'vitest'
import { decidirAcaoPublicacao } from './publicar-status'

describe('decidirAcaoPublicacao', () => {
  it('publica ao virar pronto/parcial/sorteado', () => {
    expect(decidirAcaoPublicacao('inscricoes', 'pronto', false)).toBe('publicar')
    expect(decidirAcaoPublicacao('pronto', 'parcial', true)).toBe('publicar')
    expect(decidirAcaoPublicacao('parcial', 'sorteado', true)).toBe('publicar')
  })
  it('despublica ao virar status nao-publico SE estiver publicado', () => {
    expect(decidirAcaoPublicacao('sorteado', 'rascunho', true)).toBe('despublicar')
    expect(decidirAcaoPublicacao('pronto', 'suspenso', true)).toBe('despublicar')
  })
  it('nada quando nao-publico e nao publicado', () => {
    expect(decidirAcaoPublicacao('inscricoes', 'rascunho', false)).toBeNull()
  })
  it('nada quando status ausente ou igual ao atual', () => {
    expect(decidirAcaoPublicacao('pronto', undefined, true)).toBeNull()
    expect(decidirAcaoPublicacao('sorteado', 'sorteado', true)).toBeNull()
  })
})
