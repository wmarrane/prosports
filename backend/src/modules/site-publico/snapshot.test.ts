import { describe, it, expect } from 'vitest'
import { montaSnapshot } from './snapshot'

const baseEvento = {
  id: 10, nome: 'Jogos 2026',
  competicao: { nome: 'Jogos Regionais', considerar_anfitriao: false },
  municipio: { nome: 'São Manuel' },
  local: 'Ginásio', organizador: 'Montana', data_hora: new Date('2026-05-10T12:00:00Z'),
  anfitriao_id: null,
}

const modalidadeGrupos = {
  id: 1, nome: 'Futsal Masculino', sigla: 'FUT',
  tipo_modalidade: { tipo: 'grupos' as const },
}

it('monta snapshot de modalidade com grupos sorteada', () => {
  const snap = montaSnapshot({
    evento: baseEvento as any,
    modalidades: [modalidadeGrupos as any],
    inscricoesPorModalidade: new Map([[1, [
      { participante: { id: 100, nome: 'Tigres', subtitulo: 'Interior' } },
      { participante: { id: 101, nome: 'Lobos', subtitulo: 'Capital' } },
    ]]]) as any,
    campeoesPorModalidade: new Map([[1, [
      { participante_id: 100, posicao: 1 },
    ]]]) as any,
    sorteiosPorModalidade: new Map([[1, {
      tipo: 'grupos', seed: 'ABCD-1234',
      resultado: { regra_id: 5, classificados_por_grupo: 2, grupos: [{ letra: 'A', participantes: [100, 101] }] },
    }]]) as any,
    subtituloFn: (p: any) => p.subtitulo ?? null,
  })

  expect(snap.id).toBe(10)
  expect(snap.cidade).toBe('São Manuel')
  expect(snap.competicao).toBe('Jogos Regionais')
  const m = snap.modalidades[0]
  expect(m.tipo).toBe('grupos')
  expect(m.status).toBe('sorteado')
  expect(m.seed).toBe('ABCD-1234')
  expect(m.participantes).toEqual([
    { id: 100, nome: 'Tigres', subtitulo: 'Interior' },
    { id: 101, nome: 'Lobos', subtitulo: 'Capital' },
  ])
  expect(m.campeoes).toEqual([{ participanteId: 100, posicao: 1 }])
  expect(m.cabecasPids).toEqual([100])
  expect((m.resultado as any).grupos[0].letra).toBe('A')
})

it('marca modalidade sem sorteio como aguardando', () => {
  const snap = montaSnapshot({
    evento: baseEvento as any,
    modalidades: [{ id: 2, nome: 'Vôlei', sigla: 'VOL', tipo_modalidade: { tipo: 'chaves' } } as any],
    inscricoesPorModalidade: new Map([[2, []]]) as any,
    campeoesPorModalidade: new Map() as any,
    sorteiosPorModalidade: new Map() as any,
    subtituloFn: () => null,
  })
  const m = snap.modalidades[0]
  expect(m.status).toBe('aguardando')
  expect(m.seed).toBeNull()
  expect(m.resultado).toBeNull()
  expect(m.cabecasPids).toEqual([])
})

it('insere anfitrião na 4ª cabeça em chaves quando considerar_anfitriao', () => {
  const eventoAnfitriao = {
    ...baseEvento,
    competicao: { nome: 'Jogos Regionais', considerar_anfitriao: true },
    anfitriao_id: 999,
  }
  const snap = montaSnapshot({
    evento: eventoAnfitriao as any,
    modalidades: [{ id: 3, nome: 'Vôlei', sigla: 'VOL', tipo_modalidade: { tipo: 'chaves' } } as any],
    inscricoesPorModalidade: new Map([[3, [
      { participante: { id: 1, nome: 'A', subtitulo: null } },
      { participante: { id: 2, nome: 'B', subtitulo: null } },
      { participante: { id: 3, nome: 'C', subtitulo: null } },
      { participante: { id: 999, nome: 'Anfitrião', subtitulo: null } },
    ]]]) as any,
    campeoesPorModalidade: new Map([[3, [
      { participante_id: 1, posicao: 1 },
      { participante_id: 2, posicao: 2 },
      { participante_id: 3, posicao: 3 },
    ]]]) as any,
    sorteiosPorModalidade: new Map([[3, {
      tipo: 'chaves', seed: 'CHAV-9999',
      resultado: { size: 4, slots: [1, 2, 3, 999], byePositions: [], matchesGraph: null },
    }]]) as any,
    subtituloFn: (p: any) => p.subtitulo ?? null,
  })
  const m = snap.modalidades[0]
  // applyAnfitriaoRule injeta o anfitrião no índice 3 (4ª cabeça) para chaves,
  // deslocando quem estava lá: campeões [1,2,3] + anfitrião 999 → [1,2,3,999].
  expect(m.cabecasPids[3]).toBe(999)
  expect(m.cabecasPids).toContain(999)
})

it('propaga mensagens_inscritos da modalidade para o snapshot', () => {
  const regras = [{ min: 0, max: 3, mensagem: 'Mínimo não atingido', pular_sorteio: true }]
  const snap = montaSnapshot({
    evento: baseEvento as any,
    modalidades: [{ id: 4, nome: 'Xadrez', tipo_modalidade: { tipo: 'chaves' }, mensagens_inscritos: regras } as any],
    inscricoesPorModalidade: new Map([[4, [
      { participante: { id: 1, nome: 'A', subtitulo: null } },
    ]]]) as any,
    campeoesPorModalidade: new Map() as any,
    sorteiosPorModalidade: new Map() as any,
    subtituloFn: () => null,
  })
  expect(snap.modalidades[0].mensagens_inscritos).toEqual(regras)
})

it('usa [] quando mensagens_inscritos é null/ausente', () => {
  const snap = montaSnapshot({
    evento: baseEvento as any,
    modalidades: [{ id: 5, nome: 'Dama', tipo_modalidade: { tipo: 'chaves' }, mensagens_inscritos: null } as any],
    inscricoesPorModalidade: new Map([[5, []]]) as any,
    campeoesPorModalidade: new Map() as any,
    sorteiosPorModalidade: new Map() as any,
    subtituloFn: () => null,
  })
  expect(snap.modalidades[0].mensagens_inscritos).toEqual([])
})

it('inclui boletins e datas inicio/fim no snapshot', () => {
  const snap = montaSnapshot({
    evento: {
      id: 1, nome: 'Ev', local: 'L', organizador: null, data_hora: new Date('2026-07-01'),
      anfitriao_id: null, competicao: { nome: 'C', considerar_anfitriao: false }, municipio: { nome: 'M' },
      data_inicio: new Date('2026-07-01'), data_fim: new Date('2026-07-03'),
      boletins: [
        { numero: 2, titulo: 'B2', categoria: 'Oficial', data_publicacao: new Date('2026-07-02'), public_url: 'http://vm/2.pdf', size_bytes: 2048, atualizado_em: new Date('2026-07-02T10:00:00Z') },
        { numero: 1, titulo: 'B1', categoria: 'Resultados', data_publicacao: new Date('2026-07-01'), public_url: 'http://vm/1.pdf', size_bytes: 1024, atualizado_em: new Date('2026-07-01T10:00:00Z') },
      ],
    } as any,
    modalidades: [], inscricoesPorModalidade: new Map(), campeoesPorModalidade: new Map(),
    sorteiosPorModalidade: new Map(), subtituloFn: () => null,
  })
  expect(snap.dataInicio).toBe('2026-07-01T00:00:00.000Z')
  expect(snap.dataFim).toBe('2026-07-03T00:00:00.000Z')
  expect(snap.boletins.map(b => b.numero)).toEqual([1, 2]) // ordenado por numero asc
  expect(snap.boletins[0]).toMatchObject({ titulo: 'B1', tamanho: 1024, atualizadoEm: '2026-07-01T10:00:00.000Z' })
})
