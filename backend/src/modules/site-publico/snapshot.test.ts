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
