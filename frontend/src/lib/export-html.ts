export function slugify(s: string): string {
  const out = s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return out || 'evento'
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const EXPORT_OVERRIDE_CSS = `
html, body, #root { height: auto !important; overflow: visible !important; }
body { background: #fff; margin: 24px; }
/* Chaves: não prender o bracket num scroll interno — deixa a página rolar/expandir
   na horizontal e evita corte na impressão. */
.stage-scroll { overflow-x: visible !important; }
.sorteio-print { display: block !important; }
.sorteio-print + .sorteio-print { margin-top: 24px; }
@media print {
  .sorteio-print { page-break-after: always; }
  .sorteio-print:last-child { page-break-after: auto; }
  .export-header { page-break-after: auto !important; }
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

// Converte imagens com src raiz-relativo (ex.: "/montana/simbolo.png") em data
// URIs base64, para o HTML exportado abrir offline (file://) com as imagens.
// Falha de fetch em uma imagem é ignorada (mantém o src original).
export async function inlineRootImages(html: string): Promise<string> {
  const urls = new Set<string>()
  const re = /src="(\/[^"]+)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) urls.add(m[1])

  let out = html
  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const blob = await res.blob()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      out = out.split(`src="${url}"`).join(`src="${dataUrl}"`)
    } catch {
      // mantém o src original se a imagem não puder ser carregada
    }
  }
  return out
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
