# Modo Congresso: número de grupos na stat "Forma do sorteio" — Design

**Data:** 2026-06-13
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Na etapa **Modalidade** do Modo Congresso, no detalhe da modalidade, exibir o **número de grupos** à frente da palavra "Grupos" — **apenas** na stat **"Forma do sorteio"** e **somente** para modalidades do tipo `grupos`. Ex.: "Grupos" → "3 Grupos". Nada mais no card muda (fonte, tamanho, cor, layout, eyebrow).

## Decisões (do brainstorming)

- Alterar **só** o valor da stat "Forma do sorteio" (não o eyebrow do topo).
- **Somente** tipo `grupos`. Demais tipos inalterados.
- O número vem da **regra de grupos** da competição cujo `quantidade_equipes` = nº de inscritos do modalidade selecionado (`quantidade_grupos`).

## Contexto atual (`frontend/src/pages/congresso/CongressoStepModalidade.tsx`)

- O detalhe calcula `const tipoLabel = selectedMod.tipo_modalidade ? TIPO_DISPUTA_LABEL[selectedMod.tipo_modalidade.tipo] : '—'`.
- A stat "Forma do sorteio" renderiza `<div className="cw-md-stat"><b>{tipoLabel}</b><span>Forma do sorteio</span></div>`. O eyebrow do card também usa `{tipoLabel}` (este **não** muda).
- Já existem: `evento` (com `competicao_id`), `inscricoesSel` (inscritos do modalidade selecionado), `selectedMod.tipo_modalidade.tipo`.
- Padrão a espelhar (mesmo contexto): `CongressoStep... CampeoesPanel.tsx` carrega `sistemasDisputaService.grupos.listar(competicaoId)` e computa `regrasGrupos.find(r => r.quantidade_equipes === inscricoes.length)?.quantidade_grupos`.
- Serviço/tipo: `frontend/src/services/sistemas-disputa.ts` → `grupos.listar(competicao_id)` retorna `SistemaGrupos[]` com `quantidade_equipes` e `quantidade_grupos`.

## Mudança

Em `CongressoStepModalidade.tsx`:

- Nova query (carrega as regras de grupos da competição), habilitada quando há `competicao_id`:
  ```ts
  const { data: regrasGrupos = [] } = useQuery({
    queryKey: ['sistemas-disputa-grupos', evento?.competicao_id],
    queryFn: () => sistemasDisputaService.grupos.listar(evento!.competicao_id),
    enabled: evento?.competicao_id != null,
  })
  ```
- No bloco do detalhe (onde `tipo`/`tipoLabel` são calculados), derivar a quantidade de grupos e o rótulo da stat:
  ```ts
  const quantidadeGrupos = tipo === 'grupos'
    ? regrasGrupos.find(r => r.quantidade_equipes === inscricoesSel.length)?.quantidade_grupos
    : undefined
  const formaSorteioLabel = quantidadeGrupos != null ? `${quantidadeGrupos} Grupos` : tipoLabel
  ```
- Na stat "Forma do sorteio", trocar `{tipoLabel}` por `{formaSorteioLabel}`. **O eyebrow continua `{tipoLabel}`** (inalterado).

## Tratamento de erros / casos

- Tipo ≠ grupos → `quantidadeGrupos` é `undefined` → stat continua com `tipoLabel` (sem mudança).
- Grupos sem regra para o nº de inscritos (ex.: 0 inscritos ou um N sem regra cadastrada) → `undefined` → stat mostra "Grupos".
- Import do `sistemasDisputaService` adicionado se ainda não houver.

## Testes

- **Build + manual:** `npm run build`; manual — modalidade de grupos com inscritos que casam uma regra → stat "Forma do sorteio" mostra "N Grupos"; sem regra → "Grupos"; eyebrow inalterado; outros tipos inalterados.
- Sem backend/migration (regra e serviço já existem).

## Fora de escopo

- Mudar o eyebrow do topo do card.
- Mostrar nº de grupos em outras telas.
- Qualquer alteração de estilo/layout do card.
