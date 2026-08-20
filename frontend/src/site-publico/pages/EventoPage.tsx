import SiteNav from '../components/SiteNav'
import ModalidadeSorteio from '../components/ModalidadeSorteio'
import BracketView from '../components/BracketView'
import EventoEsportesNav, { type SecaoNav } from '../components/EventoEsportesNav'
import type { SnapEvento, SnapModalidade } from '../snapshot-types'
import { matchMensagem } from '../../lib/mensagens-inscritos'
import { esporteBase } from '../lib/esporte'
import { Trophy, Calendar, MapPin, Download, GitFork, Grid2x2, ListOrdered, List, FileText } from 'lucide-react'
import { CATEGORIAS_BOLETIM, categoriaInfo, formatBytes, dataPtBr } from '../../lib/boletim-categorias'
import { TIPO_INFO, tiposPresentes, type TipoSorteio } from '../lib/evento-stats'
import { statusPublico } from '../lib/status-evento'
import type { ChavesResultado } from '../../types/sorteio'

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

const temChave = (m: SnapModalidade) => m.tipo === 'chaves' && m.status === 'sorteado' && !!(m.resultado as ChavesResultado | null)?.matchesGraph?.matches?.length

export default function EventoPage({ evento }: { evento: SnapEvento }) {
  const abrir = evento.modalidades.length <= 10
  const cats = new Map<string, SnapModalidade[]>()
  for (const m of evento.modalidades) {
    const c = categoriaDe(m); const arr = cats.get(c) ?? []; arr.push(m); cats.set(c, arr)
  }
  const boletins = evento.boletins ?? []
  const secoes: SecaoNav[] = [...cats.entries()].map(([key, mods]) => ({
    key,
    count: mods.length,
    tipo: (mods[0]?.tipo ?? 'chaves') as TipoSorteio,
    sorteadas: mods.filter((m) => m.status === 'sorteado').length,
  }))

  const tipos = tiposPresentes(evento)
  const periodo = evento.dataInicio
    ? `${dataPtBr(evento.dataInicio)}${evento.dataFim ? ` a ${dataPtBr(evento.dataFim)}` : ''}`
    : dataPtBr(evento.data)

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
              <a href="/eventos.html">{evento.competicao}</a><span>›</span>
              <b>{evento.nome}</b>
            </nav>
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
          </div>
        </div>
      </section>
      <main className="evento-page" data-status-filter="all">
        <EventoEsportesNav secoes={secoes} />
        {[...cats.entries()].map(([cat, mods], i) => (
          <section className="cat-section" key={cat} data-sport={cat} data-on={i === 0 ? 'true' : 'false'}>
            <h2 className="cat-head">{cat} <span>{mods.length}</span></h2>
            {mods.map((m) => (
              <details className="mod-acc" open={abrir} key={m.id} id={`mod-${m.id}`} data-mstatus={m.status === 'sorteado' ? 'sorteado' : 'aberto'}>
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
        <script dangerouslySetInnerHTML={{ __html:
          "(function(){var main=document.querySelector('main.evento-page');if(!main)return;" +
          "function setSport(k){document.querySelectorAll('.cat-section[data-sport]').forEach(function(s){s.setAttribute('data-on',String(s.getAttribute('data-sport')===k))});document.querySelectorAll('.em-pill[data-sport]').forEach(function(p){p.setAttribute('data-on',String(p.getAttribute('data-sport')===k))})}" +
          "function closeSheet(){document.querySelectorAll('.em-sheet,.em-scrim').forEach(function(e){e.setAttribute('data-open','false')})}" +
          "function openSheet(){document.querySelectorAll('.em-sheet,.em-scrim').forEach(function(e){e.setAttribute('data-open','true')})}" +
          "document.querySelectorAll('.em-pill[data-sport],.em-sheet-item[data-sport]').forEach(function(b){b.addEventListener('click',function(){setSport(b.getAttribute('data-sport'));closeSheet()})});" +
          "document.querySelectorAll('[data-sheet-open]').forEach(function(b){b.addEventListener('click',openSheet)});" +
          "document.querySelectorAll('[data-sheet-close]').forEach(function(b){b.addEventListener('click',closeSheet)});" +
          "document.querySelectorAll('.seg button[data-sf]').forEach(function(b){b.addEventListener('click',function(){main.setAttribute('data-status-filter',b.getAttribute('data-sf'));document.querySelectorAll('.seg button[data-sf]').forEach(function(x){x.setAttribute('data-on',String(x===b))})})});" +
          "})();"
        }} />
      </main>
    </>
  )
}
