# Regra de mensagem/"pular sorteio" no bloco Sorteio do EventoInscricoes — Design

**Data:** 2026-06-09
**Status:** Aprovado

## Objetivo

Aplicar a regra `mensagens_inscritos` (mensagem + "pular sorteio") também no card "Sorteio" da tela administrativa `EventoInscricoes`, espelhando o que já existe no Modo Congresso.

## Escopo

- **Frontend-only**, em `frontend/src/pages/eventos/EventoInscricoes.tsx` (card "Sorteio").
- Reusa `matchMensagem` (`lib/mensagens-inscritos`) e `modalidade.mensagens_inscritos` (só grupos/chaves têm regras).
- **Sem alteração de backend** (igual ao Modo Congresso, que apenas pula a navegação; aqui apenas oculta a ação de sortear na UI).

## Comportamento

- `regra = matchMensagem(modalidadeAtual?.mensagens_inscritos ?? [], inscricoes.length)`.
- Se `regra`: exibir a `mensagem` em **CAIXA ALTA, negrito, fonte grande** (banner de destaque) dentro do card "Sorteio".
- Se `regra.pular_sorteio === true`: no estado "aguardando sorteio", **ocultar o botão "Realizar sorteio"** (a modalidade não vai a sorteio). Se a regra casar sem `pular_sorteio`, mantém o botão.
- Se já houver sorteio (`sorteioDaModalidade`), o resultado continua sendo exibido; a mensagem aparece acima.
- Tipos `especifico`/`ordem_entrada` não têm `mensagens_inscritos` → `matchMensagem` retorna `null` → sem efeito.

## Testes

- `matchMensagem` já coberto por testes. A tela é validada por `npm run build` (tsc) + verificação manual (usa estado/queries; sem testing-library).

## Fora de escopo

- Bloqueio no backend do `executar` quando "pular sorteio" (mantém paridade com o Modo Congresso, que não bloqueia no backend).
