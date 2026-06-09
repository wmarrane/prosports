import { describe, it, expect } from 'vitest'
import { deriveEventoAlerts } from './alertas'

const ev = (id: number, nome: string, status: string) => ({ id, nome, status: status as any })

describe('deriveEventoAlerts', () => {
  it('classifica pronto/parcial/inscricoes e ignora rascunho/sorteado', () => {
    const out = deriveEventoAlerts([
      ev(1, 'Jogos A', 'pronto'),
      ev(2, 'Jogos B', 'parcial'),
      ev(3, 'Jogos C', 'inscricoes'),
      ev(4, 'Jogos D', 'rascunho'),
      ev(5, 'Jogos E', 'sorteado'),
    ])
    expect(out.map(a => a.tipo)).toEqual(['pronto', 'parcial', 'inscricoes'])
  })

  it('gera id, titulo, descricao e rota corretos', () => {
    const [a] = deriveEventoAlerts([ev(7, 'Copa X', 'pronto')])
    expect(a).toEqual({
      id: 'evt-7-pronto',
      tipo: 'pronto',
      titulo: 'Pronto para sortear',
      descricao: 'Copa X',
      to: '/eventos/7/inscricoes',
    })
  })
})
