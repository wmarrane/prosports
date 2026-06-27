import SiteNav from '../components/SiteNav'
import ModalidadeSorteio from '../components/ModalidadeSorteio'
import type { SnapEvento, SnapModalidade } from '../snapshot-types'
import { matchMensagem } from '../../lib/mensagens-inscritos'
import { esporteBase } from '../lib/esporte'

function categoriaDe(m: SnapModalidade): string {
  if (m.grupo) return m.grupo
  return esporteBase(m.nome)
}

function inscritosOrdenados(m: SnapModalidade): SnapModalidade['participantes'] {
  return [...m.participantes].sort((a, b) =>
    (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR', { sensitivity: 'base' }))
}

function statusLabel(m: SnapModalidade): string {
  if (m.tipo === 'especifico') return 'específico'
  if (m.status === 'sorteado') return 'sorteado'
  const regra = matchMensagem(m.mensagens_inscritos ?? [], m.participantes.length)
  return regra?.pular_sorteio ? 'sem sorteio' : 'aguardando'
}

export default function EventoPage({ evento }: { evento: SnapEvento }) {
  const abrir = evento.modalidades.length <= 10
  const cats = new Map<string, SnapModalidade[]>()
  for (const m of evento.modalidades) {
    const c = categoriaDe(m); const arr = cats.get(c) ?? []; arr.push(m); cats.set(c, arr)
  }
  const boletins = evento.boletins ?? []
  return (
    <>
      <SiteNav active="eventos" />
      <main className="evento-page">
        <header className="evento-header">
          <h1>{evento.nome}</h1>
          <p>{evento.cidade} · {evento.local} · {new Date(evento.data).toLocaleDateString('pt-BR')}</p>
          {evento.dataInicio && (
            <p className="evento-periodo">
              {new Date(evento.dataInicio).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
              {evento.dataFim ? ` a ${new Date(evento.dataFim).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}` : ''}
            </p>
          )}
        </header>
        {[...cats.entries()].map(([cat, mods]) => (
          <section className="cat-section" key={cat}>
            <h2 className="cat-head">{cat} <span>{mods.length}</span></h2>
            {mods.map((m) => (
              <details className="mod-acc" open={abrir} key={m.id} id={`mod-${m.id}`}>
                <summary>
                  <strong>{m.nome}</strong>
                  <div className="mod-sub">
                    <span className="mod-meta">{m.tipo} · {m.participantes.length} inscritos · {statusLabel(m)}</span>
                    {m.seed && <span className="mod-seed">semente {m.seed}</span>}
                  </div>
                </summary>
                <div className="mod-body">
                  <ModalidadeSorteio modalidade={m} />
                  <section className="inscritos">
                    <h4>Inscritos ({m.participantes.length})</h4>
                    <ul>{inscritosOrdenados(m).map(p => <li key={p.id}>{p.nome}{p.subtitulo ? ` — ${p.subtitulo}` : ''}</li>)}</ul>
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
        {boletins.length > 0 && (() => {
          const ordenados = [...boletins].sort((a, b) => b.numero - a.numero)
          const categorias = [...new Set(ordenados.map(b => b.categoria))]
          return (
            <section id="boletins-evento" className="boletins">
              <h2>Boletins</h2>
              <div className="boletins-filtros">
                <button className="bol-chip is-active" data-cat="">Todos</button>
                {categorias.map(c => <button className="bol-chip" data-cat={c} key={c}>{c}</button>)}
              </div>
              <ul className="boletins-lista">
                {ordenados.map(b => (
                  <li className="boletim-row" data-cat={b.categoria} key={b.numero}>
                    <a href={b.url} target="_blank" rel="noopener noreferrer">
                      <span className="boletim-num">{String(b.numero).padStart(2, '0')}</span>
                      <span className="boletim-main">
                        <span className="boletim-titulo">{b.titulo}</span>
                        <span className="boletim-meta"><span className="boletim-cat">{b.categoria}</span> · {new Date(b.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                      </span>
                      <span className="boletim-dl" aria-hidden="true">⬇</span>
                    </a>
                  </li>
                ))}
              </ul>
              <script dangerouslySetInnerHTML={{ __html:
                "(function(){var s=document.getElementById('boletins-evento');if(!s)return;" +
                "s.querySelectorAll('.bol-chip').forEach(function(c){c.addEventListener('click',function(){" +
                "var cat=c.getAttribute('data-cat');" +
                "s.querySelectorAll('.bol-chip').forEach(function(x){x.classList.toggle('is-active',x===c)});" +
                "s.querySelectorAll('.boletim-row').forEach(function(r){r.style.display=(!cat||r.getAttribute('data-cat')===cat)?'':'none'});" +
                "})})})();"
              }} />
            </section>
          )
        })()}
      </main>
    </>
  )
}
