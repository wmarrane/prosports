# Contagem de modalidades distintas (por evento) + cabeçalho/grupos mobile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cards de evento (site público e admin) contam modalidades distintas por **esporte** (1ª palavra) e por **evento** (ignorando excluídas); no mobile, reduzir um pouco os grupos e pôr o cabeçalho da modalidade em duas linhas.

**Architecture:** Helper puro `esporteBase(nome)` duplicado em front e back (padrão já usado em `lib/sorteaveis.ts`). Site público já é por evento (snapshot exclui modalidades removidas). Admin calcula `modalidades_distintas` no backend (o payload não traz `nome`). Layout mobile via CSS do site público.

**Tech Stack:** Backend Node/TS + Prisma + Vitest; Frontend React 18 + Vite + TS; site estático SSG; verificação Playwright.

**Spec:** `docs/superpowers/specs/2026-06-15-contagem-modalidades-distintas-e-cabecalho-design.md`

**Notas gerais:** Git identity não configurada — commitar com `-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`. Usar caminhos absolutos com `git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2"`. Windows host (Bash tool). Ler cada arquivo antes de editar.

---

### Task 1: Backend — `esporteBase` + `modalidades_distintas` por evento

**Files:**
- Create: `backend/src/lib/esporte.ts`
- Modify: `backend/src/modules/eventos/eventos.service.ts` (LIST_INCLUDE select; `.map` do `listar`)
- Test: `backend/src/modules/eventos/eventos.service.test.ts`

- [ ] **Step 1: Criar o helper**

Criar `backend/src/lib/esporte.ts`:
```ts
export function esporteBase(nome: string): string {
  const i = nome.indexOf('·')
  return (i > 0 ? nome.slice(0, i) : nome.split(' ')[0]).trim()
}
```

- [ ] **Step 2: Escrever o teste que falha**

Em `backend/src/modules/eventos/eventos.service.test.ts`, adicionar (após o teste "listar exclui modalidades excluidas..."):
```ts
it('listar conta modalidades_distintas por esporte (1a palavra), ignorando excluidas', async () => {
  mockPrisma.evento.findMany.mockResolvedValue([
    { id: 1, competicao: { modalidades: [
      { id: 10, nome: 'Atletismo Feminino Cat. A', mensagens_inscritos: [], tipo_modalidade: { tipo: 'grupos' } },
      { id: 11, nome: 'Atletismo Masculino Cat. B', mensagens_inscritos: [], tipo_modalidade: { tipo: 'grupos' } },
      { id: 12, nome: 'Basquete 3x3 Feminino Cat. A', mensagens_inscritos: [], tipo_modalidade: { tipo: 'grupos' } },
      { id: 13, nome: 'Bocha Rafa Masculino ou Misto', mensagens_inscritos: [], tipo_modalidade: { tipo: 'grupos' } },
    ] } },
  ])
  mockPrisma.inscricao.groupBy.mockResolvedValue([])
  mockPrisma.sorteio.findMany.mockResolvedValue([])
  mockPrisma.eventoModalidadeExcluida.findMany.mockResolvedValue([
    { evento_id: 1, modalidade_id: 13 }, // Bocha excluida -> nao conta
  ])
  const [e] = await service.listar() as any[]
  // Atletismo (2 linhas -> 1) + Basquete = 2; Bocha excluida
  expect(e.modalidades_distintas).toBe(2)
})
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `cd backend && npx vitest run src/modules/eventos/eventos.service.test.ts -t "modalidades_distintas"`
Expected: FAIL (`modalidades_distintas` é `undefined`).

- [ ] **Step 4: Adicionar `nome` ao select e calcular o campo**

Em `backend/src/modules/eventos/eventos.service.ts`:

(a) No `LIST_INCLUDE`, no `select` das `modalidades`, adicionar `nome: true`:
```ts
        select: {
          id: true,
          nome: true,
          mensagens_inscritos: true,
          tipo_modalidade: { select: { tipo: true } },
        },
```

(b) Importar o helper no topo do arquivo (junto dos outros imports):
```ts
import { esporteBase } from '../../lib/esporte'
```

(c) No `.map(e => ...)` do `listar`, antes do `return`, usando o `excluidas` já existente, montar o set de esportes:
```ts
    const esportes = new Set<string>()
    for (const m of (e as any).competicao?.modalidades ?? []) {
      if (excluidas.has(m.id)) continue
      esportes.add(esporteBase(m.nome))
    }
```
e no objeto retornado adicionar:
```ts
      modalidades_distintas: esportes.size,
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `cd backend && npx vitest run src/modules/eventos/eventos.service.test.ts`
Expected: PASS (todos os testes do arquivo).

- [ ] **Step 6: Build do backend**

Run: `cd backend && npm run build`
Expected: sem erros de TypeScript.

- [ ] **Step 7: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add backend/src/lib/esporte.ts backend/src/modules/eventos/eventos.service.ts backend/src/modules/eventos/eventos.service.test.ts
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(eventos): conta modalidades distintas por esporte e por evento"
```

---

### Task 2: Admin — usar `modalidades_distintas` no card

**Files:**
- Modify: `frontend/src/types/evento.ts`
- Modify: `frontend/src/pages/eventos/EventosList.tsx`

- [ ] **Step 1: Adicionar o campo ao tipo `Evento`**

Em `frontend/src/types/evento.ts`, dentro de `Evento`, junto de `modalidades_sorteaveis?`/`modalidades_pendentes?`, adicionar:
```ts
  modalidades_distintas?: number
```

- [ ] **Step 2: Usar o campo no card**

Em `frontend/src/pages/eventos/EventosList.tsx`, na função do `.map` dos eventos, logo após a linha:
```tsx
                    const totalModalidades = ev.competicao?.modalidades?.length ?? 0
```
adicionar:
```tsx
                    const modalidadesCount = ev.modalidades_distintas ?? totalModalidades
```
E no Meta de modalidades (a linha com `<Meta icon={Layers} label={String(totalModalidades)} sub="modalidades" />`), trocar `String(totalModalidades)` por `String(modalidadesCount)`:
```tsx
                          <Meta icon={Layers} label={String(modalidadesCount)} sub="modalidades" />
```
(Não remover `totalModalidades`: ele continua sendo o fallback e é usado por `sorteaveis = ev.modalidades_sorteaveis ?? totalModalidades`.)

- [ ] **Step 3: Build do frontend**

Run: `cd frontend && npm run build`
Expected: `tsc -b && vite build` sem erros.

- [ ] **Step 4: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/types/evento.ts frontend/src/pages/eventos/EventosList.tsx
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(eventos): card do admin mostra modalidades distintas do evento"
```

---

### Task 3: Site público — util `esporteBase` + contagem no card

**Files:**
- Create: `frontend/src/site-publico/lib/esporte.ts`
- Modify: `frontend/src/site-publico/pages/EventoPage.tsx`
- Modify: `frontend/src/site-publico/components/EventoCard.tsx`

- [ ] **Step 1: Criar o util compartilhado**

Criar `frontend/src/site-publico/lib/esporte.ts`:
```ts
export function esporteBase(nome: string): string {
  const i = nome.indexOf('·')
  return (i > 0 ? nome.slice(0, i) : nome.split(' ')[0]).trim()
}
```

- [ ] **Step 2: Reusar no `EventoPage` (DRY, comportamento idêntico)**

Em `frontend/src/site-publico/pages/EventoPage.tsx`:
- Adicionar import (após os imports existentes):
```ts
import { esporteBase } from '../lib/esporte'
```
- Substituir a função `categoriaDe` atual:
```ts
function categoriaDe(m: SnapModalidade): string {
  if (m.grupo) return m.grupo
  const idx = m.nome.indexOf('·')
  return idx > 0 ? m.nome.slice(0, idx).trim() : m.nome.split(' ')[0]
}
```
por:
```ts
function categoriaDe(m: SnapModalidade): string {
  if (m.grupo) return m.grupo
  return esporteBase(m.nome)
}
```

- [ ] **Step 3: Contagem distinta no `EventoCard`**

Em `frontend/src/site-publico/components/EventoCard.tsx`:
- Adicionar import (após o import de tipos):
```ts
import { esporteBase } from '../lib/esporte'
```
- Trocar:
```ts
  const total = evento.modalidades.length
```
por:
```ts
  const total = new Set(evento.modalidades.map(m => esporteBase(m.nome))).size
```
(Rótulo "modalidades" permanece.)

- [ ] **Step 4: Build do frontend**

Run: `cd frontend && npm run build`
Expected: `tsc -b && vite build` sem erros.

- [ ] **Step 5: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/site-publico/lib/esporte.ts frontend/src/site-publico/pages/EventoPage.tsx frontend/src/site-publico/components/EventoCard.tsx
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(site-publico): card conta modalidades distintas por esporte"
```

---

### Task 4: Mobile — reduzir grupos + cabeçalho em duas linhas

**Files:**
- Modify: `frontend/src/components/sorteio-result/SorteioGrupos.tsx`
- Modify: `frontend/src/site-publico/pages/EventoPage.tsx`
- Modify: `frontend/src/site-publico/site.css`

- [ ] **Step 1: Classe no grid de grupos**

Em `frontend/src/components/sorteio-result/SorteioGrupos.tsx`, no `div` do grid (o que tem `display: 'grid'`), adicionar `className="grupos-grid"` mantendo o `style` inline:
```tsx
    <div className="grupos-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(min(${minCol}px, 100%), 1fr))`, gap }}>
```

- [ ] **Step 2: Agrupar meta+semente no cabeçalho**

Em `frontend/src/site-publico/pages/EventoPage.tsx`, dentro do `<summary>`, o trecho atual é:
```tsx
                <summary>
                  <strong>{m.nome}</strong>
                  <span className="mod-meta">{m.tipo} · {m.participantes.length} inscritos · {statusLabel(m)}</span>
                  {m.seed && <span className="mod-seed">semente {m.seed}</span>}
                </summary>
```
Trocar por (envolvendo meta+semente em `.mod-sub`):
```tsx
                <summary>
                  <strong>{m.nome}</strong>
                  <div className="mod-sub">
                    <span className="mod-meta">{m.tipo} · {m.participantes.length} inscritos · {statusLabel(m)}</span>
                    {m.seed && <span className="mod-seed">semente {m.seed}</span>}
                  </div>
                </summary>
```

- [ ] **Step 3: CSS mobile**

Em `frontend/src/site-publico/site.css`, no bloco `@media (max-width: 720px)` já existente (o que tem `.mod-body` e `.bracket-canvas`), adicionar:
```css
  .grupos-grid { zoom: 0.9; }
  .mod-acc > summary { flex-direction: column; align-items: flex-start; gap: 6px; }
  .mod-sub { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
```

- [ ] **Step 4: Build do frontend**

Run: `cd frontend && npm run build`
Expected: `tsc -b && vite build` sem erros.

- [ ] **Step 5: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/components/sorteio-result/SorteioGrupos.tsx frontend/src/site-publico/pages/EventoPage.tsx frontend/src/site-publico/site.css
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(site-publico): grupos menores e cabecalho em duas linhas no mobile"
```

---

### Task 5: Verificação visual no mobile

**Files:** nenhum (verificação). Possível ajuste fino de valores em `site.css`.

- [ ] **Step 1: Gerar o site estático local**

Restaurar um snapshot temporário com grupos e chaves (não commitar; é arquivo rastreado, restaurar do HEAD ao final):
```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" show ac464bc:frontend/public-site-snapshots/evento-9.json > "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\public-site-snapshots\evento-9.json"
```
ATENÇÃO: se `frontend/public-site-snapshots/evento-9.json` já existir e estiver rastreado (`git status`), NÃO sobrescrever — usar o arquivo já presente. Build:
```
cd frontend && npm run build:site
```
Servir:
```
cd frontend/dist-site && python -m http.server 4178
```

- [ ] **Step 2: Conferir contagem e layout (mobile)**

Playwright: `browser_resize` 390×844, `browser_navigate` `http://localhost:4178/eventos.html` (lista de cards) e verificar que o card do evento mostra um número de modalidades reduzido (esportes distintos), não o total de linhas. Depois abrir `evento-9.html` e via `browser_evaluate` conferir:
```js
() => {
  const cardCount = document.querySelector('.evento-counts span')?.textContent ?? null; // "N modalidades" (na pagina eventos.html)
  const sumStyle = (() => { const s = document.querySelector('.mod-acc > summary'); return s ? getComputedStyle(s).flexDirection : null })();
  const grupoZoom = (() => { const g = document.querySelector('.grupos-grid'); return g ? getComputedStyle(g).zoom : null })();
  return { sumFlexDir: sumStyle, grupoZoom };
}
```
Expected: `sumFlexDir` = "column" (cabeçalho empilhado), `grupoZoom` ≈ "0.9". Tirar screenshot de uma modalidade de grupos aberta e de um cabeçalho com nome longo para confirmar (sem sobreposição; grupos um pouco menores).

- [ ] **Step 3: Conferir não-regressão no desktop**

`browser_resize` 1280×900, navegar de novo; confirmar via `browser_evaluate` que `.mod-acc > summary` tem `flexDirection: "row"` e `.grupos-grid` tem `zoom: "1"` ( ou "normal").

- [ ] **Step 4: Encerrar e limpar**

`browser_close`; parar o `http.server` (porta 4178). Se o snapshot foi restaurado por este plano e NÃO é rastreado, removê-lo; se for rastreado, `git checkout HEAD -- frontend/public-site-snapshots/evento-9.json`. Conferir `git status` limpo (exceto ajuste fino opcional do `site.css`).

- [ ] **Step 5: Commit do ajuste fino (se houve)**

Se algum valor (`zoom`, gap) foi calibrado:
```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/site-publico/site.css
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "fix(site-publico): calibra grupos/cabecalho no mobile"
```
(Se não houve, pular.)

---

## Notas finais

- Site público é estático: re-publicar o evento (ou re-disparar o build) para a nova contagem/CSS aparecerem ao vivo.
- O admin reflete assim que o backend novo subir.
- Promoção `develop` → `main` só com confirmação do Wagner.
