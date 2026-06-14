function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function htmlShell(opts: { title: string; body: string; cssHref: string }): string {
  return `<!doctype html>
<html lang="pt-BR" data-theme="light">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(opts.title)}</title>
<link rel="icon" href="/montana/simbolo.png" />
<link rel="stylesheet" href="${opts.cssHref}" />
</head>
<body>${opts.body}</body>
</html>`
}
