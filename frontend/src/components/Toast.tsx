import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { CheckCircle2, XCircle, X } from '../lib/icons'

type ToastKind = 'success' | 'error'

type ToastItem = {
  id: number
  kind: ToastKind
  message: string
}

type ToastApi = {
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const DURATION_MS = 3500

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random()
    setItems((prev) => [...prev, { id, kind, message }])
  }, [])

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const api: ToastApi = {
    success: (m) => push('success', m),
    error: (m) => push('error', m),
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 100,
          pointerEvents: 'none',
        }}
      >
        {items.map((t) => (
          <ToastItemView key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItemView({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, DURATION_MS)
    return () => clearTimeout(t)
  }, [onDismiss])

  const isSuccess = item.kind === 'success'
  const Icon = isSuccess ? CheckCircle2 : XCircle
  const color = isSuccess ? 'var(--success, #10b981)' : 'var(--danger)'

  return (
    <div
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderLeft: `3px solid ${color}`,
        borderRadius: 'var(--radius-lg)',
        padding: '10px 14px',
        boxShadow: 'var(--shadow-card)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minWidth: 260,
        maxWidth: 380,
        color: 'var(--t1)',
        fontSize: 13,
        pointerEvents: 'auto',
      }}
    >
      <Icon size={18} style={{ color, flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{item.message}</span>
      <button
        onClick={onDismiss}
        aria-label="Fechar"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--t3)',
          cursor: 'pointer',
          display: 'inline-flex',
          padding: 2,
        }}
      >
        <X size={14} />
      </button>
    </div>
  )
}
