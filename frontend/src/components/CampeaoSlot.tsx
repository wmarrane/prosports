import { useState } from 'react'
import ParticipanteSelect from './ParticipanteSelect'
import CampeaoBadge from './CampeaoBadge'
import type { CampeaoAnterior } from '../types/campeao-anterior'

function posicaoLabel(n: number): string { return `${n}º lugar` }

type Props = {
  posicao: number
  campeao: CampeaoAnterior | null
  excludeIds: number[]
  onCriar: (participante_id: number) => void
  onRemover: (id: number) => void
  salvando: boolean
  subtituloLine?: (p: { subtitulo: string | null; municipio: any; inspetoria: any; delegacia: any }) => string | null
}

export default function CampeaoSlot({ posicao, campeao, excludeIds, onCriar, onRemover, salvando, subtituloLine }: Props) {
  const [pickedId, setPickedId] = useState<number | null>(null)

  if (campeao) {
    return (
      <div className="border border-[var(--card-border)] rounded-lg p-3 bg-[var(--card-bg-2)]">
        <div className="flex items-center gap-2 mb-2">
          <CampeaoBadge posicao={posicao} />
          <span className="text-xs text-[var(--t3)]">{posicaoLabel(posicao)}</span>
        </div>
        <div className="text-sm text-[var(--t1)]">{campeao.participante.nome}</div>
        {(() => { const l = subtituloLine?.(campeao.participante as any); return l ? (
          <div className="text-xs text-[var(--t3)] mt-0.5">{l}</div>
        ) : null })()}
        <button
          onClick={() => { if (confirm(`Remover ${posicaoLabel(posicao)}?`)) onRemover(campeao.id) }}
          className="mt-2 text-xs text-[var(--danger)] hover:text-[var(--danger-700)]"
        >Remover</button>
      </div>
    )
  }

  return (
    <div className="border border-[var(--card-border)] rounded-lg p-3 bg-[var(--card-bg-2)] space-y-2">
      <div className="flex items-center gap-2">
        <CampeaoBadge posicao={posicao} />
        <span className="text-xs text-[var(--t3)]">{posicaoLabel(posicao)}</span>
      </div>
      <ParticipanteSelect value={pickedId} onChange={(id) => setPickedId(id)} excludeIds={excludeIds} />
      <button
        onClick={() => { if (pickedId) { onCriar(pickedId); setPickedId(null) } }}
        disabled={!pickedId || salvando}
        className="btn btn-primary btn-sm disabled:opacity-50 text-xs"
      >{salvando ? 'Salvando...' : 'Salvar'}</button>
    </div>
  )
}
