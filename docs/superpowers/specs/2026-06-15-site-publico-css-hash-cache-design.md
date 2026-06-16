# Site público: bundle CSS com hash (cache-busting) — Design

**Data:** 2026-06-15
**Status:** Aprovado (aguardando revisão da spec)

## Problema

Mudanças de CSS no site público não aparecem para os usuários: o `frontend/firebase.json` (target `publico`) serve `**/*.@(js|css|...)` com `Cache-Control: public, max-age=31536000, immutable`. O site público gera um **`site-bundle.css` com nome fixo** (Tailwind CLI), então o navegador/CDN trata a versão antiga como imutável por 1 ano e nunca rebusca. (No target `admin` a mesma regra é correta porque o Vite gera nomes com hash.)

Sintoma real: após corrigir o cabeçalho/zoom dos grupos, o site ao vivo continuou mostrando o layout antigo até forçar cache-bust; o `site-bundle.css` publicado não continha as regras novas.

## Decisão

Gerar o bundle do site público com **nome contendo hash de conteúdo** (`site-bundle.<hash>.css`) e referenciá-lo nos HTMLs. Assim a regra `immutable` passa a ser correta (cada conteúdo novo = nome novo), os HTMLs (que já têm `Cache-Control: public, max-age=300`) passam a apontar para o arquivo novo em até 5 min, e nunca mais se serve CSS velho.

## Contexto (estado atual)

- `frontend/package.json` script `build:site`:
  `... @tailwindcss/cli -i src/site-publico/site-entry.css -o dist-site/site-bundle.css --minify && tsx ... scripts/build-site-publico.tsx`
  (Tailwind gera o CSS primeiro; depois o `build-site-publico.tsx` renderiza os HTMLs.)
- `frontend/scripts/build-site-publico.tsx`:
  - `const OUT = join(ROOT, 'dist-site')`
  - `const CSS_HREF = '/site-bundle.css'` (constante fixa)
  - `emit(name, title, el)` usa `htmlShell({ title, body, cssHref: CSS_HREF })`.
- `frontend/src/site-publico/html-shell.ts`: já recebe `cssHref` como parâmetro (`<link rel="stylesheet" href="${opts.cssHref}" />`). Sem mudança.
- `frontend/firebase.json` target `publico`: `*.css` → `immutable`; `*.html` → `max-age=300`. Sem mudança (a regra `immutable` fica correta com o hash).

## Mudança (somente `frontend/scripts/build-site-publico.tsx`)

1. Importar `createHash` de `node:crypto` e `renameSync` de `node:fs`.
2. Remover a `const CSS_HREF` fixa; calcular dentro de `main()` **após** garantir o `OUT` e **antes** de emitir os HTMLs:
   - Caminho do CSS gerado pelo Tailwind: `join(OUT, 'site-bundle.css')`.
   - Ler o conteúdo, calcular `const hash = createHash('sha256').update(css).digest('hex').slice(0, 8)`.
   - `const cssFile = \`site-bundle.${hash}.css\``; renomear `site-bundle.css` → `cssFile` (`renameSync`).
   - `const cssHref = \`/${cssFile}\``.
3. Passar esse `cssHref` para cada `emit(...)` (ajustar a assinatura de `emit` para receber `cssHref`, ou capturar via closure dentro de `main`).
4. Tratamento: se `site-bundle.css` não existir no `OUT` (ex.: alguém rodar o tsx sem o passo do Tailwind), lançar erro claro (`throw new Error('site-bundle.css não encontrado em dist-site — rode o build do Tailwind antes')`). É um caminho de build interno; falhar explícito é melhor que emitir HTML com href quebrado.

Esboço:
```ts
import { createHash } from 'node:crypto'
import { renameSync } from 'node:fs'
// ...
function emit(name: string, title: string, el: React.ReactElement, cssHref: string) {
  const body = renderToStaticMarkup(el)
  writeFileSync(join(OUT, name), htmlShell({ title, body, cssHref }), 'utf8')
}

function main() {
  const eventos = loadSnapshots()
  mkdirSync(OUT, { recursive: true })
  if (existsSync(STATIC_DIR)) cpSync(STATIC_DIR, OUT, { recursive: true })

  const cssPath = join(OUT, 'site-bundle.css')
  if (!existsSync(cssPath)) throw new Error('site-bundle.css não encontrado em dist-site — rode o build do Tailwind antes')
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
  console.log(`Gerados ${eventos.length} eventos + 3 páginas em ${OUT}`)
}
```

## Testes / Verificação

- `cd frontend && npm run build:site`. Conferir em `dist-site`:
  - existe `site-bundle.<hash>.css` e **não** existe mais `site-bundle.css`;
  - os HTMLs (`index.html`, `eventos.html`, `evento-*.html`) referenciam `/site-bundle.<hash>.css` (grep do href);
  - rodar de novo sem mudar CSS → mesmo hash (determinístico); mudar 1 regra no CSS → hash diferente.
- Sem testes unitários novos (é script de build; verificação por inspeção do output).

## Fora de escopo

- Mudar `firebase.json` (a regra `immutable` fica correta com o hash).
- Hashear assets estáticos de `public-site-static` (logos etc.) — já são versionados pelo deploy e não são o gargalo; mantêm `immutable`.
- Limpar bundles antigos acumulados em `dist-site` local (no CI o checkout é limpo; localmente é inócuo).
- Qualquer mudança no app admin (Vite já faz hash).
