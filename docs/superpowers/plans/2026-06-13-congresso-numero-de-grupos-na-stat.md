# Número de grupos na stat "Forma do sorteio" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na etapa Modalidade do Modo Congresso, exibir "N Grupos" na stat "Forma do sorteio" (apenas para tipo `grupos`), sem alterar mais nada do card.

**Architecture:** Frontend-only, um arquivo. `CongressoStepModalidade` carrega as regras de grupos da competição e, no detalhe, troca o valor da stat "Forma do sorteio" por `${quantidade_grupos} Grupos` quando a modalidade é `grupos` e existe regra para o nº de inscritos; caso contrário mantém o rótulo atual.

**Tech Stack:** React 18, TS, Vite, react-query.

**Validação obrigatória:** `npm run build` (`tsc -b && vite build`) + `npm run test` (regressão) em `C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend`. Tela sem teste unitário (convenção) — verificação por build + manual.

**Spec:** `docs/superpowers/specs/2026-06-13-congresso-numero-de-grupos-na-stat-design.md`

**Git:** identidade NÃO configurada — commitar inline (NÃO rodar `git config`): `git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit ...`. Não pular hooks.

---

## File Structure

- **Modify** `frontend/src/pages/congresso/CongressoStepModalidade.tsx` — import do serviço, query das regras de grupos, cálculo do rótulo e troca do valor da stat.

---

## Task 1: "N Grupos" na stat "Forma do sorteio"

**Files:**
- Modify: `frontend/src/pages/congresso/CongressoStepModalidade.tsx`

- [ ] **Step 1: Importar o serviço de sistemas de disputa**

Após a linha `import { inscricoesService } from '../../services/inscricoes'` (linha 5), adicionar:
```ts
import { sistemasDisputaService } from '../../services/sistemas-disputa'
```

- [ ] **Step 2: Query das regras de grupos da competição**

Logo após o bloco da query `inscricoesSel` (o `const { data: inscricoesSel = [], isLoading: inscricoesLoading } = useQuery({ ... })`), adicionar:
```ts
  const { data: regrasGrupos = [] } = useQuery({
    queryKey: ['sistemas-disputa-grupos', evento?.competicao_id],
    queryFn: () => sistemasDisputaService.grupos.listar(evento!.competicao_id),
    enabled: evento?.competicao_id != null,
  })
```

- [ ] **Step 3: Derivar quantidade de grupos e o rótulo da stat**

No bloco do detalhe (a IIFE `(() => { ... })()`), logo após a linha:
```ts
              const tipoLabel = selectedMod.tipo_modalidade ? TIPO_DISPUTA_LABEL[selectedMod.tipo_modalidade.tipo] : '—'
```
adicionar:
```ts
              const quantidadeGrupos = tipo === 'grupos'
                ? regrasGrupos.find(r => r.quantidade_equipes === inscricoesSel.length)?.quantidade_grupos
                : undefined
              const formaSorteioLabel = quantidadeGrupos != null ? `${quantidadeGrupos} Grupos` : tipoLabel
```

- [ ] **Step 4: Usar o novo rótulo só na stat "Forma do sorteio"**

Na stat "Forma do sorteio", trocar:
```tsx
                    <div className="cw-md-stat">
                      <b>{tipoLabel}</b>
                      <span>Forma do sorteio</span>
                    </div>
```
Por:
```tsx
                    <div className="cw-md-stat">
                      <b>{formaSorteioLabel}</b>
                      <span>Forma do sorteio</span>
                    </div>
```
(O eyebrow `<div className="cw-md-card-eyebrow">{tipoLabel}</div>` permanece com `tipoLabel` — não mexer.)

- [ ] **Step 5: Build + testes**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend" && npm run build`
Expected: PASS (`tsc -b && vite build`, sem erros).

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend" && npm run test`
Expected: PASS (suíte inteira — sem regressão).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/congresso/CongressoStepModalidade.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(congresso): mostrar numero de grupos na stat Forma do sorteio"
```

---

## Manual Test Checklist

`npm run dev` → Modo Congresso (`/congresso`) → evento com competição que tenha regras de grupos cadastradas:

- Selecionar uma modalidade **grupos** cujo nº de inscritos casa uma regra → stat "Forma do sorteio" mostra **"N Grupos"** (ex.: 18 inscritos → "3 Grupos"). O eyebrow no topo continua "Grupos".
- Modalidade **grupos** sem regra para o nº de inscritos (ex.: 0 inscritos) → stat mostra "Grupos".
- Modalidade de **chaves/ordem/específico** → stat inalterada (rótulo do tipo).

---

## Self-Review

**1. Spec coverage:**
- "N Grupos" só na stat "Forma do sorteio" → Step 4 (eyebrow intocado). ✓
- Só tipo grupos → `quantidadeGrupos` undefined para outros tipos → cai em `tipoLabel`. ✓
- Número via regra (`quantidade_equipes === inscricoesSel.length` → `quantidade_grupos`) → Step 3. ✓
- Sem regra → "Grupos" (fallback) → Step 3 (`!= null`). ✓
- Nenhuma mudança de estilo/layout/eyebrow. ✓

**2. Placeholder scan:** Sem TBD/TODO; blocos completos. ✓

**3. Type consistency:** `sistemasDisputaService.grupos.listar(competicao_id: number): Promise<SistemaGrupos[]>`; `SistemaGrupos` tem `quantidade_equipes`/`quantidade_grupos`. `evento.competicao_id` é `number`. `tipo`/`inscricoesSel` já no escopo da IIFE. ✓
