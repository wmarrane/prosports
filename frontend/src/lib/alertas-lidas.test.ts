import { describe, it, expect } from 'vitest'
import { aplicarLida } from './alertas-lidas'
import type { Alerta } from './alertas'

const alerta = (id: string, titulo = 'T'): Alerta => ({
  id,
  tipo: 'pronto',
  titulo,
  descricao: 'desc',
  to: `/x/${id}`,
})

describe('aplicarLida', () => {
  it('adiciona a lida no topo com lidaEm preenchido', () => {
    const agora = new Date('2026-06-13T10:00:00.000Z')
    const out = aplicarLida([], alerta('a'), agora)
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('a')
    expect(out[0].lidaEm).toBe('2026-06-13T10:00:00.000Z')
    expect(out[0].to).toBe('/x/a')
  })

  it('dedupe por id: re-marcar move ao topo sem duplicar', () => {
    const t1 = new Date('2026-06-13T10:00:00.000Z')
    const t2 = new Date('2026-06-13T11:00:00.000Z')
    let lidas = aplicarLida([], alerta('a'), t1)
    lidas = aplicarLida(lidas, alerta('b'), t1)
    lidas = aplicarLida(lidas, alerta('a', 'novo titulo'), t2)
    expect(lidas.map(l => l.id)).toEqual(['a', 'b'])
    expect(lidas[0].titulo).toBe('novo titulo')
    expect(lidas[0].lidaEm).toBe('2026-06-13T11:00:00.000Z')
  })

  it('cap em 10: o 11o empurra o mais antigo para fora', () => {
    let lidas: ReturnType<typeof aplicarLida> = []
    for (let i = 1; i <= 11; i++) {
      lidas = aplicarLida(lidas, alerta(`id${i}`), new Date(`2026-06-13T10:${String(i).padStart(2, '0')}:00.000Z`))
    }
    expect(lidas).toHaveLength(10)
    expect(lidas[0].id).toBe('id11')
    expect(lidas.find(l => l.id === 'id1')).toBeUndefined()
  })
})
