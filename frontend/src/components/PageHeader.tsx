import { useNavigate } from 'react-router-dom'

type Props = {
  title: string
  actionLabel?: string
  actionTo?: string
  backTo?: string
}

export default function PageHeader({ title, actionLabel, actionTo, backTo }: Props) {
  const navigate = useNavigate()
  return (
    <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
      <div className="flex items-center gap-3">
        {backTo && (
          <button
            onClick={() => navigate(backTo)}
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            ← Voltar
          </button>
        )}
        <h1 className="text-xl font-semibold text-white">{title}</h1>
      </div>
      {actionLabel && actionTo && (
        <button
          onClick={() => navigate(actionTo)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
