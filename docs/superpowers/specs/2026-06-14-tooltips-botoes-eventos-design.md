# Tooltips de função nos botões de Eventos — Design

**Data:** 2026-06-14
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Adicionar uma breve explicação de função (atributo `title` nativo, ao passar o mouse) nos botões de **ação** das telas principais de Eventos: lista, formulário e tela de operação do evento. Pular botões óbvios de modal (Cancelar/Fechar/Salvar). Botões que já têm `title` ficam como estão.

## Decisões (do brainstorming)

- Telas: `EventosList.tsx`, `EventoForm.tsx`, `EventoInscricoes.tsx` (principais).
- Só botões de ação; **não** adicionar em Cancelar/Fechar/Salvar de modais.
- Mecanismo: `title` nativo (mesmo padrão já usado nos botões existentes).

## Mudanças por arquivo (texto do `title`)

### `frontend/src/pages/eventos/EventosList.tsx`
- Cabeçalho de grupo (competição, recolher) → `title="Recolher ou expandir os eventos desta competição"`.
- "Inscrições" → `title="Abrir inscrições, sorteio e campeões do evento"`.
- "Remover" → `title="Excluir o evento (inscrições e sorteios vinculados serão perdidos)"`.
- "Novo Evento" → `title="Criar um novo evento"`.
- Chips de filtro → `title` dinâmico: `f.id === 'todos' ? 'Mostrar todos os eventos' : ` `Mostrar apenas eventos de ${f.label}` `.
- Cabeçalho "Sorteados" (recolher) → `title="Recolher ou expandir os eventos já sorteados"`.
- (Publicar/Despublicar já têm `title` — inalterados.)

### `frontend/src/pages/eventos/EventoForm.tsx`
- Label de upload de logo ("Enviar/Trocar logo") → `title="Enviar uma imagem de logo do evento (JPG, PNG ou WebP)"`.
- "Remover" (logo) → `title="Remover o logo do evento"`.
- "Gerenciar inscrições" → `title="Abrir inscrições, sorteio e campeões deste evento"`.
- (Cancelar e Criar/Salvar — pulados por serem óbvios.)

### `frontend/src/pages/eventos/EventoInscricoes.tsx`
- "Editar evento" → `title="Editar os dados do evento"`.
- "Modalidades do evento" → `title="Escolher quais modalidades da competição participam deste evento"`.
- Item da lista de modalidade (botão de seleção) → `title="Ver inscritos, sorteio e campeões desta modalidade"`.
- "Importar CSV" (inscritos) → `title="Importar inscritos via arquivo CSV"`.
- "Inscrever" → `title="Inscrever participantes na modalidade selecionada"`.
- "Salvar" (posição do anfitrião, ordem de entrada) → `title="Salvar a posição de entrada do anfitrião"`.
- "Re-sortear" → `title="Refazer o sorteio desta modalidade"`.
- "Apagar" (sorteio) → `title="Apagar o sorteio desta modalidade"`.
- "Realizar sorteio" → `title="Executar o sorteio da modalidade selecionada"`.
- "Importar CSV" (campeões) → `title="Importar campeões do ano anterior via CSV"`.
- (Exportar HTML, Reiniciar evento, Remover todos, X de remover inscrito, PDF — já têm `title`; botões de modal — pulados.)

## Tratamento de erros / casos

- Apenas adição de atributo `title`; sem mudança de comportamento, estilo, lógica ou layout.
- Onde já existe `title`, não duplicar/alterar.

## Testes

- `npm run build` (frontend); verificação manual: passar o mouse nos botões mostra a explicação. Sem teste unitário (são atributos estáticos).
- Sem backend/migration.

## Fora de escopo

- Modais (Cancelar/Fechar/Salvar/Confirmar), Acesso mobile (chaves), slots de campeões (`CampeaoSlot`), `ModalidadesDoEventoModal`.
- Tooltip rico/custom (mantém `title` nativo).
- Demais áreas do sistema (só Eventos).
