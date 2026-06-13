# Reiniciar apresentação (limpar "vistas") sem depender de sorteio — Design

**Data:** 2026-06-13
**Status:** Aprovado (aguardando revisão da spec)

## Problema

As marcas de "apresentada/vista" do Modo Congresso (localStorage `prosports.congresso.vistas.{eventoId}`) só são resetadas hoje pelo botão **"Apagar sorteios"** em `EventoInscricoes` — que só aparece quando há `sorteadas > 0`. Num evento que percorreu modalidades **sem sortear** (específico / sorteio pulado), não há sorteio e, portanto, **não há como reiniciar** essas sinalizações.

## Objetivo

Adicionar um controle **"Reiniciar apresentação"** que limpa as marcas de apresentada (vistas) do evento, **independente de haver sorteio**, com confirmação. Disponível **em dois lugares**: no Modo Congresso e na tela do Evento.

## Decisões (do brainstorming)

- Disponível em **ambos**: Modo Congresso (etapa de modalidades) e `EventoInscricoes`.
- **Com confirmação** (diálogo `ConfirmDialog`).
- Limpa **somente** as vistas (apresentadas). **Não** apaga sorteios — as sorteadas vêm do backend e continuam sendo removidas só por "Apagar sorteios".

## Contexto atual

- Helper `frontend/src/lib/congresso-vistas.ts` já tem `clearVistas(eventoId)` (remove a chave do localStorage) e `loadVistas(eventoId)`.
- `ModoCongresso.tsx` mantém `vistas`/`setVistas` e `vistasIds` (Set) passado para `CongressoStepModalidade`. O check verde da lista usa `concluida = sorteada ∪ vista`.
- `CongressoStepModalidade.tsx` exibe a lista com checks; já recebe `vistasIds`.
- `EventoInscricoes.tsx` usa `useToast` e o componente `ConfirmDialog` está disponível em `frontend/src/components/ConfirmDialog` (usado p.ex. em `EventosList`). A área de ações de sorteio mostra "Apagar sorteios" quando `sorteadas > 0`.

## Modo Congresso

- **`CongressoStepModalidade.tsx`:**
  - Nova prop `onReiniciarApresentacao?: () => void`.
  - Botão **"Reiniciar apresentação"** no cabeçalho (perto do `cw-sub`), visível somente quando `vistasIds.size > 0`.
  - Estado local `confirmReiniciar` + `ConfirmDialog`. Ao confirmar, chama `onReiniciarApresentacao?.()` e fecha o diálogo.
- **`ModoCongresso.tsx`:**
  - Handler `reiniciarApresentacao()`: `setVistas([])` e `clearVistas(eventoId!)`.
  - Passa `onReiniciarApresentacao={reiniciarApresentacao}` para `CongressoStepModalidade`.
  - Efeito: os checks verdes das **apresentadas** somem na hora; sorteadas (do backend) permanecem.

## Tela do Evento

- **`EventoInscricoes.tsx`:**
  - Estado local `temVistas` inicializado de `loadVistas(eventoId).length > 0`.
  - Botão **"Reiniciar apresentação"** junto às ações (ao lado de "Apagar sorteios"), visível quando `temVistas` — **independente de `sorteadas`**.
  - Estado `reiniciarOpen` + `ConfirmDialog`. Ao confirmar: `clearVistas(eventoId)`, `setTemVistas(false)`, toast "Apresentações reiniciadas." e fecha o diálogo.
  - A tela do evento não exibe os checks; o efeito aparece no próximo Modo Congresso (abre limpo).

## Diálogo de confirmação (ambos)

`ConfirmDialog`:
- eyebrow: "Modo Congresso"
- title: "Reiniciar apresentação"
- description: "As marcas de modalidades apresentadas serão removidas. Os sorteios não são afetados."
- confirmLabel: "Reiniciar"
- confirmVariant: padrão (não destrutivo de dados — apenas marcas locais)

## Tratamento de erros / casos

- localStorage indisponível → `clearVistas` é no-op (try/catch já existente).
- Sem vistas → botão não aparece (nos dois lugares).
- Evento com sorteios + vistas → "Reiniciar apresentação" limpa só as vistas; "Apagar sorteios" segue limpando sorteios (e, como já implementado, também as vistas).

## Testes

- `clearVistas` já tem testes. Sem nova função pura.
- **Build + manual:** `npm run build`; manual — (a) Modo Congresso: apresentar modalidades sem sortear → botão aparece → confirmar → checks das apresentadas somem, sorteadas intactas; (b) EventoInscricoes: com vistas e sem sorteios, o botão aparece → confirmar → toast + botão some, e o próximo Modo Congresso abre limpo.
- Sem backend/migration.

## Fora de escopo

- Reiniciar apresentação por modalidade (é tudo-ou-nada por evento).
- Persistir "vistas" no backend.
- Alterar o reset já existente acoplado a "Apagar sorteios".
