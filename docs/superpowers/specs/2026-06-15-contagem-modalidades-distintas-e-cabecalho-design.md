# Contagem de modalidades distintas (por evento) + ajustes de layout — Design

**Data:** 2026-06-15
**Status:** Aprovado (aguardando revisão da spec)

## Problema

Três ajustes pedidos:

1. **Contagem de modalidades** nos cards conta **linhas** (cada combinação esporte × categoria). Ex.: evento 9 mostra 75, mas tem 14 esportes distintos (Atletismo, Basquete, Bocha, Buraco, Coreografia, Damas, Dança, Dominó, Malha, Natação, Tênis, Truco, Voleibol, Xadrez). Categorias **não** devem ser contadas. Vale para o card do site público **e** o card de evento do admin (congresso). A contagem precisa ser **do evento** (não da competição), pois eventos podem excluir modalidades cadastradas na competição.
2. No site público (mobile), os **grupos** ficaram um pouco grandes; reduzir levemente.
3. No site público (mobile), o **cabeçalho da modalidade** com nome longo sobrepõe o meta (`· N inscritos · status`) e a semente. Pôr em duas linhas resolve.

## Decisões

- **Esporte base = 1ª palavra do nome** (parte antes de `·` se existir; senão o primeiro token), com `trim()`. Mesma lógica do `categoriaDe` que já agrupa as seções da `EventoPage` — assim o número do card coincide com o nº de seções. Confirmado com dados reais (evento 9 → 14).
- **Contagem por evento:** considerar apenas modalidades **não excluídas** do evento.
- Helper `esporteBase` duplicado em frontend e backend (mesmo padrão já adotado em `lib/sorteaveis.ts`), pois os dois ambientes não compartilham código.

## Regra (referência)

```ts
export function esporteBase(nome: string): string {
  const i = nome.indexOf('·')
  return (i > 0 ? nome.slice(0, i) : nome.split(' ')[0]).trim()
}
```

## Mudança 1 — Contagem de modalidades distintas

### Site público (já é por evento)
O snapshot monta `evento.modalidades` a partir das modalidades da competição **menos as excluídas** (`backend/src/modules/site-publico/site-publico.service.ts` → `getModalidadeIdsExcluidas` → `modalidadesFiltradas`). Então a contagem no frontend já fica por evento.

- Criar util compartilhado `frontend/src/site-publico/lib/esporte.ts` exportando `esporteBase`.
- `frontend/src/site-publico/pages/EventoPage.tsx`: trocar a `categoriaDe` inline para usar `esporteBase` (mantendo a checagem de `m.grupo` que precede): a função passa a ser `if (m.grupo) return m.grupo; return esporteBase(m.nome)`. Comportamento idêntico ao atual (DRY).
- `frontend/src/site-publico/components/EventoCard.tsx`: trocar
  ```ts
  const total = evento.modalidades.length
  ```
  por
  ```ts
  const total = new Set(evento.modalidades.map(m => esporteBase(m.nome))).size
  ```
  Rótulo permanece "modalidades".

### Admin (card de evento — congresso)
Hoje `frontend/src/pages/eventos/EventosList.tsx:174` usa `ev.competicao?.modalidades?.length` (escopo competição, igual para todos os eventos). Passar a contagem por **evento** e por **esporte distinto**, calculada no backend (o payload de modalidades não traz `nome`).

- `backend/src/modules/eventos/eventos.service.ts`:
  - No `LIST_INCLUDE`, adicionar `nome: true` ao `select` das `modalidades`.
  - Criar `backend/src/lib/esporte.ts` exportando `esporteBase` (mesma regra).
  - No `.map(e => ...)` do `listar`, usando o `excluidas` já calculado:
    ```ts
    const esportes = new Set<string>()
    for (const m of (e as any).competicao?.modalidades ?? []) {
      if (excluidas.has(m.id)) continue
      esportes.add(esporteBase(m.nome))
    }
    ```
    e retornar `modalidades_distintas: esportes.size` junto dos demais campos.
- `frontend/src/types/evento.ts`: adicionar `modalidades_distintas?: number` ao `Evento`.
- `frontend/src/pages/eventos/EventosList.tsx`: o Meta de modalidades (linha ~330) usa `ev.modalidades_distintas ?? totalModalidades`. `totalModalidades` permanece como fallback.

## Mudança 2 — Reduzir um pouco os grupos (mobile)

- `frontend/src/components/sorteio-result/SorteioGrupos.tsx`: adicionar `className="grupos-grid"` ao `div` do grid (sem mexer nos estilos inline existentes).
- `frontend/src/site-publico/site.css`, dentro do bloco `@media (max-width: 720px)` já existente: `.grupos-grid { zoom: 0.9; }`. Encolhe levemente; CSS só do site público (admin não importa `site.css`). `zoom` reflowa o box (sem espaço morto), igual ao usado nas chaves.

## Mudança 3 — Cabeçalho da modalidade em duas linhas (mobile)

- `frontend/src/site-publico/pages/EventoPage.tsx`: agrupar o meta e a semente num wrapper, dentro do `<summary>`:
  ```tsx
  <strong>{m.nome}</strong>
  <div className="mod-sub">
    <span className="mod-meta">{m.tipo} · {m.participantes.length} inscritos · {statusLabel(m)}</span>
    {m.seed && <span className="mod-seed">semente {m.seed}</span>}
  </div>
  ```
- `frontend/src/site-publico/site.css`, no bloco `@media (max-width: 720px)`:
  ```css
  .mod-acc > summary { flex-direction: column; align-items: flex-start; gap: 6px; }
  .mod-sub { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  ```
  Nome na 1ª linha; meta + semente na 2ª. No desktop (≥720px) o layout em linha atual é preservado.

## Testes / Verificação

- Backend: `npm run build` + suíte de `eventos.service` (adicionar asserção de `modalidades_distintas` por evento, inclusive ignorando excluídas). Sem migration.
- Frontend: `npm run build` (`tsc -b && vite build`).
- Conferência manual no mobile (evento 9 reconstruído localmente): card do site mostra 14; grupos um pouco menores; cabeçalho de nome longo em duas linhas sem sobreposição. No admin, o card do evento mostra a contagem por evento.

## Efeito do snapshot

Site público é estático: a nova contagem e o CSS só aparecem ao vivo após **re-publicar o evento** (ou re-disparar o build do site). O admin reflete assim que o backend novo subir.

## Fora de escopo

- Mudar a definição de "esporte" para dicionário de nomes compostos (mantém 1ª palavra, consistente com as seções).
- Alterar o agrupamento por seções da `EventoPage` (continua igual).
- Contagens em outras telas (ex.: `Admin.tsx` total global de modalidades) — permanecem como estão.
- Migration / mudança de modelo (Modalidade não ganha campo de categoria).
