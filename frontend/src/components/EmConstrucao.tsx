import PageHeader from './PageHeader'
import { Construction } from '../lib/icons'

type Props = {
  titulo: string
  eyebrow?: string
  sub?: string
  fase?: string
}

export default function EmConstrucao({ titulo, eyebrow, sub, fase }: Props) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={titulo} sub={sub} />
      <div className="p-6">
        <div className="card mx-auto max-w-[560px] p-10 text-center">
          <Construction size={48} className="mx-auto" style={{ color: 'var(--brand-500)' }} />
          <h2 className="mt-4 text-xl font-bold text-[var(--t1)]">Em construção</h2>
          <p className="mt-2 text-sm text-[var(--t3)]">
            Esta seção será implementada na próxima fase do roadmap.
          </p>
          {fase && <span className="eyebrow mt-4 inline-block">Fase {fase}</span>}
        </div>
      </div>
    </>
  )
}
