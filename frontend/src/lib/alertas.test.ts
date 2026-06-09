import { describe, it, expect } from 'vitest'
import { deriveEventoAlerts, deriveSemRegraAlerts } from './alertas'

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

describe('deriveSemRegraAlerts', () => {
  const base = {
    eventosAtivos: [{ id: 1, nome: 'Jogos A', competicao_id: 10 }],
    modalidadesById: {
      100: { id: 100, nome: 'Judô', tipo: 'chaves' as const },
      200: { id: 200, nome: 'Futsal', tipo: 'grupos' as const },
      300: { id: 300, nome: 'Xadrez', tipo: 'especifico' as const },
    },
    countsByEvento: { 1: { 100: 22, 200: 6, 300: 4 } },
    rulesByCompeticao: { 10: { grupos: [6], chaves: [16] } },
  }

  it('chaves com N sem regra vira alerta; grupos com regra não', () => {
    const out = deriveSemRegraAlerts(base)
    expect(out).toHaveLength(1)
    expect(out[0]).toEqual({
      id: 'semregra-1-100',
      tipo: 'sem_regra',
      titulo: 'Modalidade sem regra',
      descricao: 'Jogos A · Judô (22)',
      to: '/eventos/1/inscricoes',
    })
  })

  it('ignora tipo especifico/ordem_entrada e N=0', () => {
    const out = deriveSemRegraAlerts({
      ...base,
      countsByEvento: { 1: { 300: 10, 100: 0 } },
      rulesByCompeticao: { 10: { grupos: [], chaves: [] } },
    })
    expect(out).toEqual([])
  })

  it('modalidade ausente em modalidadesById é ignorada', () => {
    const out = deriveSemRegraAlerts({
      ...base,
      countsByEvento: { 1: { 999: 8 } },
      rulesByCompeticao: { 10: { grupos: [], chaves: [] } },
    })
    expect(out).toEqual([])
  })
})
