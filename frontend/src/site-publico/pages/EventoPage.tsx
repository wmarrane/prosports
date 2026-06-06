import SiteNav from '../components/SiteNav'
import ModalidadeSorteio from '../components/ModalidadeSorteio'
import type { SnapEvento, SnapModalidade } from '../snapshot-types'

function categoriaDe(m: SnapModalidade): string {
  if (m.grupo) return m.grupo
  const idx = m.nome.indexOf('·')
  return idx > 0 ? m.nome.slice(0, idx).trim() : m.nome.split(' ')[0]
}

export default function EventoPage({ evento }: { evento: SnapEvento }) {
  const abrir = evento.modalidades.length <= 10
  const cats = new Map<string, SnapModalidade[]>()
  for (const m of evento.modalidades) {
    const c = categoriaDe(m); const arr = cats.get(c) ?? []; arr.push(m); cats.set(c, arr)
  }
  return (
    <>
      <SiteNav active="eventos" />
      <main className="evento-page">
        <header className="evento-header">
          <h1>{evento.nome}</h1>
          <p>{evento.cidade} · {evento.local} · {new Date(evento.data).toLocaleDateString('pt-BR')}</p>
        </header>
        {[...cats.entries()].map(([cat, mods]) => (
          <section className="cat-section" key={cat}>
            <h2 className="cat-head">{cat} <span>{mods.length}</span></h2>
            {mods.map((m) => (
              <details className="mod-acc" open={abrir} key={m.id} id={`mod-${m.id}`}>
                <summary>
                  <strong>{m.nome}</strong>
                  <span className="mod-meta">{m.tipo} · {m.participantes.length} inscritos · {m.status}</span>
                  {m.seed && <span className="mod-seed">semente {m.seed}</span>}
                </summary>
                <div className="mod-body">
                  <ModalidadeSorteio modalidade={m} />
                  <section className="inscritos">
                    <h4>Inscritos ({m.participantes.length})</h4>
                    <ul>{m.participantes.map(p => <li key={p.id}>{p.nome}{p.subtitulo ? ` — ${p.subtitulo}` : ''}</li>)}</ul>
                  </section>
                  {m.campeoes.length > 0 && (
                    <section className="campeoes">
                      <h4>Campeões do ano anterior</h4>
                      <ul>{m.campeoes.map(c => {
                        const p = m.participantes.find(x => x.id === c.participanteId)
                        return <li key={c.participanteId}>{c.posicao}º {p?.nome ?? '—'}</li>
                      })}</ul>
                    </section>
                  )}
                </div>
              </details>
            ))}
          </section>
        ))}
      </main>
    </>
  )
}
