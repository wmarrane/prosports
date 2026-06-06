import SorteioGrupos from '../../components/sorteio-result/SorteioGrupos'
import SorteioChaves from '../../components/sorteio-result/SorteioChaves'
import SorteioOrdem from '../../components/sorteio-result/SorteioOrdem'
import type { Participante } from '../../types/participante'
import type { SnapModalidade } from '../snapshot-types'

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
  if (modalidade.status !== 'sorteado' || !modalidade.resultado) {
    return <div style={{ padding: 16, color: 'var(--t3)', fontStyle: 'italic' }}>Aguardando sorteio</div>
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
  return <div style={{ padding: 16, color: 'var(--t3)' }}>Emparceiramento específico</div>
}
