import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync, cpSync, renameSync, unlinkSync } from 'node:fs'
import { createHash } from 'node:crypto'
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
const STATIC_DIR = join(ROOT, 'public-site-static')
const OUT = join(ROOT, 'dist-site')

function loadSnapshots(): SnapEvento[] {
  if (!existsSync(SNAP_DIR)) return []
  return readdirSync(SNAP_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(SNAP_DIR, f), 'utf8')) as SnapEvento)
    .sort((a, b) => +new Date(b.data) - +new Date(a.data))
}

function emit(name: string, title: string, el: React.ReactElement, cssHref: string) {
  const body = renderToStaticMarkup(el)
  writeFileSync(join(OUT, name), htmlShell({ title, body, cssHref }), 'utf8')
}

function main() {
  const eventos = loadSnapshots()
  mkdirSync(OUT, { recursive: true })
  // Copia assets estáticos (logos, captura da plataforma) para o output.
  if (existsSync(STATIC_DIR)) cpSync(STATIC_DIR, OUT, { recursive: true })

  // O Tailwind (passo anterior do build:site) gerou dist-site/site-bundle.css.
  // Renomeia para um nome com hash de conteúdo, para o cache `immutable` do
  // Firebase Hosting ser correto e mudanças de CSS aparecerem na hora.
  const cssPath = join(OUT, 'site-bundle.css')
  if (!existsSync(cssPath)) {
    throw new Error('site-bundle.css não encontrado em dist-site — rode o build do Tailwind antes')
  }
  // Remove bundles com hash de builds anteriores (acúmulo em rebuilds locais).
  for (const f of readdirSync(OUT)) {
    if (/^site-bundle\.[^.]+\.css$/.test(f)) unlinkSync(join(OUT, f))
  }
  const hash = createHash('sha256').update(readFileSync(cssPath)).digest('hex').slice(0, 8)
  const cssFile = `site-bundle.${hash}.css`
  renameSync(cssPath, join(OUT, cssFile))
  const cssHref = `/${cssFile}`

  emit('index.html', 'Montana Eventos', React.createElement(IndexPage, { eventos }), cssHref)
  emit('eventos.html', 'Eventos · Montana', React.createElement(EventosPage, { eventos }), cssHref)
  emit('sobre.html', 'Sobre · Montana', React.createElement(SobrePage), cssHref)
  for (const ev of eventos) {
    emit(`evento-${ev.id}.html`, `${ev.nome} · Montana`, React.createElement(EventoPage, { evento: ev }), cssHref)
  }
  console.log(`Gerados ${eventos.length} eventos + 3 páginas em ${OUT} (css: ${cssFile})`)
}
main()
