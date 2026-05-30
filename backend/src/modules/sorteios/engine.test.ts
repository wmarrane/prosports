import { describe, it, expect } from 'vitest'
import {
  shuffleSeeded,
  drawGroups,
  drawBracket,
  shuffleOrder,
} from './engine'

describe('shuffleSeeded', () => {
  it('mesma seed produz mesma saída', () => {
    const a = shuffleSeeded([1,2,3,4,5,6,7,8,9,10], 'abc')
    const b = shuffleSeeded([1,2,3,4,5,6,7,8,9,10], 'abc')
    expect(a).toEqual(b)
  })

  it('seeds diferentes produzem saídas diferentes', () => {
    const a = shuffleSeeded([1,2,3,4,5,6,7,8,9,10], 'abc')
    const b = shuffleSeeded([1,2,3,4,5,6,7,8,9,10], 'xyz')
    expect(a).not.toEqual(b)
  })

  it('não muta o array original', () => {
    const input = [1,2,3,4,5]
    const snapshot = [...input]
    shuffleSeeded(input, 'seed')
    expect(input).toEqual(snapshot)
  })

  it('preserva todos os elementos (permutação)', () => {
    const input = [10,20,30,40,50]
    const out = shuffleSeeded(input, 'seed')
    expect(out.sort()).toEqual([10,20,30,40,50])
  })
})

describe('drawGroups', () => {
  it('6 participantes + regra (2g, 2 de 3, 0 de 4) distribui em 2 grupos de 3 com todos os ids', () => {
    const regra = { id: 1, quantidade_grupos: 2, grupos_3_componentes: 2, grupos_4_componentes: 0, numero_classificados: 2 }
    const out = drawGroups([1,2,3,4,5,6], regra, 'seed1')
    expect(out.regra_id).toBe(1)
    expect(out.classificados_por_grupo).toBe(2)
    expect(out.grupos).toHaveLength(2)
    expect(out.grupos[0].letra).toBe('A')
    expect(out.grupos[1].letra).toBe('B')
    expect(out.grupos[0].participantes).toHaveLength(3)
    expect(out.grupos[1].participantes).toHaveLength(3)
    const todos = [...out.grupos[0].participantes, ...out.grupos[1].participantes].sort()
    expect(todos).toEqual([1,2,3,4,5,6])
  })

  it('7 participantes + regra (1 de 3, 1 de 4) → tamanhos {3,4} em ordem aleatória, todos os ids presentes', () => {
    const regra = { id: 2, quantidade_grupos: 2, grupos_3_componentes: 1, grupos_4_componentes: 1, numero_classificados: 2 }
    const out = drawGroups([10,20,30,40,50,60,70], regra, 'seed2')
    expect(out.grupos).toHaveLength(2)
    const tamanhos = out.grupos.map(g => g.participantes.length).sort()
    expect(tamanhos).toEqual([3, 4])
    const todos = [...out.grupos[0].participantes, ...out.grupos[1].participantes].sort((a,b)=>a-b)
    expect(todos).toEqual([10,20,30,40,50,60,70])
  })

  it('ordem dos tamanhos é determinística para a mesma seed (mas pode variar entre seeds)', () => {
    const regra = { id: 3, quantidade_grupos: 4, grupos_3_componentes: 2, grupos_4_componentes: 2, numero_classificados: 2 }
    const participantes = [1,2,3,4,5,6,7,8,9,10,11,12,13,14]
    const a = drawGroups(participantes, regra, 'seedA')
    const b = drawGroups(participantes, regra, 'seedA')
    expect(a.grupos.map(g => g.participantes.length)).toEqual(b.grupos.map(g => g.participantes.length))
    // Soma e cobertura
    expect(a.grupos.map(g => g.participantes.length).sort()).toEqual([3,3,4,4])
  })

  it('sem campeoesPids: comportamento igual (regressão)', () => {
    const regra = { id: 1, quantidade_grupos: 2, grupos_3_componentes: 2, grupos_4_componentes: 0, numero_classificados: 2 }
    const a = drawGroups([1,2,3,4,5,6], regra, 'seed-x')
    const b = drawGroups([1,2,3,4,5,6], regra, 'seed-x', [])
    expect(a).toEqual(b)
  })

  it('1 campeão + 5 outros (regra 2g de 3): campeão na 1ª pos do Grupo A; outros 5 distribuídos', () => {
    const regra = { id: 1, quantidade_grupos: 2, grupos_3_componentes: 2, grupos_4_componentes: 0, numero_classificados: 2 }
    const out = drawGroups([10,20,30,40,50,60], regra, 'seed-c1', [10])
    expect(out.grupos[0].participantes[0]).toBe(10)
    const todos = [...out.grupos[0].participantes, ...out.grupos[1].participantes].sort((a,b)=>a-b)
    expect(todos).toEqual([10,20,30,40,50,60])
  })

  it('3 campeões + 3 outros (regra 2g de 3): 1º e 2º campeões nas 1ªs pos de A e B; 3º entra no shuffle', () => {
    const regra = { id: 1, quantidade_grupos: 2, grupos_3_componentes: 2, grupos_4_componentes: 0, numero_classificados: 2 }
    const out = drawGroups([10,20,30,40,50,60], regra, 'seed-c3', [10, 20, 30])
    expect(out.grupos[0].participantes[0]).toBe(10)
    expect(out.grupos[1].participantes[0]).toBe(20)
    const todos = [...out.grupos[0].participantes, ...out.grupos[1].participantes]
    expect(todos.includes(30)).toBe(true)
    expect(out.grupos[0].participantes[0]).not.toBe(30)
    expect(out.grupos[1].participantes[0]).not.toBe(30)
    expect(todos.sort((a,b)=>a-b)).toEqual([10,20,30,40,50,60])
  })
})

describe('drawBracket', () => {
  it('5 participantes → size 8, 3 byes (null), todos pids presentes', () => {
    const out = drawBracket([1,2,3,4,5], 'seed')
    expect(out.size).toBe(8)
    expect(out.slots).toHaveLength(8)
    const nulls = out.slots.filter(s => s === null).length
    expect(nulls).toBe(3)
    const pids = out.slots.filter((s): s is number => s !== null).sort()
    expect(pids).toEqual([1,2,3,4,5])
  })

  it('8 participantes → size 8, 0 byes', () => {
    const out = drawBracket([1,2,3,4,5,6,7,8], 'seed')
    expect(out.size).toBe(8)
    expect(out.slots.filter(s => s === null)).toHaveLength(0)
  })

  it('1 participante → size 1, slots = [pid]', () => {
    const out = drawBracket([42], 'seed')
    expect(out.size).toBe(1)
    expect(out.slots).toEqual([42])
  })
})

describe('shuffleOrder', () => {
  it('tamanho preservado e mesma seed → mesma ordem', () => {
    const a = shuffleOrder([1,2,3,4,5], 'seed')
    const b = shuffleOrder([1,2,3,4,5], 'seed')
    expect(a.ordem).toHaveLength(5)
    expect(a).toEqual(b)
  })
})
