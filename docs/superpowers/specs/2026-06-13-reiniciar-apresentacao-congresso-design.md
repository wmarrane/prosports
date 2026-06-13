# Reiniciar evento (apagar sorteios + reiniciar apresentações) — Design

**Data:** 2026-06-13
**Status:** Aprovado (aguardando revisão da spec)

## Problema

As marcas de "apresentada/vista" do Modo Congresso (localStorage `prosports.congresso.vistas.{eventoId}`) só são resetadas hoje pelo botão **"Apagar sorteios"** em `EventoInscricoes`, que só aparece quando há `sorteadas > 0`. Num evento que percorreu modalidades **sem sortear** (específico / sorteio pulado), não há sorteio e, portanto, **não há como reiniciar** essas sinalizações.

## Objetivo

Em vez de criar um botão novo, **reusar o botão existente** "Apagar sorteios": deixá-lo **sempre visível** e relabelá-lo para **"Reiniciar evento"**, de modo que ele apague os sorteios (se houver) **e** reinicie as apresentações (vistas) — cobrindo o caso sem sorteio. Toca **apenas** `EventoInscricoes.tsx`.

## Decisões (do brainstorming)

- **Reusar** o botão "Apagar sorteios" (sem botão novo; sem mudança no Modo Congresso).
- Botão **sempre visível** (remover a condição `sorteadas > 0`).
- Rótulo **fixo: "Reiniciar evento"**.
- Ação: apaga todos os sorteios do evento (se houver) **e** limpa as vistas. **Não** remove inscrições nem campeões.

## Contexto atual (`EventoInscricoes.tsx`)

- Botão (linhas ~469-479): só renderiza quando `sorteadas > 0`; rótulo "Apagar sorteios" (`Trash2`); `disabled={eventoSuspenso}`; abre o modal via `setApagarTodosOpen(true)`.
- Mutation `apagarTodosSorteios` (linhas ~239-246): `mutationFn: () => sorteiosService.removerTodosDoEvento(eventoId)`; `onSuccess` já faz `setApagarTodosResumo(r)`, **`clearVistas(eventoId)`** (já implementado), e invalida `['sorteios', eventoId]`.
- Modal (linhas ~1350-1440): dois estados — confirmação (idle) com "Apagar todos os sorteios?" + botão "Apagar {sorteadas}"; e resumo (success) "Sorteios apagados".
- `removerTodosDoEvento` no backend faz `deleteMany({ where: { evento_id } })` → retorna `{ count }` (0 quando não há sorteios; chamada inócua).

## Mudanças (somente `EventoInscricoes.tsx`)

### Botão
- Remover a condição `sorteadas > 0` → **sempre visível** (mantém `disabled={eventoSuspenso}`).
- Rótulo: **"Reiniciar evento"**. Ícone: `RotateCcw` (importar de `lucide-react`); manter a cor de alerta (`var(--danger)`).
- `title`: "Apagar sorteios (se houver) e reiniciar as apresentações do Modo Congresso".

### Modal — estado de confirmação
- Ícone do círculo: `RotateCcw` (mantém o círculo `danger-soft`).
- Título: **"Reiniciar evento?"**.
- Descrição condicional a `sorteadas`:
  - `sorteadas > 0`: "Os **{sorteadas}** {sorteio/sorteios} de **{evento.nome}** serão apagados e as apresentações do Modo Congresso serão reiniciadas. Inscrições e campeões anteriores permanecem. Esta ação não pode ser desfeita."
  - `sorteadas === 0`: "As apresentações do Modo Congresso de **{evento.nome}** serão reiniciadas. Inscrições, campeões e sorteios não são afetados."
- Botão de confirmação: rótulo **"Reiniciar"** (ícone `RotateCcw`), estado de carregamento "Reiniciando...". (Remover o `Apagar {sorteadas}`.)

### Modal — estado de resumo (success)
- Título: **"Evento reiniciado"**.
- Descrição condicional a `apagarTodosResumo.count`:
  - `count > 0`: "**{count}** {sorteio apagado / sorteios apagados} e apresentações reiniciadas."
  - `count === 0`: "Apresentações reiniciadas."

### Lógica
- Nenhuma mudança de lógica: a mutation `apagarTodosSorteios` já apaga sorteios e (via `onSuccess`) chama `clearVistas`. Só muda visibilidade/cópia/ícone.

## Tratamento de erros / casos

- Evento sem sorteios e sem vistas: botão visível; ao confirmar, `removerTodosDoEvento` retorna `count 0` e `clearVistas` é no-op → resumo "Apresentações reiniciadas." (inócuo).
- Evento suspenso: botão desabilitado (igual a hoje).
- localStorage indisponível: `clearVistas` é no-op (try/catch já existente).
- Reset reflete no **próximo** Modo Congresso do evento (abre limpo); a tela do evento não exibe os checks.

## Testes

- `clearVistas` já tem testes; sem nova função pura.
- **Build + manual:** `npm run build`; manual — (a) evento só com apresentadas (sem sorteio): botão "Reiniciar evento" aparece → confirmar → Modo Congresso abre limpo; (b) evento com sorteios: "Reiniciar evento" apaga sorteios + reinicia apresentações (comportamento atual + reset de vistas); (c) inscrições/campeões permanecem.
- Sem backend/migration.

## Fora de escopo

- Botão de reiniciar dentro do Modo Congresso (o reset é feito pela tela do Evento).
- Reiniciar por modalidade (é por evento).
- Persistir "vistas" no backend.
- Separar "apagar sorteios" de "reiniciar apresentação" (decisão foi unificar num só botão).
