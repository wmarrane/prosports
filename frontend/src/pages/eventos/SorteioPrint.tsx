import { createPortal } from 'react-dom'
import LogoMontana from '../../components/LogoMontana'
import SorteioGrupos from '../../components/sorteio-result/SorteioGrupos'
import SorteioChaves from '../../components/sorteio-result/SorteioChaves'
import SorteioOrdem from '../../components/sorteio-result/SorteioOrdem'
import type { Participante } from '../../types/participante'

type Props = {
  eventoNome: string
  anfitriao: string
  modalidadeNome: string
  modalidadeTipo: 'grupos' | 'chaves' | 'ordem_entrada' | 'especifico' | undefined
  sigla: string
  cidadeLocalData: string
  seed: string
  resultado: any
  participantesById: Map<number, Participante>
  campeoesByParticipanteId: Map<number, number>
  anfitriaoPid: number | null
  subtituloLine: (p: Participante) => string | null
  inscritos: { id: number; nome: string }[]
  campeoes: { posicao: number; nome: string }[]
  // Quando true, não renderiza o cabeçalho do evento (usado no export HTML,
  // onde o cabeçalho aparece uma única vez no topo do documento).
  omitEventoHeader?: boolean
}

export function SorteioPrintHeader(p: { eventoNome: string; anfitriao: string; cidadeLocalData: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderBottom: '2px solid #156082', paddingBottom: 12, marginBottom: 16 }}>
      <LogoMontana variant="simbolo" height={56} />
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{p.eventoNome}</div>
        <div style={{ fontSize: 13, color: '#475569' }}>Cidade Sede: <b>{p.anfitriao}</b></div>
        <div style={{ fontSize: 13, color: '#475569' }}>{p.cidadeLocalData}</div>
      </div>
    </div>
  )
}

export function SorteioPrintContent(p: Props) {
  const cabecas = p.modalidadeTipo === 'grupos' && p.resultado
    ? (p.resultado as { grupos: { letra: string; participantes: number[] }[] }).grupos
        .map(g => ({ pid: g.participantes[0], letra: g.letra }))
        .filter(g => g.pid != null && (p.campeoesByParticipanteId.has(g.pid) || g.pid === p.anfitriaoPid))
        .map((g, i) => ({ ordem: i + 1, nome: p.participantesById.get(g.pid)?.nome ?? '—', letra: g.letra }))
    : []

  return (
    <div className="sorteio-print">
      {!p.omitEventoHeader && (
        <SorteioPrintHeader eventoNome={p.eventoNome} anfitriao={p.anfitriao} cidadeLocalData={p.cidadeLocalData} />
      )}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{p.modalidadeNome} <span style={{ color: '#475569', fontWeight: 600 }}>({p.sigla})</span></div>
        {p.seed && <div style={{ fontSize: 12, color: '#475569' }}>seed: <span style={{ fontFamily: 'monospace' }}>{p.seed}</span></div>}
      </div>

      {cabecas.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Cabeças</div>
          <ol style={{ margin: 0, paddingLeft: 18, color: '#1e293b', fontSize: 12 }}>
            {cabecas.map(c => <li key={c.ordem}>{c.nome} - Grupo {c.letra}</li>)}
          </ol>
        </div>
      )}
      {p.modalidadeTipo === 'grupos' && p.resultado && (
        <SorteioGrupos resultado={p.resultado} participantesById={p.participantesById} campeoesByParticipanteId={p.campeoesByParticipanteId} anfitriaoPid={p.anfitriaoPid} subtituloLine={p.subtituloLine} />
      )}
      {p.modalidadeTipo === 'chaves' && p.resultado && (
        <SorteioChaves resultado={p.resultado} participantesById={p.participantesById} campeoesByParticipanteId={p.campeoesByParticipanteId} anfitriaoPid={p.anfitriaoPid} subtituloLine={p.subtituloLine} />
      )}
      {p.modalidadeTipo === 'ordem_entrada' && p.resultado && (
        <SorteioOrdem resultado={p.resultado} participantesById={p.participantesById} anfitriaoPid={p.anfitriaoPid} subtituloLine={p.subtituloLine} />
      )}

      {p.campeoes.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Campeões do ano anterior</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: '#1e293b', fontSize: 12 }}>
            {p.campeoes.map((c, i) => <li key={i}>{c.posicao}º {c.nome}</li>)}
          </ul>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Inscritos ({p.inscritos.length})</div>
        <ul style={{ margin: 0, paddingLeft: 18, color: '#1e293b', fontSize: 12, columns: 2 }}>
          {p.inscritos.map((i) => <li key={i.id}>{i.nome}</li>)}
        </ul>
      </div>
    </div>
  )
}

export default function SorteioPrint(p: Props) {
  // Renderiza via portal no <body> para o print isolar com display:none nos
  // demais filhos do body. No SSR (renderToStaticMarkup, sem document) retorna inline.
  const content = <SorteioPrintContent {...p} />
  if (typeof document !== 'undefined' && document.body) {
    return createPortal(content, document.body)
  }
  return content
}
