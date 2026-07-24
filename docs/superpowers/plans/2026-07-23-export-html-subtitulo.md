# Export HTML — subtítulo em grupos e inscritos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans. Steps usam checkbox (`- [ ]`).

**Goal:** No export HTML do evento, mostrar o subtítulo/município efetivo (override por modalidade no escolar; global no não-escolar) nas seções de grupos/chaves/ordem e adicionar o subtítulo na lista de Inscritos (2ª linha discreta).

**Architecture:** Mudança só no frontend. `SorteioPrint` (componente imprimível) ganha um subtítulo opcional por inscrito e o renderiza numa 2ª linha. `handleExportarHtml` monta o `participantesById` com `participanteEfetivo(i, subMunPorMod)` (em vez do participante cru) e calcula o subtítulo por inscrito com o mesmo helper.

**Tech Stack:** React + TypeScript + Vite; Vitest (testes de componente via `renderToStaticMarkup`).

## Global Constraints

- Host Windows; ler antes de editar; caminhos absolutos; git identity inline (`-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`); nunca `git add -A`.
- Frontend apenas — sem backend/endpoint. Verificação: `cd frontend && npm run build` (CI = `tsc -b && vite build`). Testes: `cd frontend && npx vitest run <arquivo>`.
- **Escolar** = override é fonte única (via `participanteEfetivo`, já existente em `frontend/src/lib/compose-subtitulo.ts`). **Não-escolar** = comportamento atual (regressão zero): sem `subtitulo_campos` o export fica idêntico.
- Subtítulo nos inscritos: **sempre que houver** (dirigido por `subtitulo_campos`); formato = **2ª linha discreta** (`fontSize: 10, color: '#64748b'`).

---

### Task 1: `SorteioPrint` renderiza o subtítulo do inscrito (2ª linha)

**Files:**
- Modify: `frontend/src/pages/eventos/SorteioPrint.tsx` (tipo `inscritos` na linha 21; render da lista nas linhas 82-84)
- Test: `frontend/src/pages/eventos/SorteioPrint.test.tsx` (criar)

**Interfaces:**
- Produces: `SorteioPrintContent` passa a aceitar `inscritos: { id: number; nome: string; subtitulo?: string | null }[]` e renderiza a 2ª linha quando `subtitulo` é verdadeiro.

- [ ] **Step 1: Escrever o teste que falha** — criar `frontend/src/pages/eventos/SorteioPrint.test.tsx`:

```tsx
import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SorteioPrintContent } from './SorteioPrint'

function baseProps(over: Record<string, unknown> = {}) {
  return {
    eventoNome: 'Jeesp',
    anfitriao: 'Cidade',
    modalidadeNome: 'Basquete',
    modalidadeTipo: undefined,
    sigla: 'BAS',
    cidadeLocalData: 'Birigui · Ginásio · 14/07/2026',
    seed: '',
    resultado: null,
    participantesById: new Map(),
    campeoesByParticipanteId: new Map(),
    anfitriaoPid: null,
    subtituloLine: () => null,
    campeoes: [],
    omitEventoHeader: true,
    inscritos: [{ id: 1, nome: 'SREL Araçatuba', subtitulo: 'EE Dr Carlos Rosa | Birigui/SP' }],
    ...over,
  } as any
}

it('inscritos mostram o subtítulo numa 2ª linha quando presente', () => {
  const html = renderToStaticMarkup(<SorteioPrintContent {...baseProps()} />)
  expect(html).toContain('SREL Araçatuba')
  expect(html).toContain('EE Dr Carlos Rosa | Birigui/SP')
  expect(html).toContain('#64748b') // cor da 2ª linha discreta
})

it('inscritos sem subtítulo mostram só o nome (sem 2ª linha)', () => {
  const html = renderToStaticMarkup(
    <SorteioPrintContent {...baseProps({ inscritos: [{ id: 2, nome: 'Time X', subtitulo: null }] })} />,
  )
  expect(html).toContain('Time X')
  expect(html).not.toContain('#64748b')
})
```

- [ ] **Step 2: Rodar e ver falhar** — `cd frontend && npx vitest run src/pages/eventos/SorteioPrint.test.tsx`
  Esperado: FALHA no 1º teste (não contém `#64748b`) — a 2ª linha ainda não existe. (Pode falhar já na compilação do tipo se o TS reclamar de `subtitulo`; ambos contam como "vermelho".)

- [ ] **Step 3: Implementar** — em `frontend/src/pages/eventos/SorteioPrint.tsx`:

  (a) Ampliar o tipo `inscritos` (linha 21). Trocar:
```tsx
  inscritos: { id: number; nome: string }[]
```
  por:
```tsx
  inscritos: { id: number; nome: string; subtitulo?: string | null }[]
```

  (b) Render da lista de inscritos (linhas 82-84). Trocar:
```tsx
        <ul style={{ margin: 0, paddingLeft: 18, color: '#1e293b', fontSize: 12, columns: 2 }}>
          {p.inscritos.map((i) => <li key={i.id}>{i.nome}</li>)}
        </ul>
```
  por:
```tsx
        <ul style={{ margin: 0, paddingLeft: 18, color: '#1e293b', fontSize: 12, columns: 2 }}>
          {p.inscritos.map((i) => (
            <li key={i.id} style={{ breakInside: 'avoid' }}>
              {i.nome}
              {i.subtitulo && <div style={{ fontSize: 10, color: '#64748b' }}>{i.subtitulo}</div>}
            </li>
          ))}
        </ul>
```

- [ ] **Step 4: Rodar e ver passar** — `cd frontend && npx vitest run src/pages/eventos/SorteioPrint.test.tsx`
  Esperado: 2 testes PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/pages/eventos/SorteioPrint.tsx frontend/src/pages/eventos/SorteioPrint.test.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(export): SorteioPrint mostra subtitulo do inscrito na 2a linha"
```

---

### Task 2: `handleExportarHtml` usa o efetivo e passa o subtítulo

**Files:**
- Modify: `frontend/src/pages/eventos/EventoInscricoes.tsx` (linha 358 monta `pById`; linha 386 monta `inscritos`)

**Interfaces:**
- Consumes: `participanteEfetivo` (já importado de `../../lib/compose-subtitulo`), `subMunPorMod` (linha 196) e `subtituloLine` (linha 194), todos já existentes no arquivo; e o `inscritos` estendido da Task 1.

- [ ] **Step 1: Efetivo no `participantesById`** — em `frontend/src/pages/eventos/EventoInscricoes.tsx`, dentro de `handleExportarHtml`, trocar a linha 358:
```tsx
        for (const i of ordenadas) pById.set(i.participante_id, i.participante)
```
  por:
```tsx
        for (const i of ordenadas) pById.set(i.participante_id, participanteEfetivo(i, subMunPorMod))
```
  (No escolar isso faz grupos/chaves/ordem mostrarem o override; no não-escolar `participanteEfetivo(i, false)` devolve `i.participante` → idêntico.)

- [ ] **Step 2: Subtítulo por inscrito** — na mesma função, trocar a prop `inscritos` (linha 386):
```tsx
            inscritos={ordenadas.map(i => ({ id: i.participante_id, nome: i.participante?.nome ?? '—' }))}
```
  por:
```tsx
            inscritos={ordenadas.map(i => ({
              id: i.participante_id,
              nome: i.participante?.nome ?? '—',
              subtitulo: subtituloLine(participanteEfetivo(i, subMunPorMod)),
            }))}
```

- [ ] **Step 3: Verificar build** — `cd frontend && npm run build`
  Esperado: `tsc -b && vite build` verdes (sem erros de tipo; `inscritos` agora casa com o tipo estendido da Task 1).

- [ ] **Step 4: Commit**
```bash
git add frontend/src/pages/eventos/EventoInscricoes.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(export): export HTML usa participanteEfetivo (grupos) e passa subtitulo aos inscritos"
```

---

## Verificação final (após as tasks)

- [ ] `cd frontend && npx vitest run src/pages/eventos/SorteioPrint.test.tsx` e `cd frontend && npm run build` verdes.
- [ ] **Teste manual do export** (botão "Exportar HTML" na tela de Inscrições do evento):
  - **Escolar** ("Jeesp Mirim Etapa I"): em cada modalidade, grupos/chaves/ordem e a lista de Inscritos mostram o subtítulo (escola) + município do **override** por SREL (2ª linha nos inscritos).
  - **Não-escolar com `subtitulo_campos`:** subtítulo aparece nos inscritos (2ª linha) e nos grupos como antes.
  - **Não-escolar sem campos:** export idêntico ao atual (só nomes).

## Self-Review (cobertura da spec)
- Grupos/chaves/ordem usam o efetivo (override no escolar): Task 2 Step 1 ✓.
- Inscritos mostram subtítulo, 2ª linha discreta, sempre que houver: Task 1 (render) + Task 2 Step 2 (dados) ✓.
- Regressão zero não-escolar: `participanteEfetivo(i, false)` = participante; sem campos → `subtituloLine` null → sem 2ª linha ✓.
- Sem backend: nenhuma task toca backend ✓.
