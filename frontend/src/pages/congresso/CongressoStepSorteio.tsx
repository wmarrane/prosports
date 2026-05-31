import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inscricoesService } from '../../services/inscricoes'
import { modalidadesService } from '../../services/modalidades'
import { sorteiosService } from '../../services/sorteios'
import { campeoesAnterioresService } from '../../services/campeoes-anteriores'
import SorteioGrupos from '../../components/sorteio-result/SorteioGrupos'
import SorteioChaves from '../../components/sorteio-result/SorteioChaves'
import SorteioOrdem from '../../components/sorteio-result/SorteioOrdem'
import type { Participante } from '../../types/participante'

type Props = {
  eventoId: number
  modalidadeId: number
  competicaoId: number | undefined
  onProxima: () => void
}

const FG = 'var(--cw-fg)'
const DIM = 'var(--cw-dim)'
const DANGER = 'var(--danger)'

export default function CongressoStepSorteio({ eventoId, modalidadeId, competicaoId, onProxima }: Props) {
  const queryClient = useQueryClient()
  const [erro, setErro] = useState('')

  const { data: modalidades = [] } = useQuery({
    queryKey: ['modalidades', competicaoId],
    queryFn: () => modalidadesService.listar({ competicao_id: competicaoId! }),
    enabled: !!competicaoId,
  })
  const modalidade = modalidades.find(m => m.id === modalidadeId)
  const tipo = modalidade?.tipo_modalidade?.tipo

  const { data: sorteios = [] } = useQuery({
    queryKey: ['sorteios', eventoId],
    queryFn: () => sorteiosService.listar({ evento_id: eventoId }),
  })
  const sorteio = sorteios.find(s => s.modalidade_id === modalidadeId) ?? null

  const { data: inscricoes = [] } = useQuery({
    queryKey: ['inscricoes', eventoId, modalidadeId],
    queryFn: () => inscricoesService.listar({ evento_id: eventoId, modalidade_id: modalidadeId }),
  })

  const { data: campeoes = [] } = useQuery({
    queryKey: ['campeoes-anteriores', eventoId, modalidadeId],
    queryFn: () => campeoesAnterioresService.listar({ evento_id: eventoId, modalidade_id: modalidadeId }),
  })

  const participantesById = useMemo(() => {
    const m = new Map<number, Participante>()
    for (const i of inscricoes) m.set(i.participante_id, i.participante)
    return m
  }, [inscricoes])

  const campeoesByParticipanteId = useMemo(() => {
    const m = new Map<number, number>()
    for (const c of campeoes) m.set(c.participante_id, c.posicao)
    return m
  }, [campeoes])

  const { mutate: executar, isPending: executando } = useMutation({
    mutationFn: () => sorteiosService.executar({ evento_id: eventoId, modalidade_id: modalidadeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sorteios', eventoId] })
      setErro('')
    },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao sortear.'),
  })

  function handleSortear() {
    setErro('')
    executar()
  }

  function handleNovoSorteio() {
    if (confirm('Realizar novo sorteio? Isso vai sobrescrever o resultado atual com uma nova seed.')) {
      setErro('')
      executar()
    }
  }

  function formatDateBR(iso: string): string {
    try { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) }
    catch { return iso }
  }

  const proximaBtn = (
    <button
      onClick={onProxima}
      style={{
        background: 'var(--brand-500)',
        color: '#fff',
        border: 'none',
        borderRadius: 'var(--radius-lg)',
        padding: '12px 24px',
        fontSize: 16,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >Próxima modalidade →</button>
  )

  if (tipo === 'especifico') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center', gap: 16 }}>
          <div style={{ fontSize: 48 }}>📋</div>
          <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, letterSpacing: '-0.02em', color: FG }}>{modalidade?.nome}</h2>
          <p style={{ fontSize: 'clamp(16px, 1.5vw, 20px)', color: DIM, maxWidth: 600 }}>
            Esta modalidade é do tipo "Específico" — sem sorteio automático.
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12 }}>{proximaBtn}</div>
      </div>
    )
  }

  if (!sorteio) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center', gap: 24 }}>
          <h2 style={{ fontSize: 'clamp(28px, 3.4vw, 44px)', fontWeight: 800, letterSpacing: '-0.02em', color: FG }}>{modalidade?.nome}</h2>
          <p style={{ fontSize: 'clamp(16px, 1.4vw, 20px)', color: DIM }}>
            {inscricoes.length} {inscricoes.length === 1 ? 'inscrito' : 'inscritos'}
          </p>
          <button
            onClick={handleSortear}
            disabled={executando || inscricoes.length === 0}
            style={{
              background: 'var(--brand-500)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-xl)',
              padding: '20px 48px',
              fontSize: 'clamp(18px, 1.7vw, 24px)',
              fontWeight: 700,
              cursor: 'pointer',
              opacity: (executando || inscricoes.length === 0) ? 0.5 : 1,
            }}
          >{executando ? '🎲 Sorteando...' : '🎲 Realizar sorteio'}</button>
          {inscricoes.length === 0 && (
            <p style={{ color: DIM, fontSize: 14 }}>Adicione participantes antes de sortear.</p>
          )}
          {erro && <p style={{ color: DANGER, fontSize: 16 }}>{erro}</p>}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 'clamp(22px, 2.6vw, 32px)', fontWeight: 800, letterSpacing: '-0.02em', color: FG }}>{modalidade?.nome}</h2>
          <div style={{ fontSize: 13, color: DIM, marginTop: 4 }}>
            seed: <span style={{ fontFamily: 'monospace' }}>{sorteio.seed}</span> · gerado em {formatDateBR(sorteio.gerado_em)}
          </div>
        </div>
        <button
          onClick={handleNovoSorteio}
          disabled={executando}
          style={{
            background: 'transparent',
            color: 'var(--brand-500)',
            border: '1px solid var(--brand-500)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            opacity: executando ? 0.5 : 1,
          }}
        >{executando ? 'Sorteando...' : 'Novo sorteio'}</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {sorteio.tipo === 'grupos' && (
          <SorteioGrupos resultado={sorteio.resultado} participantesById={participantesById} large campeoesByParticipanteId={campeoesByParticipanteId} />
        )}
        {sorteio.tipo === 'chaves' && (
          <SorteioChaves resultado={sorteio.resultado} participantesById={participantesById} large campeoesByParticipanteId={campeoesByParticipanteId} />
        )}
        {sorteio.tipo === 'ordem_entrada' && (
          <SorteioOrdem resultado={sorteio.resultado} participantesById={participantesById} large campeoesByParticipanteId={campeoesByParticipanteId} />
        )}
        {erro && <p style={{ color: DANGER, fontSize: 16, marginTop: 12 }}>{erro}</p>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 16 }}>{proximaBtn}</div>
    </div>
  )
}
