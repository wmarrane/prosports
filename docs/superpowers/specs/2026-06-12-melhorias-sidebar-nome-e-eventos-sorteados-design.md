# Melhorias: nome na sidebar + separar eventos "Sorteado" — Design

**Data:** 2026-06-12
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Duas melhorias pequenas e independentes:

1. **Sidebar:** mostrar o **nome** do usuário no lugar do e-mail.
2. **Lista de eventos:** **separar** os eventos com status **"Sorteado"** dos demais.

## Melhoria 1 — Nome na sidebar

Em `frontend/src/components/Sidebar.tsx`, a área do usuário (`.sb-user` / `.who`) mostra hoje `user?.email`. Trocar para `user?.nome` (com fallback para o e-mail se o nome estiver vazio). As iniciais do avatar passam a usar o nome (`(user?.nome ?? user?.email ?? 'U').slice(0,2).toUpperCase()`). A linha de papel (role) abaixo permanece.

## Melhoria 2 — Separar eventos "Sorteado"

Em `frontend/src/pages/eventos/EventosList.tsx`, hoje os eventos são agrupados por competição (`agruparEventosPorCompeticao`). Passar a renderizar **duas seções de topo**:

- **"Em andamento"** (ou sem rótulo): eventos com status **≠ `sorteado`**, mantendo o agrupamento por competição atual.
- **"Sorteados"**: eventos com status **= `sorteado`**, agrupados por competição da mesma forma, numa seção separada (abaixo da primeira), com um título de seção claro.

A divisão é por status do evento; os filtros/chips existentes (por tipo) e a busca continuam aplicando-se antes da divisão. Se uma das seções ficar vazia, ela não é renderizada (sem cabeçalho órfão).

## Testes

- Frontend: `npm run build` + teste manual (sidebar mostra o nome; lista exibe "Sorteados" separada dos demais; seções vazias não aparecem).
- Sem backend/migration.

## Fora de escopo

- Reordenar/reagrupar por outro critério além de status + competição.
- Mudanças no card do evento em si.
