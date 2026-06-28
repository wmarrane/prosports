import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    evento: { findUnique: vi.fn() },
    modalidade: { findMany: vi.fn() },
    inscricao: { groupBy: vi.fn() },
    sorteio: { findMany: vi.fn() },
    eventoModalidadeExcluida: { findMany: vi.fn() },
    sistemaDisputasGrupos: { findMany: vi.fn() },
    sistemaDisputasChaves: { findMany: vi.fn() },
    bracketChavesByes: { findMany: vi.fn() },
  },
}))

import prisma from '../../lib/prisma'
import { progressoSorteio } from './eventos.service'

const mp = prisma as any

beforeEach(() => {
  vi.clearAllMocks()
  mp.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 1 })
  mp.modalidade.findMany.mockResolvedValue([
    { id: 1, tipo_modalidade: { tipo: 'chaves' }, mensagens_inscritos: [] },
    { id: 2, tipo_modalidade: { tipo: 'grupos' }, mensagens_inscritos: [] },
    { id: 3, tipo_modalidade: { tipo: 'grupos' }, mensagens_inscritos: [] },
    { id: 4, tipo_modalidade: { tipo: 'chaves' }, mensagens_inscritos: [] },
    { id: 5, tipo_modalidade: { tipo: 'chaves' }, mensagens_inscritos: [] },
    { id: 6, tipo_modalidade: { tipo: 'ordem_entrada' }, mensagens_inscritos: [] },
    { id: 7, tipo_modalidade: { tipo: 'especifico' }, mensagens_inscritos: [] },
  ])
  mp.inscricao.groupBy.mockResolvedValue([
    { modalidade_id: 1, _count: { _all: 8 } },
    { modalidade_id: 2, _count: { _all: 6 } },
    { modalidade_id: 3, _count: { _all: 3 } },
    { modalidade_id: 4, _count: { _all: 5 } },
    { modalidade_id: 5, _count: { _all: 0 } },
    { modalidade_id: 6, _count: { _all: 10 } },
  ])
  mp.sorteio.findMany.mockResolvedValue([{ modalidade_id: 1 }])
  mp.eventoModalidadeExcluida.findMany.mockResolvedValue([])
  mp.sistemaDisputasGrupos.findMany.mockResolvedValue([{ quantidade_equipes: 6 }])
  mp.sistemaDisputasChaves.findMany.mockResolvedValue([{ numero_inscrito: 8 }, { numero_inscrito: 5 }])
  mp.bracketChavesByes.findMany.mockResolvedValue([{ numero_inscrito: 8 }]) // 5 ausente → R4 exclui mod 4
})

describe('progressoSorteio', () => {
  it('conta só grupos/chaves sorteáveis (R1–R4) e as já sorteadas', async () => {
    const r = await progressoSorteio(1)
    expect(r.sorteaveis).toBe(2) // mod 1 (chaves/8) e mod 2 (grupos/6)
    expect(r.sorteadas).toBe(1)  // mod 1
  })
  it('adicionar bracket reinclui a chave (R4): exclui R3, inclui R4 corrigido', async () => {
    // Adiciona bracket para mod 4 (N=5) → agora passa R4 e se torna sorteável
    mp.bracketChavesByes.findMany.mockResolvedValue([{ numero_inscrito: 8 }, { numero_inscrito: 5 }])
    const r = await progressoSorteio(1)
    expect(r.sorteaveis).toBe(3) // mod 1 (chaves/8), mod 2 (grupos/6), mod 4 (chaves/5 agora com bracket)
    expect(r.sorteadas).toBe(1)  // mod 1
  })
})
