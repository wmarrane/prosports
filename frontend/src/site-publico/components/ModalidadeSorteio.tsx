import SorteioGrupos from '../../components/sorteio-result/SorteioGrupos'
import SorteioChaves from '../../components/sorteio-result/SorteioChaves'
import SorteioOrdem from '../../components/sorteio-result/SorteioOrdem'
import type { Participante } from '../../types/participante'
import type { SnapModalidade } from '../snapshot-types'
import { matchMensagem } from '../../lib/mensagens-inscritos'

function buildMaps(m: SnapModalidade) {
  const participantesById = new Map<number, Participante>()
  for (const p of m.participantes) {
    participantesById.set(p.id, { id: p.id, nome: p.nome, subtitulo: p.subtitulo } as Participante)
  }
  const campeoesByParticipanteId = new Map<number, number>()
  for (const c of m.campeoes) campeoesByParticipanteId.set(c.participanteId, c.posicao)
  const subtituloLine = (p: Participante) => participantesById.get(p.id)?.subtitulo ?? null
  return { participantesById, campeoesByParticipanteId, subtituloLine }
}

export default function ModalidadeSorteio({ modalidade }: { modalidade: SnapModalidade }) {
  if (modalidade.tipo === 'especifico') {
    return <div style={{ padding: 16, color: 'var(--t3)', fontStyle: 'italic' }}>Modalidade específica — não possui sorteio.</div>
  }
  if (modalidade.status !== 'sorteado' || !modalidade.resultado) {
    const regra = matchMensagem(modalidade.mensagens_inscritos ?? [], modalidade.participantes.length)
    return (
      <div style={{ padding: 16, color: 'var(--t3)', fontStyle: 'italic' }}>
        {regra?.mensagem && <p style={{ margin: '0 0 8px' }}>{regra.mensagem}</p>}
        {regra?.pular_sorteio ? 'Não vai a sorteio (regra de inscritos).' : 'Aguardando sorteio'}
      </div>
    )
  }
  const { participantesById, campeoesByParticipanteId, subtituloLine } = buildMaps(modalidade)
  const anfitriaoPid = modalidade.anfitriaoId ?? null
  const cabecasPids = new Set(modalidade.cabecasPids)

  if (modalidade.tipo === 'grupos') {
    return (
      <SorteioGrupos
        resultado={modalidade.resultado as any}
        participantesById={participantesById}
        large
        campeoesByParticipanteId={campeoesByParticipanteId}
        anfitriaoPid={anfitriaoPid}
        subtituloLine={subtituloLine}
      />
    )
  }
  if (modalidade.tipo === 'chaves') {
    return (
      <SorteioChaves
        resultado={modalidade.resultado as any}
        participantesById={participantesById}
        large
        campeoesByParticipanteId={campeoesByParticipanteId}
        anfitriaoPid={anfitriaoPid}
        subtituloLine={subtituloLine}
        cabecasPids={cabecasPids}
      />
    )
  }
  if (modalidade.tipo === 'ordem_entrada') {
    return (
      <SorteioOrdem
        resultado={modalidade.resultado as any}
        participantesById={participantesById}
        large
        anfitriaoPid={anfitriaoPid}
        subtituloLine={subtituloLine}
      />
    )
  }
  return null
}
