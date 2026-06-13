# Modo Congresso: pular modalidade sem inscritos pelo botão "Iniciar" — Design

**Data:** 2026-06-13
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Na tela **Modo Congresso**, etapa de modalidade, quando a modalidade selecionada tiver **zero inscritos**, o botão "Iniciar" deve **pular** para a próxima modalidade em vez de entrar na etapa de participantes (que ficaria vazia). A modalidade pulada é **marcada como apresentada** (mesmo check verde das demais).

## Decisões (do brainstorming)

- Pular uma modalidade sem inscritos **marca como apresentada** (vista, persistida) — ganha o check verde e sai do auto-avanço; reset via "Reiniciar evento".
- O rótulo do botão muda para **"Próxima"** quando há zero inscritos (e segue "Iniciar" quando há inscritos).

## Contexto atual (`frontend/src/pages/congresso/CongressoStepModalidade.tsx`)

- A query `inscricoesSel` (habilitada quando `selectedId != null`) já traz os inscritos do modalidade selecionado; o detalhe exibe `inscricoesSel.length` em "Inscritos".
- Já existem: `isConcluida(id) = sorteadasIds.has(id) || vistasIds.has(id)`, a prop `vistasIds`, e o auto-select da primeira não concluída.
- O botão de ação do detalhe hoje: `<button onClick={() => onSelect(selectedMod.id)} className="cw-btn cw-btn-primary cw-btn-xl">Iniciar <ArrowRight/></button>`.
- `ModoCongresso.tsx` mantém `vistas`/`setVistas` e já importa `addVista`/`saveVistas`; passa `vistasIds` para a etapa. `onSelect` faz `setModalidadeId(id); setStep('participantes')`.

## Mudanças

### `CongressoStepModalidade.tsx`
- Expor o estado de carregamento da query `inscricoesSel` (ex.: `const { data: inscricoesSel = [], isLoading: inscricoesLoading } = useQuery(...)`).
- Nova prop opcional `onPularVazia?: (modalidadeId: number) => void`.
- Calcular `const vazia = !inscricoesLoading && selectedMod != null && inscricoesSel.length === 0`.
- Handler de avanço:
  ```ts
  function pularVazia() {
    if (!selectedMod) return
    onPularVazia?.(selectedMod.id)
    const idx = modalidades.findIndex(m => m.id === selectedMod.id)
    const after = modalidades.slice(idx + 1).find(m => !isConcluida(m.id))
    const before = modalidades.slice(0, idx).find(m => !isConcluida(m.id))
    const proxima = after ?? before
    setSelectedId(proxima ? proxima.id : selectedMod.id)
  }
  ```
  (Próxima não concluída depois da atual; se não houver, a primeira antes; se nenhuma, permanece. A atual é excluída por `!isConcluida` só após marcar — por isso o `findIndex`/slice exclui a atual explicitamente.)
- Botão de ação:
  - Rótulo: `vazia ? 'Próxima' : 'Iniciar'`.
  - `onClick`: `vazia ? pularVazia() : onSelect(selectedMod.id)`.
  - Mantém o ícone `ArrowRight` e as classes.

### `ModoCongresso.tsx`
- Handler:
  ```ts
  function pularModalidadeVazia(id: number) {
    if (eventoId == null) return
    const next = addVista(vistas, id)
    setVistas(next)
    saveVistas(eventoId, next)
  }
  ```
- Passar `onPularVazia={pularModalidadeVazia}` para `CongressoStepModalidade`.

## Tratamento de erros / casos

- Durante o carregamento dos inscritos do selecionado, `vazia` é `false` (evita rótulo/ação errados antes dos dados chegarem).
- Sem outras modalidades não concluídas: permanece na atual (já marcada apresentada, com check verde).
- Modalidade sem inscritos de qualquer tipo (específico/grupos/chaves/ordem): mesmo comportamento (não há o que apresentar/sortear).
- Persistência e reset reaproveitam o fluxo existente (`addVista`/`saveVistas`; "Reiniciar evento" limpa).

## Testes

- `addVista` já testado; sem nova função pura.
- **Build + manual:** `npm run build`; manual — selecionar modalidade com 0 inscritos → botão "Próxima" → clicar → check verde + seleção avança para a próxima não concluída; modalidade com inscritos mantém "Iniciar" e o fluxo normal.
- Sem backend/migration.

## Fora de escopo

- Mostrar a contagem de inscritos na lista (continua só no detalhe).
- Pular automaticamente sem clique (a ação é pelo botão).
- Alterar o fluxo de participantes/sorteio das modalidades com inscritos.
