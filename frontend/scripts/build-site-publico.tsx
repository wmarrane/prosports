import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import IndexPage from '../src/site-publico/pages/IndexPage'
import EventosPage from '../src/site-publico/pages/EventosPage'
import SobrePage from '../src/site-publico/pages/SobrePage'
import EventoPage from '../src/site-publico/pages/EventoPage'
import { htmlShell } from '../src/site-publico/html-shell'
import type { SnapEvento } from '../src/site-publico/snapshot-types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SNAP_DIR = join(ROOT, 'public-site-snapshots')
const OUT = join(ROOT, 'dist-site')
const CSS_HREF = '/site-bundle.css'

function loadSnapshots(): SnapEvento[] {
  if (!existsSync(SNAP_DIR)) return []
  return readdirSync(SNAP_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(SNAP_DIR, f), 'utf8')) as SnapEvento)
    .sort((a, b) => +new Date(b.data) - +new Date(a.data))
}

function emit(name: string, title: string, el: React.ReactElement) {
  const body = renderToStaticMarkup(el)
  writeFileSync(join(OUT, name), htmlShell({ title, body, cssHref: CSS_HREF }), 'utf8')
}

function main() {
  const eventos = loadSnapshots()
  mkdirSync(OUT, { recursive: true })
  emit('index.html', 'Montana Eventos', React.createElement(IndexPage, { eventos }))
  emit('eventos.html', 'Eventos · Montana', React.createElement(EventosPage, { eventos }))
  emit('sobre.html', 'Sobre · Montana', React.createElement(SobrePage))
  for (const ev of eventos) {
    emit(`evento-${ev.id}.html`, `${ev.nome} · Montana`, React.createElement(EventoPage, { evento: ev }))
  }
  console.log(`Gerados ${eventos.length} eventos + 3 páginas em ${OUT}`)
}
main()
