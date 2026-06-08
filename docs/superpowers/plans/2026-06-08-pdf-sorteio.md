# PDF do sorteio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task. Steps use `- [ ]`.

**Goal:** Botão "PDF" no bloco Sorteio de `EventoInscricoes` que imprime o sorteio da modalidade selecionada (logo + dados + sorteio + campeões + inscritos) via `window.print()`.

**Architecture:** Componente dedicado `SorteioPrint` escondido na tela e visível só na impressão (`@media print`), com CSS que isola o bloco e força paleta clara. Reaproveita `SorteioGrupos/Chaves/Ordem`.

**Tech Stack:** React + TS, CSS print, sem dependências novas.

**Spec:** `docs/superpowers/specs/2026-06-08-pdf-sorteio-design.md`

---

## Dados disponíveis em `EventoInscricoes.tsx` (já no componente)
`evento` (com `anfitriao`, `data_hora`), `modalidadeAtual` (nome, sigla, tipo via `tipoDaModalidade`), `sorteioDaModalidade`, `participantesById`, `campeoesByParticipanteId`, `campeoes` (array), `inscricoes` (alfabético), `subtituloLine`, `formatDateBR`.

---

### Task 1: CSS de impressão

**Files:**
- Modify: `frontend/src/styles/prosports-theme.css` (append no fim)

- [ ] **Step 1: Adicionar bloco CSS**

```css
/* ── Impressão do sorteio (EventoInscricoes) ── */
.sorteio-print { display: none; }
@media print {
  body * { visibility: hidden !important; }
  .sorteio-print, .sorteio-print * { visibility: visible !important; }
  .sorteio-print {
    display: block !important;
    position: absolute; left: 0; top: 0; width: 100%; padding: 24px;
    background: #fff; color: #0f172a;
    --t1: #0f172a; --t2: #1e293b; --t3: #475569; --t4: #94a3b8;
    --card-bg: #ffffff; --card-bg-2: #f8fafc; --card-border: #e2e8f0;
    --warn: #b45309; --brand-500: #1061d8; --success: #15803d;
  }
  .no-print { display: none !important; }
}
```

- [ ] **Step 2: Commit**
```bash
git add frontend/src/styles/prosports-theme.css
git commit -m "feat(pdf-sorteio): CSS de impressao isolando o bloco"
```

---

### Task 2: Componente `SorteioPrint`

**Files:**
- Create: `frontend/src/pages/eventos/SorteioPrint.tsx`
- Create: `frontend/src/pages/eventos/SorteioPrint.test.tsx`

- [ ] **Step 1: Teste falho**

```tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import SorteioPrint from './SorteioPrint'

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

it('renderiza cabecalho, seed e o sorteio', () => {
  const html = renderToStaticMarkup(<SorteioPrint {...base} />)
  expect(html).toContain('class="sorteio-print"')
  expect(html).toContain('Jogos 2026')
  expect(html).toContain('Futsal')
  expect(html).toContain('ABC-123')
  expect(html).toContain('Tigres')
})
```

- [ ] **Step 2: Rodar (FAIL)** — `cd frontend; npx vitest run src/pages/eventos/SorteioPrint.test.tsx`

- [ ] **Step 3: Implementar**

```tsx
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

export default function SorteioPrint(p: Props) {
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
        <div style={{ fontSize: 12, color: '#475569' }}>seed: <span style={{ fontFamily: 'monospace' }}>{p.seed}</span></div>
      </div>

      {p.modalidadeTipo === 'grupos' && (
        <SorteioGrupos resultado={p.resultado} participantesById={p.participantesById} campeoesByParticipanteId={p.campeoesByParticipanteId} anfitriaoPid={p.anfitriaoPid} subtituloLine={p.subtituloLine} />
      )}
      {p.modalidadeTipo === 'chaves' && (
        <SorteioChaves resultado={p.resultado} participantesById={p.participantesById} campeoesByParticipanteId={p.campeoesByParticipanteId} anfitriaoPid={p.anfitriaoPid} subtituloLine={p.subtituloLine} />
      )}
      {p.modalidadeTipo === 'ordem_entrada' && (
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
```

- [ ] **Step 4: Rodar (PASS)** + `cd frontend; npx tsc --noEmit`
- [ ] **Step 5: Commit**
```bash
git add frontend/src/pages/eventos/SorteioPrint.tsx frontend/src/pages/eventos/SorteioPrint.test.tsx
git commit -m "feat(pdf-sorteio): componente SorteioPrint (print-only)"
```

---

### Task 3: Botão PDF + render do SorteioPrint em EventoInscricoes

**Files:**
- Modify: `frontend/src/pages/eventos/EventoInscricoes.tsx` (bloco Sorteio, ~linha 717–731 botões; e dentro do branch `sorteioDaModalidade` ~linha 688)

- [ ] **Step 1: Importar `SorteioPrint` e o ícone `Report`**
No topo: `import SorteioPrint from './SorteioPrint'` e garantir `Report` em `../../lib/icons`.

- [ ] **Step 2: Adicionar botão PDF** ao lado de "Re-sortear"/"Apagar" (dentro do `<div className="flex gap-3">`), com classe `no-print`:
```tsx
<button
  onClick={() => window.print()}
  className="text-xs text-[var(--t2)] hover:text-[var(--t1)] font-semibold no-print"
  title="Imprimir / Exportar PDF"
>PDF</button>
```

- [ ] **Step 3: Renderizar `<SorteioPrint>`** logo após o `</section>` do card Sorteio (só quando há sorteio e tipo != especifico):
```tsx
{sorteioDaModalidade && tipoDaModalidade !== 'especifico' && modalidadeAtual && (
  <SorteioPrint
    eventoNome={evento?.nome ?? ''}
    anfitriao={evento?.anfitriao?.nome ?? '—'}
    modalidadeNome={modalidadeAtual.nome}
    modalidadeTipo={tipoDaModalidade as any}
    sigla={modalidadeAtual.sigla ?? ''}
    cidadeLocalData={`${evento?.municipio?.nome ?? ''} · ${evento?.local ?? ''} · ${evento ? formatDateBR(evento.data_hora) : ''}`}
    seed={sorteioDaModalidade.seed}
    resultado={sorteioDaModalidade.resultado}
    participantesById={participantesById}
    campeoesByParticipanteId={campeoesByParticipanteId}
    anfitriaoPid={evento?.anfitriao_id ?? null}
    subtituloLine={subtituloLine}
    inscritos={inscricoes.map((i: any) => ({ id: i.participante_id, nome: i.participante?.nome ?? '—' }))}
    campeoes={[...campeoes].sort((a:any,b:any)=>a.posicao-b.posicao).map((c:any)=>({ posicao: c.posicao, nome: c.participante?.nome ?? '—' }))}
  />
)}
```
> Conferir nomes reais no arquivo: a lista de inscritos pode se chamar `inscricoes` (derivada de `inscricoesRaw`); `evento.municipio` pode não existir no select — se faltar, ajustar o `cidadeLocalData` para o que houver (ex.: só local + data). NÃO inventar campos.

- [ ] **Step 4: `cd frontend; npx tsc --noEmit`** (sem erros) + `npm test` (sem regressões)
- [ ] **Step 5: Commit**
```bash
git add frontend/src/pages/eventos/EventoInscricoes.tsx
git commit -m "feat(pdf-sorteio): botao PDF + SorteioPrint no bloco Sorteio"
```

---

### Task 4: Verificação visual (manual)
- [ ] Abrir EventoInscricoes com uma modalidade sorteada (grupos e chaves) → clicar PDF → no preview de impressão: sai só o bloco, com logo, Cidade Sede, dados/seed, o sorteio, campeões e inscritos, em **cores claras**. Botões não aparecem.

---

## Self-Review
- Spec coverage: logo ✓ (LogoMontana), dados+seed ✓, sorteio ✓ (reuso componentes), campeões ✓, inscritos ✓, só modalidade selecionada ✓, só quando há sorteio + não-especifico ✓, window.print ✓, cores claras ✓ (override de vars).
- Verificações no início: confirmar os nomes reais (`inscricoes`, `evento.municipio`) em EventoInscricoes antes de colar Task 3.
