import { useState } from 'react'
import { X, Check, Trash2, AlertTriangle } from '../lib/icons'

type IconKind = 'trash' | 'alert'
type ConfirmVariant = 'danger' | 'primary'

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  description?: string
  eyebrow?: string
  confirmLabel?: string
  cancelLabel?: string
  confirmVariant?: ConfirmVariant
  icon?: IconKind
}

const ICON_GRADIENT: Record<IconKind, string> = {
  trash: 'linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)',
  alert: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  eyebrow = 'Confirmar ação',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmVariant = 'danger',
  icon = 'trash',
}: Props) {
  const [pending, setPending] = useState(false)

  if (!open) return null

  const Icon = icon === 'trash' ? Trash2 : AlertTriangle

  async function handleConfirm() {
    if (pending) return
    setPending(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setPending(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
      }}
      onClick={pending ? undefined : onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-xl)',
          padding: 28,
          maxWidth: 480,
          width: '92%',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div className="flex items-center gap-3" style={{ marginBottom: 20 }}>
          <div
            style={{
              width: 40, height: 40, borderRadius: 10,
              background: ICON_GRADIENT[icon],
              color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0,
            }}
          >
            <Icon size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="eyebrow">{eyebrow}</div>
            <h3
              className="sec-title"
              style={{
                fontSize: 17,
                lineHeight: 1.35,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={title}
            >
              {title}
            </h3>
          </div>
        </div>

        {description && (
          <p
            className="text-[var(--t2)]"
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              marginBottom: 24,
              whiteSpace: 'pre-line',
            }}
          >
            {description}
          </p>
        )}

        <div className="flex justify-end" style={{ gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="btn btn-ghost"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: pending ? 0.5 : 1 }}
          >
            <X size={16} /> {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              opacity: pending ? 0.5 : 1,
              ...(confirmVariant === 'danger'
                ? { background: 'var(--danger)', boxShadow: 'none' }
                : {}),
            }}
          >
            {confirmVariant === 'danger' ? <Trash2 size={16} /> : <Check size={16} />}
            {pending ? 'Processando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
