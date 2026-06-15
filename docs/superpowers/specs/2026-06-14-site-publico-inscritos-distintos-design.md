# Site público: "inscritos" = participantes distintos — Design

**Data:** 2026-06-14
**Status:** Aprovado (aguardando revisão da spec)

## Problema

No site público, o card do evento mostra "X inscritos" somando `participantes.length` de cada modalidade — conta **linhas** (participante × modalidade). Ex.: evento "Jogos da Melhor Idade de Assis" mostra 610, mas deveria ~50 (participantes distintos). É o mesmo tipo de erro já corrigido no admin (`total_participantes`), mas o site público é um caminho **separado** (SSG a partir do snapshot) e não foi corrigido.

## Decisão

- Contagem **por evento**, igual ao card do admin: **participantes distintos** por `id`. Cada `SnapParticipante` no snapshot tem `id`, então deduplica por id.

## Contexto

- `frontend/src/site-publico/components/EventoCard.tsx:5`:
  `const inscritos = evento.modalidades.reduce((s, m) => s + m.participantes.length, 0)` → soma de linhas.
- `frontend/src/site-publico/pages/EventosPage.tsx:27`: total por ano com o mesmo bug (soma de `participantes.length` de todos os eventos do ano).
- `EventoPage.tsx` usa `participantes.length` **por modalidade** (correto) — **não** mexer.
- O número é calculado no render do SSG (não está no snapshot). `SnapParticipante.id` existe.

## Mudança (frontend, site público)

### `EventoCard.tsx`
Trocar:
```ts
const inscritos = evento.modalidades.reduce((s, m) => s + m.participantes.length, 0)
```
Por:
```ts
const inscritos = new Set(evento.modalidades.flatMap(m => m.participantes.map(p => p.id))).size
```

### `EventosPage.tsx` (total por ano)
Trocar:
```ts
const inscritos = lista.reduce((s, e) => s + e.modalidades.reduce((t, m) => t + m.participantes.length, 0), 0)
```
Por (distintos por evento, somados no ano):
```ts
const inscritos = lista.reduce((s, e) => s + new Set(e.modalidades.flatMap(m => m.participantes.map(p => p.id))).size, 0)
```

## Importante — efeito do snapshot

O site público é **estático (snapshot)**. Após o deploy do fix, as páginas já publicadas **só refletem o número corrigido quando reconstruídas** — ou seja, é preciso **re-publicar** o evento (ou re-disparar o build do site). O snapshot atual não muda sozinho.

## Testes

- `npm run build` (frontend). A lógica é trivial (Set de ids); verificação manual após re-publicar: card mostra participantes distintos. Sem teste unitário dedicado (render SSG).
- Sem backend/migration.

## Fora de escopo

- Mudar contagem por modalidade no `EventoPage.tsx` (já correta).
- Precomputar o total no snapshot (mantém cálculo no render).
- Headcount global (decisão: por evento, como no admin).
