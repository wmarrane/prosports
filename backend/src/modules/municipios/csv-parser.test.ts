import { describe, it, expect } from 'vitest'
import { parseCsv } from './csv-parser'

describe('csv-parser', () => {
  it('parseia CSV com vírgula', () => {
    const csv = 'a,b,c\n1,2,3\n4,5,6'
    expect(parseCsv(csv)).toEqual([
      { a: '1', b: '2', c: '3' },
      { a: '4', b: '5', c: '6' },
    ])
  })

  it('parseia CSV com ponto-e-vírgula', () => {
    const csv = 'a;b\nx;y'
    expect(parseCsv(csv)).toEqual([{ a: 'x', b: 'y' }])
  })

  it('remove BOM no início do arquivo', () => {
    const csv = '﻿a,b\n1,2'
    expect(parseCsv(csv)).toEqual([{ a: '1', b: '2' }])
  })

  it('trata campos entre aspas com separador interno', () => {
    const csv = 'nome,uf\n"São Paulo, capital",SP'
    expect(parseCsv(csv)).toEqual([{ nome: 'São Paulo, capital', uf: 'SP' }])
  })

  it('trata aspas duplas escapadas dentro de campo', () => {
    const csv = 'a,b\n"ele disse ""oi""",2'
    expect(parseCsv(csv)).toEqual([{ a: 'ele disse "oi"', b: '2' }])
  })

  it('ignora linhas em branco', () => {
    const csv = 'a,b\n1,2\n\n3,4\n'
    expect(parseCsv(csv)).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ])
  })

  it('aceita CRLF', () => {
    const csv = 'a,b\r\n1,2\r\n3,4'
    expect(parseCsv(csv)).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ])
  })

  it('retorna [] quando só tem header', () => {
    expect(parseCsv('a,b')).toEqual([])
  })
})
