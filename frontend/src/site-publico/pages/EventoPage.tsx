import SiteNav from '../components/SiteNav'
import ModalidadeSorteio from '../components/ModalidadeSorteio'
import BracketView from '../components/BracketView'
import type { SnapEvento, SnapModalidade } from '../snapshot-types'
import { matchMensagem } from '../../lib/mensagens-inscritos'
import { esporteBase } from '../lib/esporte'
import { Trophy, Calendar, MapPin, Clock, Building2, Download, Share2, GitFork, Grid2x2, ListOrdered, List, FileText } from 'lucide-react'
import { CATEGORIAS_BOLETIM, categoriaInfo, formatBytes, dataPtBr } from '../../lib/boletim-categorias'
import { TIPO_INFO, tiposPresentes, progressoSorteios, inscritos, modalidadesDistintas, type TipoSorteio } from '../lib/evento-stats'
import { statusPublico } from '../lib/status-evento'

const TIPO_ICON: Record<TipoSorteio, typeof GitFork> = { chaves: GitFork, grupos: Grid2x2, ordem_entrada: ListOrdered, especifico: List }

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

const temChave = (m: SnapModalidade) => m.tipo === 'chaves' && m.status === 'sorteado' && !!(m.resultado as any)?.matchesGraph?.matches?.length

export default function EventoPage({ evento }: { evento: SnapEvento }) {
  const abrir = evento.modalidades.length <= 10
  const cats = new Map<string, SnapModalidade[]>()
  for (const m of evento.modalidades) {
    const c = categoriaDe(m); const arr = cats.get(c) ?? []; arr.push(m); cats.set(c, arr)
  }
  const boletins = evento.boletins ?? []

  const prog = progressoSorteios(evento)
  const tipos = tiposPresentes(evento)
  const ultimoBoletim = [...boletins].sort((a, b) => +new Date(b.atualizadoEm) - +new Date(a.atualizadoEm))[0]
  const periodo = evento.dataInicio
    ? `${dataPtBr(evento.dataInicio)}${evento.dataFim ? ` a ${dataPtBr(evento.dataFim)}` : ''}`
    : dataPtBr(evento.data)
  const ano = new Date(evento.data).getUTCFullYear()

  return (
    <>
      <SiteNav active="eventos" />
      <section className="ev-hero2">
        <div className="blob b1" /><div className="blob b2" />
        <div className="container">
          <div className="ev-hero2-inner">
            <nav className="breadcrumb">
              <a href="/index.html">Início</a><span>›</span>
              <a href="/eventos.html">Eventos</a><span>›</span>
              <a href="/eventos.html">{ano}</a><span>›</span>
              <b>{evento.nome}</b>
            </nav>
            <div className="ev-grid2">
              <div>
                <div className="ev-badges">
                  {tipos.map((t) => { const Ic = TIPO_ICON[t]; return <span className="ev-type-tile" key={t} title={TIPO_INFO[t].label}><Ic size={16} /></span> })}
                  <span className="badge b-accent"><span className="dot" />{statusPublico(evento.status).label}</span>
                </div>
                <h1 className="ev-h-title">{evento.nome}</h1>
                <div className="ev-h-meta">
                  <span className="m"><Trophy size={16} /> {evento.competicao}</span>
                  <span className="m"><Calendar size={16} /> {periodo}</span>
                  <span className="m"><MapPin size={16} /> {evento.local} · {evento.cidade}</span>
                </div>
                {prog.sorteaveis > 0 && (
                  <div className="hero-prog">
                    <div className="hero-prog-head"><span className="lab">Andamento dos sorteios</span><b>{prog.sorteadas} / {prog.sorteaveis}</b></div>
                    <div className="hero-bar"><span style={{ width: `${Math.max(prog.pct, 3)}%` }} /></div>
                    <div className="sub">{prog.pct}% das modalidades já sorteadas · {prog.sorteaveis - prog.sorteadas} aguardando</div>
                  </div>
                )}
              </div>
              <aside className="ev-actions">
                <div className="stat-pair">
                  <div className="sp"><div className="v">{modalidadesDistintas(evento)}</div><div className="l">Modalidades</div></div>
                  <div className="sp"><div className="v">{inscritos(evento)}</div><div className="l">Inscritos</div></div>
                  <div className="sp wide"><div className="v">{prog.sorteadas}</div><div className="l">Com sorteio</div></div>
                </div>
                <div className="divider" />
                {ultimoBoletim && (
                  <a className="btn-onhero solid" href={ultimoBoletim.url} target="_blank" rel="noopener noreferrer"><Download size={17} /> Baixar o último boletim oficial</a>
                )}
                <button className="btn-onhero ghost" data-share-title={`${evento.nome} · Montana Eventos`} data-share-url={`/evento-${evento.id}.html`}><Share2 size={17} /> Compartilhar evento</button>
              </aside>
            </div>
          </div>
        </div>
      </section>
      <div className="container">
        <div className="info-band">
          <div className="info-card"><div className="ic-tile"><Calendar size={17} /></div><div className="k">Período</div><div className="vv">{periodo}</div></div>
          <div className="info-card"><div className="ic-tile"><Clock size={17} /></div><div className="k">Sorteios</div><div className="vv">{prog.sorteaveis > 0 ? `${prog.sorteadas}/${prog.sorteaveis}` : '—'}</div></div>
          <div className="info-card"><div className="ic-tile"><MapPin size={17} /></div><div className="k">Local</div><div className="vv">{evento.local} · {evento.cidade}</div></div>
          {evento.organizador && <div className="info-card"><div className="ic-tile"><Building2 size={17} /></div><div className="k">Organização</div><div className="vv">{evento.organizador}</div></div>}
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html:
        "document.querySelectorAll('.btn-onhero.ghost[data-share-url]').forEach(function(b){b.addEventListener('click',function(){var u=location.origin+b.getAttribute('data-share-url');var t=b.getAttribute('data-share-title')||document.title;if(navigator.share){navigator.share({title:t,url:u}).catch(function(){})}else if(navigator.clipboard){navigator.clipboard.writeText(u);b.textContent='Link copiado!'}})});"
      }} />
      <main className="evento-page">
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
                  {temChave(m) && (
                    <button type="button" className="btn btn-secondary" data-bracket={m.id} style={{ marginTop: 10 }}>Ver chave</button>
                  )}
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
          const ordenados = [...boletins].sort((a, b) => (+new Date(b.atualizadoEm) - +new Date(a.atualizadoEm)) || (b.numero - a.numero))
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
        {evento.modalidades.filter(temChave).map((m) => <BracketView key={m.id} modalidade={m} />)}
        <script dangerouslySetInnerHTML={{ __html:
          "document.querySelectorAll('[data-bracket]').forEach(function(b){b.addEventListener('click',function(){var o=document.getElementById('bracket-'+b.getAttribute('data-bracket'));if(o)o.setAttribute('data-open','true')})});" +
          "document.querySelectorAll('.em-bracket-ov').forEach(function(o){" +
          "o.querySelectorAll('[data-bracket-close]').forEach(function(c){c.addEventListener('click',function(){o.setAttribute('data-open','false')})});" +
          "o.querySelectorAll('.em-vtog button[data-view]').forEach(function(v){v.addEventListener('click',function(){var view=v.getAttribute('data-view');o.querySelectorAll('.em-vtog button[data-view]').forEach(function(x){x.setAttribute('data-on',String(x===v))});o.querySelectorAll('.em-pane').forEach(function(p){p.setAttribute('data-on',String(p.getAttribute('data-pane')===view))})})});" +
          "o.querySelectorAll('.em-rtab[data-round]').forEach(function(t){t.addEventListener('click',function(){var rd=t.getAttribute('data-round');o.querySelectorAll('.em-rtab[data-round]').forEach(function(x){x.setAttribute('data-on',String(x.getAttribute('data-round')===rd))});o.querySelectorAll('.em-round[data-round]').forEach(function(p){p.setAttribute('data-on',String(p.getAttribute('data-round')===rd))})})});" +
          "});" +
          "document.addEventListener('keydown',function(e){if(e.key==='Escape')document.querySelectorAll('.em-bracket-ov[data-open=\"true\"]').forEach(function(o){o.setAttribute('data-open','false')})});"
        }} />
      </main>
    </>
  )
}
