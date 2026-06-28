import type { TipoDisputa } from '../../types/modalidade'
import { Brackets, Group, ListOrdered, FileText } from 'lucide-react'

const TIPO_GRAD: Record<TipoDisputa, string> = {
  chaves: 'var(--grad-brand)', grupos: 'var(--grad-accent)', ordem_entrada: 'var(--grad-violet)', especifico: 'var(--grad-warn)',
}
const TIPO_ICON: Record<TipoDisputa, typeof Brackets> = {
  chaves: Brackets, grupos: Group, ordem_entrada: ListOrdered, especifico: FileText,
}
const TIPO_LABEL: Record<TipoDisputa, string> = {
  chaves: 'Chaves', grupos: 'Grupos', ordem_entrada: 'Ordem de entrada', especifico: 'Específico',
}

export interface ModEdicaoItem { id: number; nome: string; tipo: TipoDisputa }

export interface ModalidadesDaEdicaoProps {
  modalidades: ModEdicaoItem[]
  excluidas: Set<number>
  onToggle: (id: number) => void
  bloqueadas?: Set<number>
}

export default function ModalidadesDaEdicao({ modalidades, excluidas, onToggle, bloqueadas }: ModalidadesDaEdicaoProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {modalidades.map((m) => {
        const off = excluidas.has(m.id)
        const blocked = bloqueadas?.has(m.id) ?? false
        const Ic = TIPO_ICON[m.tipo]
        return (
          <div className="evx-mod" data-off={off} key={m.id}>
            <div className="evx-mod-ic" style={{ background: TIPO_GRAD[m.tipo] }}><Ic size={18} /></div>
            <div className="evx-mod-main">
              <div className="evx-mod-name">{m.nome}</div>
              <div className="evx-mod-sub">{TIPO_LABEL[m.tipo]}</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={blocked ? true : !off}
              aria-label={`${off ? 'Ativar' : 'Desativar'} ${m.nome} nesta edição`}
              className={`switch${blocked || !off ? ' on' : ''}`}
              disabled={blocked}
              title={blocked ? 'Tem inscritos ou sorteio — não pode ser desativada nesta edição.' : undefined}
              style={blocked ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              onClick={blocked ? undefined : () => onToggle(m.id)}
            >
              <span className="knob" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
