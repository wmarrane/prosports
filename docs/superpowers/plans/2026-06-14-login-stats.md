# Login stats — inscritos distintos + Eventos sorteados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans. Steps usam checkbox (`- [ ]`).

**Goal:** No `/stats/public`, contar "inscritos ativos" como participantes distintos por evento e adicionar o indicador "Eventos sorteados" (status='sorteado', global); exibir o 4º indicador no login.

**Architecture:** Backend muda 1 handler (`stats.routes.ts`); frontend adiciona 1 campo ao tipo e 1 item na faixa de stats do login.

**Tech Stack:** Node/Express/Prisma (backend), React/TS/Vite (frontend).

**Validação obrigatória:** backend `npm run build`; frontend `npm run build` + `npm run test`.

**Spec:** `docs/superpowers/specs/2026-06-14-login-inscritos-ativos-distintos-design.md`

**Git:** identidade NÃO configurada — commitar inline (`git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit ...`). Não pular hooks. Caminhos absolutos.

---

## Task 1: Backend — /stats/public (inscritos distintos + eventos_sorteados)

**Files:** Modify `backend/src/modules/stats/stats.routes.ts`

- [ ] **Step 1: Trocar o cálculo**

Trocar o bloco:
```ts
    const [inscritos_ativos, sorteios_realizados] = await Promise.all([
      prisma.inscricao.count({ where: { evento: { data_hora: { gte: hoje } } } }),
      prisma.sorteio.count(),
    ])

    res.json({ inscritos_ativos, sorteios_realizados })
```
Por:
```ts
    const [participantesDistintos, sorteios_realizados, eventos_sorteados] = await Promise.all([
      prisma.inscricao.findMany({
        where: { evento: { data_hora: { gte: hoje } } },
        distinct: ['evento_id', 'participante_id'],
        select: { evento_id: true },
      }),
      prisma.sorteio.count(),
      prisma.evento.count({ where: { status: 'sorteado' } }),
    ])

    const inscritos_ativos = participantesDistintos.length
    res.json({ inscritos_ativos, sorteios_realizados, eventos_sorteados })
```

- [ ] **Step 2: Build**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/backend" && npm run build`
Expected: PASS (`tsc`). (`status: 'sorteado'` é valor válido do enum `EventoStatus`.)

- [ ] **Step 3: Commit**
```bash
git add backend/src/modules/stats/stats.routes.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(stats): inscritos ativos distintos + eventos_sorteados no /stats/public"
```

---

## Task 2: Frontend — tipo + 4º indicador no login

**Files:** Modify `frontend/src/services/stats.ts`, `frontend/src/pages/Login.tsx`

- [ ] **Step 1: Tipo PublicStats**

Em `frontend/src/services/stats.ts`, trocar:
```ts
export type PublicStats = {
  inscritos_ativos: number
  sorteios_realizados: number
}
```
Por:
```ts
export type PublicStats = {
  inscritos_ativos: number
  sorteios_realizados: number
  eventos_sorteados: number
}
```

- [ ] **Step 2: Adicionar o item na faixa de stats**

Em `frontend/src/pages/Login.tsx`, trocar:
```tsx
          {[
            [stats ? fmtNum(stats.inscritos_ativos) : '—', 'Inscritos ativos'],
            [stats ? fmtNum(stats.sorteios_realizados) : '—', 'Sorteios realizados'],
            ['100%', 'Auditados'],
          ].map(([v, l]) => (
```
Por:
```tsx
          {[
            [stats ? fmtNum(stats.inscritos_ativos) : '—', 'Inscritos ativos'],
            [stats ? fmtNum(stats.sorteios_realizados) : '—', 'Sorteios realizados'],
            [stats ? fmtNum(stats.eventos_sorteados) : '—', 'Eventos sorteados'],
            ['100%', 'Auditados'],
          ].map(([v, l]) => (
```

- [ ] **Step 3: Build + test**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend" && npm run build`
Expected: PASS (`tsc -b && vite build`).
Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend" && npm run test`
Expected: PASS.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/services/stats.ts frontend/src/pages/Login.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(login): exibir indicador Eventos sorteados nas stats"
```

---

## Manual Test Checklist
- Abrir o login → faixa mostra 4 indicadores: **Inscritos ativos · Sorteios realizados · Eventos sorteados · Auditados**.
- "Inscritos ativos" agora reflete participantes distintos por evento (mesmo participante em N modalidades de um evento conta 1).
- "Eventos sorteados" = nº de eventos com status `sorteado`.

## Self-Review
**Spec coverage:** inscritos distintos (T1) ✓; eventos_sorteados backend (T1) ✓; tipo + 4º item no login (T2) ✓; sorteios_realizados/auditados inalterados ✓.
**Placeholders:** nenhum; blocos completos.
**Type consistency:** resposta `{ inscritos_ativos, sorteios_realizados, eventos_sorteados }` ↔ `PublicStats` com os 3 campos ↔ `Login.tsx` lê os 3. `status: 'sorteado'` ∈ enum EventoStatus.
