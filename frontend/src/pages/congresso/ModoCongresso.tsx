import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import CongressoShell from './CongressoShell'
import CongressoStepEvento from './CongressoStepEvento'
import CongressoStepModalidade from './CongressoStepModalidade'
import CongressoStepParticipantes from './CongressoStepParticipantes'
import CongressoStepSorteio from './CongressoStepSorteio'
import { eventosService } from '../../services/eventos'
import { modalidadesService } from '../../services/modalidades'
import type { CongressoStep } from '../../types/congresso-step'

export default function ModoCongresso() {
  const [step, setStep] = useState<CongressoStep>('evento')
  const [eventoId, setEventoId] = useState<number | null>(null)
  const [modalidadeId, setModalidadeId] = useState<number | null>(null)

  const { data: evento } = useQuery({
    queryKey: ['eventos', eventoId],
    queryFn: () => eventosService.buscar(eventoId!),
    enabled: eventoId != null,
  })
  const competicaoId = evento?.competicao_id

  const { data: modalidades = [] } = useQuery({
    queryKey: ['modalidades', competicaoId],
    queryFn: () => modalidadesService.listar({ competicao_id: competicaoId! }),
    enabled: !!competicaoId,
  })
  const modalidade = modalidades.find(m => m.id === modalidadeId)
  const tipoAtual = modalidade?.tipo_modalidade?.tipo

  function voltarParaModalidade() {
    setModalidadeId(null)
    setStep('modalidade')
  }

  function handleBack() {
    if (step === 'sorteio') setStep('participantes')
    else if (step === 'participantes') voltarParaModalidade()
    else if (step === 'modalidade') { setStep('evento'); setEventoId(null) }
  }

  const onBack = step !== 'evento' ? handleBack : undefined

  // Próximo step após Participantes — varia por tipo de modalidade.
  // Campeões viraram parte do Sorteio (idle state), por isso step dedicado removido.
  function nextAfterParticipantes() {
    if (tipoAtual === 'especifico') {
      // Sem sorteio — volta direto pra próxima modalidade
      voltarParaModalidade()
    } else {
      // grupos / chaves / ordem_entrada — Sorteio (com campeões inline quando aplicável)
      setStep('sorteio')
    }
  }

  const contexto = {
    evento: evento?.nome,
    modalidade: modalidade ? `${modalidade.nome} (${modalidade.sigla})` : undefined,
  }

  return (
    <CongressoShell step={step} onBack={onBack} contexto={contexto}>
      {step === 'evento' && (
        <CongressoStepEvento
          onSelect={(id) => { setEventoId(id); setStep('modalidade') }}
        />
      )}
      {step === 'modalidade' && eventoId != null && (
        <CongressoStepModalidade
          eventoId={eventoId}
          onSelect={(id) => { setModalidadeId(id); setStep('participantes') }}
        />
      )}
      {step === 'participantes' && eventoId != null && modalidadeId != null && (
        <CongressoStepParticipantes
          eventoId={eventoId}
          modalidadeId={modalidadeId}
          competicaoId={competicaoId}
          onNext={nextAfterParticipantes}
        />
      )}
      {step === 'sorteio' && eventoId != null && modalidadeId != null && (
        <CongressoStepSorteio
          eventoId={eventoId}
          modalidadeId={modalidadeId}
          competicaoId={competicaoId}
          onProxima={voltarParaModalidade}
        />
      )}
    </CongressoShell>
  )
}
