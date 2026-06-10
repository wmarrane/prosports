# Exportar modalidades em HTML — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Botão "Exportar HTML" no cadastro de eventos que gera um único `.html` autossuficiente com todas as modalidades com inscritos, no mesmo formato do PDF (`SorteioPrint`).

**Architecture:** Refatorar `SorteioPrint` para expor `SorteioPrintContent` (markup sem portal), permitindo `renderToStaticMarkup` no navegador. Uma lib `export-html.ts` serializa o CSS já carregado (`document.styleSheets`), monta o documento HTML e dispara o download. O handler em `EventoInscricoes` busca inscritos/campeões de cada modalidade, renderiza N seções e baixa o arquivo.

**Tech Stack:** React 18, TypeScript, `react-dom/server` (`renderToStaticMarkup`), Vitest (sem testing-library/jsdom; testes usam `renderToStaticMarkup` em ambiente Node). Spec: `docs/superpowers/specs/2026-06-10-exportar-modalidades-html-design.md`.

---

## File Structure

- `frontend/src/pages/eventos/SorteioPrint.tsx` — extrair `SorteioPrintContent` (sem portal) e guardar blocos de seed/sorteio; `SorteioPrint` envelopa com portal (comportamento atual do botão "PDF").
- `frontend/src/lib/export-html.ts` (novo) — `slugify`, `buildExportDocument`, `serializeLoadedStyles`, `downloadHtmlFile`.
- `frontend/src/pages/eventos/EventoInscricoes.tsx` — botão "Exportar HTML" no banner + handler de exportação.
- `frontend/src/pages/eventos/SorteioPrint.test.tsx` — testes do `SorteioPrintContent`.
- `frontend/src/lib/export-html.test.ts` (novo) — testes de `slugify` e `buildExportDocument`.

---

## Task 1: Extrair `SorteioPrintContent` (sem portal) + guardas

**Files:**
- Modify: `frontend/src/pages/eventos/SorteioPrint.tsx`
- Test: `frontend/src/pages/eventos/SorteioPrint.test.tsx`

Contexto: hoje `SorteioPrint` retorna `createPortal(content, document.body)` quando há `document`. No export, `renderToStaticMarkup` roda no navegador (com `document`), e portais não são renderizados no SSR. Extrair o markup interno para `SorteioPrintContent` resolve isso. Também guardamos os blocos de seed e de sorteio para modalidades sem sorteio (export inclui modalidades só com inscritos).

- [ ] **Step 1: Adicionar os testes do `SorteioPrintContent`**

Substituir o conteúdo de `frontend/src/pages/eventos/SorteioPrint.test.tsx` por:

```tsx
import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import SorteioPrint, { SorteioPrintContent } from './SorteioPrint'

const base = {
  eventoNome: 'Jogos 2026', anfitriao: 'São Manuel',
  modalidadeNome: 'Futsal', modalidadeTipo: 'grupos' as const, sigla: 'FUT',
  cidadeLocalData: 'São Manuel · Ginásio · 10/05/2026',
  seed: 'ABC-123',
  resultado: { regra_id: 1, classificados_por_grupo: 2, grupos: [{ letra: 'A', participantes: [100] }] },
  participantesById: new Map([[100, { id: 100, nome: 'Tigres', subtitulo: null } as any]]),
  campeoesByParticipanteId: new Map<number, number>(),
  anfitriaoPid: null as number | null,
  subtituloLine: () => null,
  inscritos: [{ id: 100, nome: 'Tigres' }],
  campeoes: [] as { posicao: number; nome: string }[],
}

it('SorteioPrint renderiza cabecalho, seed e o sorteio', () => {
  const html = renderToStaticMarkup(<SorteioPrint {...base} />)
  expect(html).toContain('class="sorteio-print"')
  expect(html).toContain('Jogos 2026')
  expect(html).toContain('Futsal')
  expect(html).toContain('ABC-123')
  expect(html).toContain('Tigres')
})

it('SorteioPrintContent renderiza inline com a classe sorteio-print', () => {
  const html = renderToStaticMarkup(<SorteioPrintContent {...base} />)
  expect(html).toContain('class="sorteio-print"')
  expect(html).toContain('Jogos 2026')
  expect(html).toContain('Tigres')
})

it('SorteioPrintContent omite seed e bloco de sorteio quando nao ha sorteio', () => {
  const html = renderToStaticMarkup(
    <SorteioPrintContent {...base} resultado={null} seed="" />
  )
  expect(html).not.toContain('seed:')
  expect(html).toContain('Tigres')
})
```

- [ ] **Step 2: Rodar os testes e ver falhar**

Run: `cd frontend && npx vitest run src/pages/eventos/SorteioPrint.test.tsx`
Expected: FAIL — `SorteioPrintContent` não é exportado (erro de import) / os novos casos falham.

- [ ] **Step 3: Refatorar `SorteioPrint.tsx`**

Substituir o conteúdo de `frontend/src/pages/eventos/SorteioPrint.tsx` por:

```tsx
import { createPortal } from 'react-dom'
import LogoMontana from '../../components/LogoMontana'
import SorteioGrupos from '../../components/sorteio-result/SorteioGrupos'
import SorteioChaves from '../../components/sorteio-result/SorteioChaves'
import SorteioOrdem from '../../components/sorteio-result/SorteioOrdem'
import type { Participante } from '../../types/participante'

type Props = {
  eventoNome: string
  anfitriao: string
  modalidadeNome: string
  modalidadeTipo: 'grupos' | 'chaves' | 'ordem_entrada' | 'especifico' | undefined
  sigla: string
  cidadeLocalData: string
  seed: string
  resultado: any
  participantesById: Map<number, Participante>
  campeoesByParticipanteId: Map<number, number>
  anfitriaoPid: number | null
  subtituloLine: (p: Participante) => string | null
  inscritos: { id: number; nome: string }[]
  campeoes: { posicao: number; nome: string }[]
}

export function SorteioPrintContent(p: Props) {
  return (
    <div className="sorteio-print">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderBottom: '2px solid #156082', paddingBottom: 12, marginBottom: 16 }}>
        <LogoMontana variant="simbolo" height={56} />
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{p.eventoNome}</div>
          <div style={{ fontSize: 13, color: '#475569' }}>Cidade Sede: <b>{p.anfitriao}</b></div>
          <div style={{ fontSize: 13, color: '#475569' }}>{p.cidadeLocalData}</div>
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{p.modalidadeNome} <span style={{ color: '#475569', fontWeight: 600 }}>({p.sigla})</span></div>
        {p.seed && <div style={{ fontSize: 12, color: '#475569' }}>seed: <span style={{ fontFamily: 'monospace' }}>{p.seed}</span></div>}
      </div>

      {p.modalidadeTipo === 'grupos' && p.resultado && (
        <SorteioGrupos resultado={p.resultado} participantesById={p.participantesById} campeoesByParticipanteId={p.campeoesByParticipanteId} anfitriaoPid={p.anfitriaoPid} subtituloLine={p.subtituloLine} />
      )}
      {p.modalidadeTipo === 'chaves' && p.resultado && (
        <SorteioChaves resultado={p.resultado} participantesById={p.participantesById} campeoesByParticipanteId={p.campeoesByParticipanteId} anfitriaoPid={p.anfitriaoPid} subtituloLine={p.subtituloLine} />
      )}
      {p.modalidadeTipo === 'ordem_entrada' && p.resultado && (
        <SorteioOrdem resultado={p.resultado} participantesById={p.participantesById} anfitriaoPid={p.anfitriaoPid} subtituloLine={p.subtituloLine} />
      )}

      {p.campeoes.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Campeões do ano anterior</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: '#1e293b', fontSize: 12 }}>
            {p.campeoes.map((c, i) => <li key={i}>{c.posicao}º {c.nome}</li>)}
          </ul>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Inscritos ({p.inscritos.length})</div>
        <ul style={{ margin: 0, paddingLeft: 18, color: '#1e293b', fontSize: 12, columns: 2 }}>
          {p.inscritos.map((i) => <li key={i.id}>{i.nome}</li>)}
        </ul>
      </div>
    </div>
  )
}

export default function SorteioPrint(p: Props) {
  // Renderiza via portal no <body> para o print isolar com display:none nos
  // demais filhos do body. No SSR (renderToStaticMarkup, sem document) retorna inline.
  const content = <SorteioPrintContent {...p} />
  if (typeof document !== 'undefined' && document.body) {
    return createPortal(content, document.body)
  }
  return content
}
```

- [ ] **Step 4: Rodar os testes e ver passar**

Run: `cd frontend && npx vitest run src/pages/eventos/SorteioPrint.test.tsx`
Expected: PASS (3 testes).

- [ ] **Step 5: Verificar tipos**

Run: `cd frontend && npx tsc -b`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/eventos/SorteioPrint.tsx frontend/src/pages/eventos/SorteioPrint.test.tsx
git commit -m "refactor(ui): extrai SorteioPrintContent (sem portal) p/ export HTML"
```

---

## Task 2: Lib `export-html.ts`

**Files:**
- Create: `frontend/src/lib/export-html.ts`
- Test: `frontend/src/lib/export-html.test.ts`

Contexto: funções puras testáveis (`slugify`, `buildExportDocument`) e funções dependentes de DOM (`serializeLoadedStyles`, `downloadHtmlFile`, validadas manualmente). O documento exportado inclui o CSS serializado da página e um bloco de override que torna `.sorteio-print` visível (na página o tema define `.sorteio-print { display: none }`) e adiciona quebra de página entre seções.

- [ ] **Step 1: Escrever os testes**

Criar `frontend/src/lib/export-html.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { slugify, buildExportDocument } from './export-html'

describe('slugify', () => {
  it('normaliza acentos e espacos', () => {
    expect(slugify('São Manuel 2026')).toBe('sao-manuel-2026')
  })
  it('string sem caracteres validos vira "evento"', () => {
    expect(slugify('!!!')).toBe('evento')
  })
})

describe('buildExportDocument', () => {
  it('inclui titulo, css serializado, override, tema claro e corpo', () => {
    const html = buildExportDocument({
      titulo: 'Jogos',
      css: '.x{color:red}',
      bodyHtml: '<div class="sorteio-print">ok</div>',
    })
    expect(html).toContain('<title>Jogos</title>')
    expect(html).toContain('data-theme="light"')
    expect(html).toContain('.x{color:red}')
    expect(html).toContain('.sorteio-print { display: block !important; }')
    expect(html).toContain('<div class="sorteio-print">ok</div>')
  })
  it('escapa caracteres especiais no titulo', () => {
    const html = buildExportDocument({ titulo: 'A & B <2026>', css: '', bodyHtml: '' })
    expect(html).toContain('<title>A &amp; B &lt;2026&gt;</title>')
  })
})
```

- [ ] **Step 2: Rodar os testes e ver falhar**

Run: `cd frontend && npx vitest run src/lib/export-html.test.ts`
Expected: FAIL — módulo `./export-html` não existe.

- [ ] **Step 3: Implementar a lib**

Criar `frontend/src/lib/export-html.ts`:

```ts
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
```

- [ ] **Step 4: Rodar os testes e ver passar**

Run: `cd frontend && npx vitest run src/lib/export-html.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/export-html.ts frontend/src/lib/export-html.test.ts
git commit -m "feat(ui): lib export-html (serializa CSS + monta/baixa HTML)"
```

---

## Task 3: Botão "Exportar HTML" + handler em `EventoInscricoes`

**Files:**
- Modify: `frontend/src/pages/eventos/EventoInscricoes.tsx`

Contexto: o handler filtra as modalidades com `≥1` inscrito (via `countsByModalidade`), busca inscritos e campeões de cada uma em paralelo, monta os dados, renderiza uma seção `SorteioPrintContent` por modalidade com `renderToStaticMarkup`, serializa o CSS da página e baixa o `.html`. Os sorteios do evento já estão carregados no estado (`sorteios`).

- [ ] **Step 1: Adicionar os imports**

Em `frontend/src/pages/eventos/EventoInscricoes.tsx`, na linha de import do `SorteioPrint` (atual: `import SorteioPrint from './SorteioPrint'`), substituir por:

```tsx
import SorteioPrint, { SorteioPrintContent } from './SorteioPrint'
```

E adicionar, logo após o bloco de imports de serviços (após `import { campeoesAnterioresService } from '../../services/campeoes-anteriores'`):

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { serializeLoadedStyles, buildExportDocument, downloadHtmlFile, slugify } from '../../lib/export-html'
```

- [ ] **Step 2: Adicionar o estado e o handler**

Em `frontend/src/pages/eventos/EventoInscricoes.tsx`, logo após a linha `const [importOpen, setImportOpen] = useState(false)`, adicionar:

```tsx
  const [exportandoHtml, setExportandoHtml] = useState(false)
```

E logo antes de `function handleSortear() { ... }`, adicionar o handler:

```tsx
  async function handleExportarHtml() {
    if (!evento) return
    setExportandoHtml(true)
    try {
      const counts = countsByModalidade as Record<number, number>
      const comInscritos = modalidades.filter(m => (counts[m.id] ?? 0) > 0)
      if (comInscritos.length === 0) {
        toast.error('Nenhuma modalidade com inscritos para exportar.')
        return
      }

      const dados = await Promise.all(
        comInscritos.map(async m => {
          const [insc, camps] = await Promise.all([
            inscricoesService.listar({ evento_id: eventoId, modalidade_id: m.id }),
            campeoesAnterioresService.listar({ evento_id: eventoId, modalidade_id: m.id }),
          ])
          return { modalidade: m, inscricoes: insc, campeoes: camps }
        })
      )

      const cidadeLocalData = [evento.municipio?.nome, evento.local, formatDateBR(evento.data_hora)]
        .filter(Boolean)
        .join(' · ')

      const secoes = dados.map(({ modalidade: m, inscricoes: insc, campeoes: camps }) => {
        const ordenadas = [...insc].sort((a, b) =>
          a.participante.nome.localeCompare(b.participante.nome, 'pt-BR', { sensitivity: 'base' })
        )
        const pById = new Map<number, Participante>()
        for (const i of ordenadas) pById.set(i.participante_id, i.participante)
        const cByPid = new Map<number, number>()
        for (const c of camps) cByPid.set(c.participante_id, c.posicao)
        const sorteio = sorteios.find(s => s.modalidade_id === m.id) ?? null
        const tipo = m.tipo_modalidade?.tipo as 'grupos' | 'chaves' | 'ordem_entrada' | 'especifico' | undefined
        return renderToStaticMarkup(
          <SorteioPrintContent
            eventoNome={evento.nome}
            anfitriao={evento.anfitriao?.nome ?? '—'}
            modalidadeNome={m.nome}
            modalidadeTipo={tipo}
            sigla={m.sigla ?? ''}
            cidadeLocalData={cidadeLocalData}
            seed={sorteio?.seed ?? ''}
            resultado={sorteio?.resultado ?? null}
            participantesById={pById}
            campeoesByParticipanteId={cByPid}
            anfitriaoPid={evento.anfitriao_id ?? null}
            subtituloLine={subtituloLine}
            inscritos={ordenadas.map(i => ({ id: i.participante_id, nome: i.participante?.nome ?? '—' }))}
            campeoes={[...camps]
              .sort((a, b) => a.posicao - b.posicao)
              .map(c => ({ posicao: c.posicao, nome: c.participante?.nome ?? '—' }))}
          />
        )
      })

      const css = serializeLoadedStyles()
      const html = buildExportDocument({ titulo: evento.nome, css, bodyHtml: secoes.join('\n') })
      downloadHtmlFile(`evento-${slugify(evento.nome)}.html`, html)
      toast.success('HTML exportado.')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erro ao exportar HTML.')
    } finally {
      setExportandoHtml(false)
    }
  }
```

- [ ] **Step 3: Adicionar o botão no banner**

Em `frontend/src/pages/eventos/EventoInscricoes.tsx`, localizar o botão "Editar evento":

```tsx
              <button
                onClick={() => navigate(`/eventos/${eventoId}/editar`)}
                className="text-xs text-[var(--brand-500)] hover:text-[var(--brand-400)] font-semibold ml-2"
              >
                Editar evento
              </button>
```

Adicionar imediatamente **após** esse botão:

```tsx
              <button
                onClick={handleExportarHtml}
                disabled={exportandoHtml}
                className="text-xs text-[var(--t2)] hover:text-[var(--t1)] font-semibold disabled:opacity-50"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                title="Exportar todas as modalidades (inscritos, campeões e sorteio) em HTML"
              >
                <Download size={12} /> {exportandoHtml ? 'Exportando...' : 'Exportar HTML'}
              </button>
```

(`Download` já está importado de `lucide-react` na linha de imports de ícones.)

- [ ] **Step 4: Verificar tipos e build**

Run: `cd frontend && npx tsc -b`
Expected: sem erros.

Run: `cd frontend && npm run build`
Expected: conclui sem erros (`tsc -b && vite build`).

- [ ] **Step 5: Verificação manual**

`cd frontend && npm run dev` (backend rodando):
- Abrir um evento com modalidades que tenham inscritos (algumas sorteadas, outras não).
- Clicar em **Exportar HTML** no banner → baixa `evento-<nome>.html`.
- Abrir o `.html` baixado **offline** (sem o app rodando) e conferir:
  - Layout idêntico ao PDF (cabeçalho do evento, nome/sigla da modalidade).
  - Uma seção por modalidade com inscritos; modalidades sem inscritos **não** aparecem.
  - Onde há sorteio, o resultado (Grupos/Chaves/Ordem) é renderizado; onde não há, a seção mostra só inscritos/campeões sem a linha "seed:".
  - Campeões do ano anterior e inscritos corretos.
  - Estilos aplicados mesmo offline (tema claro).
- Evento sem nenhuma modalidade com inscritos → toast "Nenhuma modalidade com inscritos para exportar." e nenhum download.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/eventos/EventoInscricoes.tsx
git commit -m "feat(ui): botão Exportar HTML no evento (modalidades no formato do PDF)"
```

---

## Self-review (cobertura da spec)

- Saída: 1 arquivo `.html` autossuficiente, baixado → Task 2 (`buildExportDocument`/`downloadHtmlFile`) + Task 3 ✓
- Modalidades com ≥1 inscrito → Task 3 (filtro `counts[m.id] > 0`) ✓
- Conteúdo por modalidade no formato `SorteioPrint` (cabeçalho, nome/sigla/seed, sorteio quando houver, campeões, inscritos) → Task 1 (`SorteioPrintContent`) + Task 3 ✓
- Tema fixo claro (`data-theme="light"`) → Task 2 (`buildExportDocument`) ✓
- HTML self-contained via serialização de `document.styleSheets` → Task 2 (`serializeLoadedStyles`) ✓
- Override `.sorteio-print { display: block }` (na página é `display:none`) + quebra de página entre seções → Task 2 (`EXPORT_OVERRIDE_CSS`) ✓
- `SorteioPrintContent` sem portal para `renderToStaticMarkup` no navegador → Task 1 ✓
- Busca paralela de inscritos/campeões; sorteios já carregados → Task 3 (`Promise.all`) ✓
- Erros: nenhuma modalidade com inscritos (toast) e falha de requisição (toast, sem download parcial) → Task 3 ✓
- Botão no banner ao lado de "Editar evento" → Task 3 ✓
- Sem backend/migration; validação por testes (`renderToStaticMarkup`/puras) + `npm run build` + manual → Tasks 1-3 ✓
- Fora de escopo (1 arquivo por modalidade, modo escuro, mexer no botão "PDF") respeitado ✓
