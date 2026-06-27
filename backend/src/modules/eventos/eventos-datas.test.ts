import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Espelha o createSchema do controller para testar a coerção das datas novas.
const STATUS_VALUES = ['rascunho','inscricoes','pronto','sorteado','parcial','suspenso'] as const
const schema = z.object({
  nome: z.string().min(1),
  data_hora: z.coerce.date(),
  local: z.string().min(1),
  organizador: z.string().optional(),
  status: z.enum(STATUS_VALUES).optional(),
  competicao_id: z.coerce.number().int().positive(),
  municipio_id: z.coerce.number().int().positive(),
  anfitriao_id: z.coerce.number().int().positive().nullable().optional(),
  comissao_ids: z.array(z.coerce.number().int().positive()).optional(),
  data_inicio: z.coerce.date().nullable().optional(),
  data_fim: z.coerce.date().nullable().optional(),
})

describe('evento datas inicio/fim', () => {
  it('coage strings ISO para Date', () => {
    const r = schema.parse({ nome: 'X', data_hora: '2026-07-01', local: 'L', competicao_id: 1, municipio_id: 1, data_inicio: '2026-07-01', data_fim: '2026-07-03' })
    expect(r.data_inicio).toBeInstanceOf(Date)
    expect(r.data_fim).toBeInstanceOf(Date)
  })
  it('aceita ausência (opcional)', () => {
    const r = schema.parse({ nome: 'X', data_hora: '2026-07-01', local: 'L', competicao_id: 1, municipio_id: 1 })
    expect(r.data_inicio).toBeUndefined()
  })
})
