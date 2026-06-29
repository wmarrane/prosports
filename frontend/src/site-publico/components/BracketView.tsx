import type { SnapModalidade } from '../snapshot-types'
import type { Participante } from '../../types/participante'
import SorteioChaves from '../../components/sorteio-result/SorteioChaves'
import { resolveRef } from '../lib/bracket'
import { X, GitFork, ListOrdered, Crown } from 'lucide-react'

type Match = { id: string; round: number; top: string; bottom: string }

function roundLabel(round: number, maxRound: number): string {
  const d = maxRound - round
  return d === 0 ? 'Final' : d === 1 ? 'Semifinal' : d === 2 ? 'Quartas' : d === 3 ? 'Oitavas' : `${round}ª rodada`
}

export default function BracketView({ modalidade }: { modalidade: SnapModalidade }) {
  const res = modalidade.resultado as any
  const graph = res?.matchesGraph
  if (!graph || !graph.matches?.length) return null

  const nomePorId = new Map<number, string>()
  for (const p of modalidade.participantes) nomePorId.set(p.id, p.nome)
  const cabecas = new Set(modalidade.cabecasPids)
  const slots: (number | null)[] = res.slots ?? []
  const matches: Match[] = graph.matches
  const maxRound = Math.max(...matches.map((m) => m.round))
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b)
  const isBye = (m: Match) => m.top === 'BYE' || m.bottom === 'BYE'

  const participantesById = new Map<number, Participante>()
  for (const p of modalidade.participantes) participantesById.set(p.id, { id: p.id, nome: p.nome, subtitulo: p.subtitulo } as Participante)

  const row = (ref: string) => {
    const r = resolveRef(ref, slots, nomePorId)
    const cab = r.pid != null && cabecas.has(r.pid)
    return (
      <div className={`em-mt-row${ref === 'BYE' ? ' bye' : ''}`}>
        <span className="seed">{r.seed ?? ''}</span>
        <span className="nm">{r.nome ?? r.label}</span>
        {cab && <Crown size={14} style={{ color: 'var(--warn)', flexShrink: 0 }} />}
      </div>
    )
  }

  return (
    <div className="em-bracket-ov" id={`bracket-${modalidade.id}`} data-open="false">
      <div className="em-bk-head">
        <div className="tt"><b>{modalidade.nome}</b><span>Chave sorteada</span></div>
        <button type="button" className="em-bk-close" data-bracket-close aria-label="Fechar"><X size={18} /></button>
      </div>
      <div className="em-bk-body">
        <div className="em-vtog">
          <button type="button" data-view="fase" data-on="true"><ListOrdered size={15} /> Por fase</button>
          <button type="button" data-view="arvore"><GitFork size={15} /> Chaveamento</button>
        </div>

        {/* Pane: Por fase */}
        <div className="em-pane" data-pane="fase" data-on="true">
          <div className="em-rtabs">
            {rounds.map((r) => (
              <button type="button" className="em-rtab" key={r} data-round={r} data-on={r === maxRound}>
                {roundLabel(r, maxRound)} <span className="n">{matches.filter((m) => m.round === r && !isBye(m)).length}</span>
              </button>
            ))}
          </div>
          {rounds.map((r) => {
            const reais = matches.filter((m) => m.round === r && !isBye(m))
            const byes = matches.filter((m) => m.round === r && isBye(m))
            return (
              <div className="em-round" data-round={r} data-on={r === maxRound} key={r}>
                {byes.length > 0 && (
                  <div className="em-byes">
                    <div className="bh"><Crown size={14} /> Classificados direto (bye)</div>
                    <div className="bl">{byes.map((m) => {
                      const ref = m.top === 'BYE' ? m.bottom : m.top
                      const rr = resolveRef(ref, slots, nomePorId)
                      return <span className="bch" key={m.id}><span className="s">{rr.seed ?? ''}</span>{rr.nome ?? rr.label}</span>
                    })}</div>
                  </div>
                )}
                {reais.map((m) => {
                  const ph = m.id === graph.final ? 'Final' : (graph.thirdPlace && m.id === graph.thirdPlace ? 'Disputa de 3º' : null)
                  return (
                    <div className={`em-mt${m.id === graph.final ? ' final' : ''}`} key={m.id}>
                      <div className="em-mt-cap"><span className="lab">{m.id}</span>{ph && <span className="em-mt-ph">{ph}</span>}</div>
                      {row(m.top)}
                      {row(m.bottom)}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Pane: Chaveamento (árvore — reusa SorteioChaves/BracketTree) */}
        <div className="em-pane" data-pane="arvore">
          <div className="em-tree-wrap">
            <SorteioChaves resultado={res} participantesById={participantesById} large cabecasPids={cabecas} />
          </div>
        </div>
      </div>
    </div>
  )
}
