import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import CongressoShell from './CongressoShell'
import CongressoStepEvento from './CongressoStepEvento'
import CongressoStepModalidade from './CongressoStepModalidade'
import CongressoStepParticipantes from './CongressoStepParticipantes'
import CongressoStepSorteio from './CongressoStepSorteio'
import { eventosService } from '../../services/eventos'
import type { CongressoStep } from '../../types/congresso-step'
import { addVista, loadVistas, saveVistas } from '../../lib/congresso-vistas'

export default function ModoCongresso() {
  const [step, setStep] = useState<CongressoStep>('evento')
  const [eventoId, setEventoId] = useState<number | null>(null)
  const [modalidadeId, setModalidadeId] = useState<number | null>(null)
  const [vistas, setVistas] = useState<number[]>([])

  useEffect(() => {
    if (eventoId != null) setVistas(loadVistas(eventoId))
    else setVistas([])
  }, [eventoId])

  const vistasIds = useMemo(() => new Set(vistas), [vistas])

  const { data: evento } = useQuery({
    queryKey: ['eventos', eventoId],
    queryFn: () => eventosService.buscar(eventoId!),
    enabled: eventoId != null,
  })
  const competicaoId = evento?.competicao_id

  const { data: modalidades = [] } = useQuery({
    queryKey: ['evento-modalidades', eventoId],
    queryFn: () => eventosService.getModalidadesDoEvento(eventoId!),
    enabled: eventoId != null,
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
  function nextAfterParticipantes(opts?: { pularSorteio?: boolean }) {
    if (opts?.pularSorteio || tipoAtual === 'especifico') {
      // Sem sorteio (específico ou sorteio pulado por inscritos insuficientes):
      // a apresentação termina aqui — marca como vista (persistido).
      if (eventoId != null && modalidadeId != null) {
        const next = addVista(vistas, modalidadeId)
        setVistas(next)
        saveVistas(eventoId, next)
      }
      // Volta direto pra próxima modalidade
      voltarParaModalidade()
    } else {
      // grupos / chaves / ordem_entrada — Sorteio (com campeões inline quando aplicável)
      setStep('sorteio')
    }
  }

  function pularModalidadeVazia(id: number) {
    if (eventoId == null) return
    const next = addVista(vistas, id)
    setVistas(next)
    saveVistas(eventoId, next)
  }

  const contexto = {
    evento: evento?.nome,
    modalidade: modalidade ? `${modalidade.nome} (${modalidade.sigla})` : undefined,
  }

  return (
    <CongressoShell step={step} onBack={onBack} contexto={contexto} eventoLogoUrl={evento?.logo_url ?? null}>
      {step === 'evento' && (
        <CongressoStepEvento
          onSelect={(id) => { setEventoId(id); setStep('modalidade') }}
        />
      )}
      {step === 'modalidade' && eventoId != null && (
        <CongressoStepModalidade
          eventoId={eventoId}
          onSelect={(id) => { setModalidadeId(id); setStep('participantes') }}
          vistasIds={vistasIds}
          onPularVazia={pularModalidadeVazia}
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
