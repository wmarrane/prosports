import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import CongressoShell from './CongressoShell'
import CongressoStepEvento from './CongressoStepEvento'
import CongressoStepModalidade from './CongressoStepModalidade'
import CongressoStepParticipantes from './CongressoStepParticipantes'
import CongressoStepSorteio from './CongressoStepSorteio'
import { eventosService } from '../../services/eventos'
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

  function handleBack() {
    if (step === 'sorteio') setStep('participantes')
    else if (step === 'participantes') setStep('modalidade')
    else if (step === 'modalidade') { setStep('evento'); setEventoId(null) }
  }

  const onBack = step !== 'evento' ? handleBack : undefined

  return (
    <CongressoShell step={step} onBack={onBack}>
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
          onNext={() => setStep('sorteio')}
        />
      )}
      {step === 'sorteio' && eventoId != null && modalidadeId != null && (
        <CongressoStepSorteio
          eventoId={eventoId}
          modalidadeId={modalidadeId}
          competicaoId={competicaoId}
          onProxima={() => { setModalidadeId(null); setStep('modalidade') }}
        />
      )}
    </CongressoShell>
  )
}
