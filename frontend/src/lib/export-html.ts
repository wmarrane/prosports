export function slugify(s: string): string {
  const out = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return out || 'evento'
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const EXPORT_OVERRIDE_CSS = `
body { background: #fff; margin: 24px; }
.sorteio-print { display: block !important; }
.sorteio-print + .sorteio-print { margin-top: 24px; }
@media print {
  .sorteio-print { page-break-after: always; }
  .sorteio-print:last-child { page-break-after: auto; }
}
`

export function buildExportDocument(opts: { titulo: string; css: string; bodyHtml: string }): string {
  return `<!doctype html>
<html lang="pt-BR" data-theme="light">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(opts.titulo)}</title>
<style>${opts.css}</style>
<style>${EXPORT_OVERRIDE_CSS}</style>
</head>
<body class="sorteio-print-export">
${opts.bodyHtml}
</body>
</html>`
}

// Serializa todas as regras CSS same-origin já carregadas na página
// (tokens, tema e utilitários compilados). Folhas cross-origin lançam
// SecurityError ao ler cssRules e são ignoradas.
export function serializeLoadedStyles(): string {
  let css = ''
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | null = null
    try {
      rules = sheet.cssRules
    } catch {
      continue
    }
    if (!rules) continue
    for (const rule of Array.from(rules)) css += rule.cssText + '\n'
  }
  return css
}

export function downloadHtmlFile(filename: string, html: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
