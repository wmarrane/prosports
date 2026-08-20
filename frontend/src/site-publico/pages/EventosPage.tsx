import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import EventoCardListagem from '../components/EventoCardListagem'
import { inscritos } from '../lib/evento-stats'
import type { SnapEvento } from '../snapshot-types'
import { statusPublico, STATUS_ORDEM } from '../lib/status-evento'

/**
 * Agrupa por COMPETIÇÃO, não por ano.
 *
 * O ano só separa alguma coisa quando há mais de um — e na prática todos os
 * eventos publicados são da temporada corrente, então o agrupamento por ano
 * virava um único bloco com a lista inteira dentro. Competição é o que de fato
 * distingue os eventos entre si ("Jogos Regionais" x "JEESP"), e cada bloco
 * ganha identidade e contagem própria.
 *
 * Os blocos vêm ordenados pelo evento mais recente de cada competição, para a
 * temporada em andamento aparecer primeiro.
 */
function agruparPorCompeticao(eventos: SnapEvento[]) {
  const porComp = new Map<string, SnapEvento[]>()
  for (const e of eventos) {
    const lista = porComp.get(e.competicao) ?? []
    lista.push(e)
    porComp.set(e.competicao, lista)
  }
  return [...porComp.entries()]
    .map(([competicao, lista]) => ({
      competicao,
      lista: [...lista].sort((a, b) => +new Date(b.data) - +new Date(a.data)),
    }))
    .sort((a, b) => +new Date(b.lista[0].data) - +new Date(a.lista[0].data))
}

/** Texto do card usado pela busca: minúsculo e sem acento, para "sao" achar "São". */
function chaveBusca(e: SnapEvento): string {
  return `${e.nome} ${e.cidade}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export default function EventosPage({ eventos }: { eventos: SnapEvento[] }) {
  const blocos = agruparPorCompeticao(eventos)

  // Filtros que só aparecem quando têm o que filtrar: com um único ano (ou um
  // único status) publicado, as pílulas seriam "Todos" e mais uma — dois botões
  // com o mesmo efeito.
  const anos = [...new Set(eventos.map(e => new Date(e.data).getFullYear()))].sort((a, b) => b - a)
  const statuses = STATUS_ORDEM.filter(s => eventos.some(e => e.status === s))

  return (
    <div className="site">
      <SiteNav active="eventos" />

      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-eyebrow"><span className="dot" />Agenda · resultados</div>
          <h1>Eventos</h1>
          <p className="lead">Cada evento tem sua própria página com inscritos, campeões do ano anterior e os sorteios de cada modalidade.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="ev-toolbar">
            <input
              type="search"
              id="ev-busca"
              className="ev-busca"
              placeholder="Buscar por evento ou cidade"
              aria-label="Buscar por evento ou cidade"
              autoComplete="off"
            />
            {anos.length > 1 && (
              <div className="yr-filter" data-grupo="ano">
                <button type="button" className="on" data-ano="todos">Todos os anos</button>
                {anos.map(a => <button type="button" key={a} data-ano={String(a)}>{a}</button>)}
              </div>
            )}
            {statuses.length > 1 && (
              <div className="yr-filter" data-grupo="status">
                <button type="button" className="on" data-filter="todos">Todos</button>
                {statuses.map(s => (
                  <button type="button" key={s} data-filter={s}>
                    <span className="d" style={{ background: statusPublico(s).dot }} />{statusPublico(s).label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {blocos.map(({ competicao, lista }) => {
            const inscritosComp = lista.reduce((s, e) => s + inscritos(e), 0)
            return (
              <div className="year-group" key={competicao} data-competicao={competicao}>
                <div className="yr-head">
                  <span className="yr comp">{competicao}</span>
                  <span className="sub">
                    <b>{lista.length}</b> {lista.length === 1 ? 'evento' : 'eventos'} · <b>{inscritosComp}</b> inscritos
                  </span>
                </div>
                <div className="ev-grid3">
                  {lista.map(e => (
                    <EventoCardListagem
                      key={e.id}
                      evento={e}
                      ano={new Date(e.data).getFullYear()}
                      busca={chaveBusca(e)}
                    />
                  ))}
                </div>
              </div>
            )
          })}

          <p className="ev-vazio" hidden>Nenhum evento encontrado.</p>
        </div>
      </section>

      {/* Site estático: o filtro é um script inline. Sem JS, tudo continua
          visível — os filtros só refinam o que já está na página. */}
      <script dangerouslySetInnerHTML={{ __html:
        "(function(){var q='',ano='todos',st='todos';" +
        "var grupos=[].slice.call(document.querySelectorAll('.year-group'));" +
        "var vazio=document.querySelector('.ev-vazio');" +
        "function norm(s){return (s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase()}" +
        "function aplica(){var total=0;grupos.forEach(function(g){var vis=0;" +
        "[].slice.call(g.querySelectorAll('.evc')).forEach(function(c){" +
        "var ok=(ano==='todos'||c.getAttribute('data-ano')===ano)&&" +
        "(st==='todos'||c.getAttribute('data-status')===st)&&" +
        "(!q||(c.getAttribute('data-busca')||'').indexOf(q)>=0);" +
        "c.style.display=ok?'':'none';if(ok)vis++});" +
        "g.style.display=vis?'':'none';total+=vis});" +
        "if(vazio)vazio.hidden=total>0}" +
        "function pilulas(sel,cb){var box=document.querySelector(sel);if(!box)return;" +
        "var btns=[].slice.call(box.querySelectorAll('button'));" +
        "btns.forEach(function(b){b.addEventListener('click',function(){" +
        "btns.forEach(function(x){x.classList.remove('on')});b.classList.add('on');cb(b);aplica()})})}" +
        "pilulas('[data-grupo=\"ano\"]',function(b){ano=b.getAttribute('data-ano')});" +
        "pilulas('[data-grupo=\"status\"]',function(b){st=b.getAttribute('data-filter')});" +
        "var busca=document.getElementById('ev-busca');" +
        "if(busca)busca.addEventListener('input',function(){q=norm(busca.value);aplica()});" +
        "})();"
      }} />

      <SiteFooter />
    </div>
  )
}
