# Detalhe público — correção dos indicadores (Modalidades + progresso) — Design

**Data:** 2026-06-28
**Status:** Aprovado (aguardando revisão da spec)

## Contexto

Na página pública de detalhe do evento (`EventoPage.tsx`), o hero mostra indicadores incorretos. Causa raiz: o snapshot inclui **todas** as modalidades ativas da *competição* (ex.: 66), inclusive sem inscritos, e o frontend usa essa contagem bruta.

Exemplo real (68º Jogos Regionais de Itatiba): 66 modalidades no total / 64 com inscritos / 37 sorteáveis (tipo≠específico) / 34 sorteadas / 21 esportes distintos.

Hoje o hero exibe: **Modalidades = 66** (bruto), **Categorias = 21** (esportes distintos), e a barra "Andamento dos sorteios" usa **M = 37** (sorteáveis por linha, inclui vazias).

## Objetivo (itens 3 e 4 do pedido)

1. **Indicador "Modalidades"** passa a contar **esportes distintos** (mesma definição de `categorias()` / `modalidades_distintas` do admin). **Remover** o indicador **"Categorias"**.
2. **Barra "Andamento dos sorteios"**: o total `M` passa a ser **sorteáveis com inscritos** (modalidades `tipo≠'especifico'` **e** `participantes.length > 0`), excluindo modalidades vazias que nunca serão sorteadas.

Escopo: **frontend apenas** (o snapshot já traz `participantes` por modalidade; nada de backend). Sem mudança no snapshot. Itens 1 (status real no snapshot/hero) e 2 (auto-publicação no congresso) ficam para o sub-projeto B.

## Decisões aprovadas

- "Modalidades" = esportes distintos (`categorias()`); o card "Categorias" sai do hero.
- Progresso: `progressoSorteios().sorteaveis` = `tipo≠'especifico'` **e** `participantes.length > 0`.
- O ajuste é no helper compartilhado `evento-stats.ts`, então o card da listagem (`EventoCardListagem`) também passa a refletir "sorteáveis com inscritos" — comportamento mais correto e consistente; os testes da listagem serão atualizados.

## Mudanças

### `frontend/src/site-publico/lib/evento-stats.ts`
- `progressoSorteios(e)`: `sorteaveis = e.modalidades.filter(m => m.tipo !== 'especifico' && m.participantes.length > 0).length`. `sorteadas`, `pct`, `done` permanecem com a mesma fórmula (sobre o novo `sorteaveis`).
- Adicionar um alias semântico para clareza no hero: `export function modalidadesDistintas(e: SnapEvento): number` = mesma implementação de `categorias` (esportes distintos via `esporteBase`). `categorias` permanece (não usado mais no hero, mas mantido se referenciado em testes) — OU reusar `categorias` direto. (Detalhe de nomeação resolvido no plano; sem inventar contagem nova.)

### `frontend/src/site-publico/pages/EventoPage.tsx` (hero `.ev-actions .stat-pair`)
- Remover o card **Categorias**.
- Card **Modalidades** passa a usar a contagem de esportes distintos (`modalidadesDistintas(evento)` / `categorias(evento)`).
- Ficam 3 indicadores: **Modalidades** (distintos) · **Inscritos** · **Com sorteio** (`prog.sorteadas`).
- Ajustar o layout do `.stat-pair` para 3 indicadores ficarem equilibrados (ex.: manter 2 colunas com o 3º ocupando a linha inteira, ou 3 colunas). Sem cores novas; reutilizar classes existentes.
- A faixa de info ("Sorteios" = `sorteadas/sorteaveis`) e a barra do hero passam a usar o `sorteaveis` corrigido automaticamente (mesmo `prog`).

## Testes / Verificação

- `cd frontend && npx vitest run src/site-publico && npm run build:site` verdes.
- **`evento-stats.test.ts`**: atualizar/asseverar que `progressoSorteios` ignora modalidades sem inscritos no `sorteaveis` (ex.: 1 modalidade `chaves` com inscritos + 1 `chaves` sem inscritos → `sorteaveis === 1`); `done` reflete o novo total.
- **`EventoPage` (hero)**: o hero não contém o rótulo "Categorias"; "Modalidades" exibe a contagem de esportes distintos; "Com sorteio" presente. (Asserções em `renderToStaticMarkup`.)
- Ajustar quaisquer asserções existentes em `EventoCardListagem.test.tsx`/`EventosPage.test.tsx` que dependam do `sorteaveis` antigo (se houver).
- **Demo (screenshots) antes do merge na develop**: hero do detalhe de um evento real mostrando "Modalidades" corrigido, sem "Categorias", e a barra com o total novo.

## Fora de escopo
- Status real do evento no snapshot/hero (item 1) e auto-publicação no congresso (item 2) → sub-projeto B.
- Mudanças no backend/snapshot.

## Restrições globais
- Host Windows; ler antes de editar; caminhos absolutos. Git identity inline (`-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`).
- Validar com `npm run build:site`. Reusar tokens/classes; sem cores novas. Nunca `git add -A`.
- Demo antes da develop; promoção a prod só com confirmação do Wagner.
