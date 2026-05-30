import { useEffect } from 'react'
import PageHeader from '../components/PageHeader'
import { useChangelog } from '../lib/use-changelog'
import { useNovidades } from '../lib/use-novidades'
import { APP_VERSION, APP_COMMIT, APP_BUILT_AT } from '../lib/version'
import type { ChangelogSection } from '../lib/changelog'

const SECTION_LABEL: Record<ChangelogSection, string> = {
  Added: 'Adicionado',
  Changed: 'Alterado',
  Fixed: 'Corrigido',
  Removed: 'Removido',
}

const SECTION_COLOR: Record<ChangelogSection, string> = {
  Added: 'text-[var(--success)]',
  Changed: 'text-[var(--warn)]',
  Fixed: 'text-[var(--info)]',
  Removed: 'text-[var(--danger)]',
}

const SECTION_ORDER: ChangelogSection[] = ['Added', 'Changed', 'Fixed', 'Removed']

export default function Novidades() {
  const { marcarComoVisto } = useNovidades()
  const { data: releases, isLoading, error } = useChangelog()

  useEffect(() => {
    marcarComoVisto()
  }, [marcarComoVisto])

  const builtAt = (() => {
    try { return new Date(APP_BUILT_AT).toLocaleString('pt-BR') } catch { return APP_BUILT_AT }
  })()

  return (
    <div className="text-[var(--t1)]">
      <PageHeader title="Novidades" />
      <div className="p-6 max-w-3xl space-y-6">
        <div className="text-xs text-[var(--t3)]">
          Versão atual: <span className="text-[var(--t2)]">v{APP_VERSION}</span>
          {' · '}commit <span className="text-[var(--t2)]">{APP_COMMIT}</span>
          {' · '}build {builtAt}
        </div>

        {isLoading && <p className="text-[var(--t3)] text-sm">Carregando...</p>}
        {error && <p className="text-[var(--danger)] text-sm">Não foi possível carregar o changelog.</p>}

        {releases && releases.length === 0 && (
          <p className="text-[var(--t3)] text-sm">Nenhum release registrado ainda.</p>
        )}

        <div className="space-y-6">
          {releases?.map((r) => (
            <article key={r.version} className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg p-5">
              <header className="flex items-baseline justify-between mb-3">
                <h2 className="text-lg font-semibold text-[var(--t1)]">v{r.version}</h2>
                <span className="text-xs text-[var(--t3)]">{r.date}</span>
              </header>
              <div className="space-y-3">
                {SECTION_ORDER.map((sec) => {
                  const items = r.sections[sec]
                  if (!items || items.length === 0) return null
                  return (
                    <div key={sec}>
                      <h3 className={`text-xs font-semibold uppercase tracking-wider ${SECTION_COLOR[sec]} mb-1`}>
                        {SECTION_LABEL[sec]}
                      </h3>
                      <ul className="list-disc list-inside text-sm text-[var(--t2)] space-y-1">
                        {items.map((item, i) => <li key={i}>{item}</li>)}
                      </ul>
                    </div>
                  )
                })}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
