# Exportar HTML: cabeças com o grupo de cada uma — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No relatório "Exportar HTML" (e no Imprimir) de modalidades de grupos, adicionar uma seção "Cabeças" listando cada cabeça e o grupo em que foi colocada (ex.: "1. Lençóis Paulista - Grupo A").

**Architecture:** Mudança só no frontend, em `SorteioPrintContent`. A cabeça de cada grupo é o 1º participante de `resultado.grupos[g].participantes`; é cabeça se for campeão (`campeoesByParticipanteId`) ou o anfitrião (`anfitriaoPid`). Deriva-se tudo do resultado já existente — sem backend, sem dados novos.

**Tech Stack:** React 18 + TS; relatório montado via `renderToStaticMarkup`. Build `tsc -b && vite build`.

**Spec:** `docs/superpowers/specs/2026-06-16-exportar-html-cabecas-grupo-design.md`

**Notas:** Git identity não configurada — commitar com `-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`. Caminhos absolutos com `git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2"`. Windows host. Sem teste unitário (render estático do relatório); verificação por build + inspeção manual.

---

### Task 1: Seção "Cabeças" em SorteioPrintContent

**Files:**
- Modify: `frontend/src/pages/eventos/SorteioPrint.tsx`

Estado atual relevante (dentro de `SorteioPrintContent(p: Props)`), o bloco de grupos:
```tsx
      {p.modalidadeTipo === 'grupos' && p.resultado && (
        <SorteioGrupos resultado={p.resultado} participantesById={p.participantesById} campeoesByParticipanteId={p.campeoesByParticipanteId} anfitriaoPid={p.anfitriaoPid} subtituloLine={p.subtituloLine} />
      )}
```
`Props` já inclui: `resultado: any`, `participantesById: Map<number, Participante>`, `campeoesByParticipanteId: Map<number, number>`, `anfitriaoPid: number | null`, `modalidadeTipo`.

- [ ] **Step 1: Calcular a lista de cabeças**

Dentro de `SorteioPrintContent`, no início da função (antes do `return`), adicionar:
```tsx
  const cabecas = p.modalidadeTipo === 'grupos' && p.resultado
    ? (p.resultado as { grupos: { letra: string; participantes: number[] }[] }).grupos
        .map(g => ({ pid: g.participantes[0], letra: g.letra }))
        .filter(g => g.pid != null && (p.campeoesByParticipanteId.has(g.pid) || g.pid === p.anfitriaoPid))
        .map((g, i) => ({ ordem: i + 1, nome: p.participantesById.get(g.pid)?.nome ?? '—', letra: g.letra }))
    : []
```

- [ ] **Step 2: Renderizar a seção "Cabeças" acima do quadro de grupos**

Logo **antes** do bloco `{p.modalidadeTipo === 'grupos' && p.resultado && (<SorteioGrupos ... />)}`, inserir:
```tsx
      {cabecas.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Cabeças</div>
          <ol style={{ margin: 0, paddingLeft: 18, color: '#1e293b', fontSize: 12 }}>
            {cabecas.map(c => <li key={c.ordem}>{c.nome} - Grupo {c.letra}</li>)}
          </ol>
        </div>
      )}
```

- [ ] **Step 3: Build do frontend**

Run: `cd frontend && npm run build`
Expected: `tsc -b && vite build` sem erros.

- [ ] **Step 4: Verificação manual (rápida)**

Iniciar o dev server (`cd frontend && npm run dev`), abrir um evento com modalidade de **grupos sorteada**, clicar em "Exportar HTML" (e/ou "Imprimir"), e conferir:
- aparece a seção "Cabeças" antes do quadro de grupos;
- itens no formato `Nome - Grupo X`, numerados 1., 2., 3.… na ordem A, B, C…;
- quando a competição considera anfitrião e ele está inscrito, ele aparece como cabeça do grupo C (3 grupos) ou D (4+);
- modalidade de grupos **sem** campeões nem anfitrião → seção não aparece;
- modalidades de chaves/ordem → sem seção "Cabeças".
(Se não for possível rodar a UI, declarar explicitamente que a verificação visual não foi feita.)

- [ ] **Step 5: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/pages/eventos/SorteioPrint.tsx
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(eventos): relatorio mostra cabecas com o grupo de cada uma"
```

---

## Notas finais

- Sem backend/migration. Mudança puramente de render do relatório.
- A seção aparece tanto no "Exportar HTML" quanto no "Imprimir" (mesmo `SorteioPrintContent`).
- Promoção `develop` → `main` só com confirmação do Wagner.
