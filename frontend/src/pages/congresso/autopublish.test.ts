import { it, expect } from 'vitest'
import { proximoMarcoCruzado, pctSorteado } from './autopublish'

it('pctSorteado calcula porcentagem inteira', () => {
  expect(pctSorteado(0, 4)).toBe(0)
  expect(pctSorteado(1, 4)).toBe(25)
  expect(pctSorteado(3, 4)).toBe(75)
  expect(pctSorteado(4, 4)).toBe(100)
  expect(pctSorteado(2, 0)).toBe(0)
})

it('proximoMarcoCruzado retorna o maior marco novo atingido', () => {
  expect(proximoMarcoCruzado(0, 0)).toBeNull()
  expect(proximoMarcoCruzado(25, 0)).toBe(25)
  expect(proximoMarcoCruzado(60, 25)).toBe(50)   // cruzou 50, ainda não 75
  expect(proximoMarcoCruzado(100, 75)).toBe(100)
  expect(proximoMarcoCruzado(30, 25)).toBeNull() // nada novo entre 25 e 30
  expect(proximoMarcoCruzado(100, 100)).toBeNull()
})
