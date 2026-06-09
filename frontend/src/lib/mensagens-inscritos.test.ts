import { describe, it, expect } from 'vitest'
import { matchMensagem, type MensagemInscritos } from './mensagens-inscritos'

const r = (min: number, max: number | null, mensagem: string, pular = false): MensagemInscritos => ({ min, max, mensagem, pular_sorteio: pular })

describe('matchMensagem', () => {
  it('primeira regra que casa vence', () => {
    const regras = [r(1, 5, 'A'), r(3, 5, 'B')]
    expect(matchMensagem(regras, 4)?.mensagem).toBe('A')
  })

  it('max nulo casa para qualquer n >= min', () => {
    expect(matchMensagem([r(6, null, 'seis+')], 99)?.mensagem).toBe('seis+')
    expect(matchMensagem([r(6, null, 'seis+')], 5)).toBeNull()
  })

  it('valor único (min===max)', () => {
    const regras = [r(2, 2, 'dois')]
    expect(matchMensagem(regras, 2)?.mensagem).toBe('dois')
    expect(matchMensagem(regras, 3)).toBeNull()
  })

  it('limites inclusivos', () => {
    const regras = [r(3, 5, 'tres-cinco')]
    expect(matchMensagem(regras, 3)?.mensagem).toBe('tres-cinco')
    expect(matchMensagem(regras, 5)?.mensagem).toBe('tres-cinco')
    expect(matchMensagem(regras, 6)).toBeNull()
  })

  it('nenhum match retorna null', () => {
    expect(matchMensagem([], 4)).toBeNull()
  })
})
