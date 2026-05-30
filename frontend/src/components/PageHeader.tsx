import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

type Props = {
  title: string
  eyebrow?: string
  sub?: string
  actionLabel?: string
  actionTo?: string
  actions?: ReactNode
  backTo?: string
}

export default function PageHeader({ title, eyebrow, sub, actionLabel, actionTo, actions, backTo }: Props) {
  const navigate = useNavigate()
  return (
    <div className="flex items-end justify-between gap-5 flex-wrap px-6 py-5 border-b border-[var(--card-border)]">
      <div className="flex items-start gap-3">
        {backTo && (
          <button
            onClick={() => navigate(backTo)}
            className="text-[var(--t3)] hover:text-[var(--t1)] text-sm transition-colors mt-1"
          >
            ← Voltar
          </button>
        )}
        <div>
          {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
          <h1 className="page-h1">{title}</h1>
          {sub && <p className="muted mt-2 text-sm max-w-[560px]">{sub}</p>}
        </div>
      </div>
      <div className="flex gap-2.5">
        {actions}
        {actionLabel && actionTo && (
          <button
            onClick={() => navigate(actionTo)}
            className="btn btn-primary"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}
