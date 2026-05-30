import type { ReactNode } from 'react'

type Column<T> = {
  header: string
  accessor: (row: T) => ReactNode
  className?: string
}

type Props<T> = {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T) => string | number
  emptyMessage?: string
}

export default function DataTable<T>({ columns, data, keyExtractor, emptyMessage = 'Nenhum registro encontrado.' }: Props<T>) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--t3)] text-sm">{emptyMessage}</div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-[var(--card-border)]">
            {columns.map((col) => (
              <th key={col.header} className={`px-4 py-3 text-xs font-semibold text-[var(--t3)] uppercase tracking-wider ${col.className ?? ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={keyExtractor(row)} className="border-b border-[var(--card-border)] hover:bg-[var(--card-bg-2)]/50 transition-colors">
              {columns.map((col) => (
                <td key={col.header} className={`px-4 py-3 text-[var(--t2)] ${col.className ?? ''}`}>
                  {col.accessor(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
