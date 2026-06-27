import SiteNav from '../components/SiteNav'
import ModalidadeSorteio from '../components/ModalidadeSorteio'
import type { SnapEvento, SnapModalidade } from '../snapshot-types'
import { matchMensagem } from '../../lib/mensagens-inscritos'
import { esporteBase } from '../lib/esporte'
import { FileText, Download, Calendar } from 'lucide-react'
import { CATEGORIAS_BOLETIM, categoriaInfo, formatBytes, dataPtBr } from '../../lib/boletim-categorias'

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
          const ordenados = [...boletins].sort((a, b) => (+new Date(b.data) - +new Date(a.data)) || (b.numero - a.numero))
          const destaque = ordenados[0]
          const di = categoriaInfo(destaque.categoria)
          return (
            <section id="boletins-evento" className="section">
              <div className="sec-head">
                <div className="sec-eyebrow">Acompanhe</div>
                <h2>Boletins &amp; documentos</h2>
                <p>Boletins oficiais, regulamento e resultados publicados pela organização. Baixe sempre a versão mais recente.</p>
              </div>
              <div className="doc-layout">
                <aside className="doc-feature">
                  <div className="flag"><span className="dot" /> Último boletim</div>
                  <div className="big-pdf"><FileText /></div>
                  <span className={`badge ${di.badgeClass}`} style={{ marginBottom: 12 }}>{di.label}</span>
                  <h3>{destaque.titulo}</h3>
                  <div className="fmeta">
                    <span className="m"><Calendar /> {dataPtBr(destaque.data)}</span>
                    <span className="m"><FileText /> {formatBytes(destaque.tamanho)}</span>
                  </div>
                  <a className="btn btn-primary btn-lg btn-block" href={destaque.url} target="_blank" rel="noopener noreferrer"><Download /> Baixar PDF</a>
                </aside>
                <div className="doc-list">
                  {CATEGORIAS_BOLETIM.filter((c) => ordenados.some((b) => b.categoria === c.value)).map((c) => (
                    <div key={c.value} style={{ display: 'contents' }}>
                      <div className="doc-group-lbl">{c.grupo}</div>
                      {ordenados.filter((b) => b.categoria === c.value).map((b) => {
                        const info = categoriaInfo(b.categoria)
                        return (
                          <div className="doc-card" key={b.numero}>
                            <div className="pdf"><FileText /></div>
                            <div className="dc-main">
                              <div className="dc-num">Nº {String(b.numero).padStart(3, '0')}</div>
                              <div className="dc-title">{b.titulo}</div>
                              <div className="dc-meta"><span className={`badge ${info.badgeClass}`}>{info.label}</span><span className="sep" />{dataPtBr(b.data)}<span className="sep" />{formatBytes(b.tamanho)}</div>
                            </div>
                            <a className="dl" href={b.url} target="_blank" rel="noopener noreferrer"><Download /> Baixar</a>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )
        })()}
      </main>
    </>
  )
}
