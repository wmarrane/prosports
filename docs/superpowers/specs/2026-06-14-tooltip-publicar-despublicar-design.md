# Tooltip de publicar/despublicar (comportamento de snapshot) — Design

**Data:** 2026-06-14
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Adicionar tooltips (atributo `title` nativo, mesmo padrão já usado) nos botões de publicação do card de evento, explicando que o site público é um **snapshot** — para refletir mudanças, é preciso publicar novamente — e que despublicar/re-publicar leva ~1–2 min.

## Contexto atual (`frontend/src/pages/eventos/EventosList.tsx`)

No rodapé do card (ações), quando `ev.site_publicado_em`:
- **Despublicar** (linhas ~353-357): sem `title`.
- **Publicar no site** (linhas ~359-364): `title` só quando desabilitado (`ev.status !== 'sorteado' ? 'Disponível apenas quando o evento estiver Sorteado' : undefined`).

## Mudança (frontend-only)

- **Despublicar:** adicionar `title="Remove o evento do site público (~1–2 min). Re-publicar atualiza/sobrescreve o snapshot."`.
- **Publicar no site:** tornar o `title` dinâmico:
  - status ≠ sorteado → "Disponível apenas quando o evento estiver Sorteado" (inalterado).
  - status = sorteado → "Publica um retrato (snapshot) do evento no site público (~1–2 min). Para refletir mudanças depois, publique novamente.".

Sem mudança de comportamento, estilos ou lógica — apenas os textos de `title`.

## Testes

- `npm run build`; manual: passar o mouse nos botões mostra os tooltips; publicar/despublicar continuam funcionando.
- Sem backend/migration.

## Fora de escopo

- Tooltip rico/custom (mantém o `title` nativo).
- Avisos em outras telas.
