# Remover inscritos + import com validação (participantes, inscritos e campeões) — Design

**Data:** 2026-06-10
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Quatro melhorias ligadas à gestão de participantes/inscritos/campeões:

1. **Remover todos os inscritos** de uma modalidade de uma vez.
2. **Import CSV de inscritos** deixa de criar participantes automaticamente: participante não cadastrado vira erro, sinalizando que é preciso cadastrá-lo em "Participantes" primeiro.
3. **Import CSV de campeões do ano anterior** por modalidade, com a mesma validação de participante e um template.
4. **Import CSV de Participantes** no cadastro de Participantes, com template (este import **cria** participantes; municípios precisam existir).

## Decisões (do brainstorming)

- Item 1: **bloquear** a remoção se a modalidade já tiver sorteio (apagar o sorteio antes).
- Item 2: **import parcial** — importa os participantes válidos e lista os não cadastrados como erro.
- Item 3: posição já preenchida (ou repetida no arquivo) → **duplicada (pula)**.
- Item 4: colunas `nome, municipio_uf, municipio_nome, subtitulo` (sem inspetoria/delegacia); participante já existente (mesmo município+nome) → **duplicada (pula)**.
- CSV de campeões: cabeçalho `posicao,nome,municipio_uf,municipio_nome` (+ `subtitulo` quando a competição usa).
- Sem migration.

## Arquitetura comum: resolução de participante

Helper backend (novo) `resolverParticipantes(rows)`: dado um conjunto de linhas com `{ municipio_uf, municipio_nome, nome }`, resolve cada uma para um `participante_id` **existente** ou um motivo de erro. **Nunca cria** município nem participante.

- Casa o município por `UF:nome` (case-insensitive) — igual ao import atual.
- Casa o participante por `municipio_id:nome` (case-insensitive) — igual ao import atual.
- Retorna por linha: `{ participante_id }` ou `{ erro: 'municipio_nao_encontrado' | 'participante_nao_cadastrado' }`.

Local: `backend/src/modules/participantes/resolver-participantes.service.ts` (consumido pelos imports de inscritos e campeões).

## Item 1 — Remover todos os inscritos da modalidade

**Backend** (`inscricoes.service.ts` + controller + routes):
- `removerTodosDaModalidade(evento_id, modalidade_id): Promise<{ count: number }>`:
  - Se existir `Sorteio` para `(evento_id, modalidade_id)` → lança **400** "Apague o sorteio desta modalidade antes de remover os inscritos."
  - Senão `prisma.inscricao.deleteMany({ where: { evento_id, modalidade_id } })` e retorna `{ count }`.
- Rota `DELETE /inscricoes/evento/:eventoId/modalidade/:modalidadeId` (admin).
- Service frontend: `inscricoesService.removerTodosDaModalidade(evento_id, modalidade_id)`.

**Frontend** (`EventoInscricoes.tsx`, card Inscritos):
- Botão "Remover todos" (aparece só quando `inscricoes.length > 0`), com `ConfirmDialog` ("Remover os N inscritos desta modalidade? Esta ação não pode ser desfeita.").
- Ao confirmar, chama a mutation; invalida `['inscricoes', eventoId, modalidadeId]` e `['inscricoes-counts', eventoId]`. Erro do guardrail → `toast.error`.

## Item 2 — Import de inscritos sem criar participante

**Backend** (`inscricoes.service.ts` `importar`):
- Usa `resolverParticipantes`. Linha com `participante_nao_cadastrado` → `status: 'erro'`, `erro: "Participante não cadastrado. Cadastre em 'Participantes' primeiro."`. Linha com `municipio_nao_encontrado` → `status: 'erro'`, `erro: "Município '<nome>/<uf>' não encontrado"` (como hoje).
- Remove a criação de participante (não há mais auto-create).
- Mantém o import parcial: no commit (`dry_run: false`), cria as inscrições só das linhas resolvidas e não duplicadas.
- `ImportResult.contadores`: trocar `participantes_criados` por **`nao_cadastrados`** (nº de linhas com participante não cadastrado). `ImportRowResult`: remover `participante_criado`.

**Frontend** (`ImportInscricoesModal.tsx`):
- Trocar o 4º card do resumo de "Participantes novos" para **"Não cadastrados"** (cor de alerta, `var(--danger)`), lendo `contadores.nao_cadastrados`.
- Coluna "Detalhe" mostra o `erro` quando houver (já mostra).
- Ajustar as instruções: remover o item "Participantes já cadastrados são reaproveitados; novos são criados automaticamente." e colocar "Os participantes precisam estar cadastrados em **Participantes**; não cadastrados são listados como erro para você cadastrar e reimportar."
- Tipos em `frontend/src/types/inscricao.ts`: refletir `nao_cadastrados` e a remoção de `participante_criado`.

## Item 3 — Import de campeões por modalidade

**Backend** (`campeoes_anteriores.service.ts` + controller + routes):
- Tipos `ImportCampeaoRow = { posicao: number; nome: string; municipio_uf: string; municipio_nome: string; subtitulo?: string }` e `ImportResult` (mesma forma do de inscritos, com `contadores: { criadas, duplicadas, erros }`).
- `importar({ evento_id, modalidade_id, dry_run, rows })`:
  - Valida evento/modalidade e que pertencem à mesma competição (como `criar`).
  - Usa `resolverParticipantes`.
  - Por linha: `posicao` fora de 1-12 → erro; participante não cadastrado / município não encontrado → erro; posição já cadastrada no banco **ou** já vista antes no próprio arquivo → `duplicada` (pula); senão `criada` (no commit, `campeaoAnterior.create`).
  - Retorna `{ rows, contadores }`.
- Rota `POST /campeoes-anteriores/import` (admin).
- Service frontend: `campeoesAnterioresService.importar(...)`.

**Frontend**:
- Novo componente `ImportCampeoesModal.tsx` (espelha `ImportInscricoesModal`: passo 1 template+instruções, passo 2 upload + parse client-side via PapaParse, passo 3 preview dry-run; commit). Headers obrigatórios: `posicao,nome,municipio_uf,municipio_nome` (subtitulo opcional). Template `modelo_campeoes.csv` via `downloadCsvTemplate`.
- Botão "Importar CSV" no card **"Campeões do ano anterior"** de `EventoInscricoes.tsx` (que já só aparece para Chaves/Grupos). Ao concluir, invalida `['campeoes-anteriores', eventoId, modalidadeId]`.

## Item 4 — Import de Participantes (cadastro de Participantes)

Diferente dos itens 2 e 3 (que exigem participante já cadastrado), este import **cria** participantes — é o propósito da tela. Municípios continuam tendo que existir (não são criados).

**Backend** (`participantes.service.ts` + controller + routes):
- Tipos `ImportParticipanteRow = { nome: string; municipio_uf: string; municipio_nome: string; subtitulo?: string }` e `ImportResult` (mesma forma: `contadores: { criadas, duplicadas, erros }`).
- `importar({ dry_run, rows })`:
  - Casa o município por `UF:nome` (case-insensitive); inexistente → `erro` "Município '<nome>/<uf>' não encontrado".
  - Identidade do participante = `municipio_id:nome` (case-insensitive). Já existe no banco **ou** já visto antes no próprio arquivo → `duplicada` (pula).
  - Senão `criada` (no commit, `participante.create({ nome, municipio_id, subtitulo }))`).
  - Retorna `{ rows, contadores }`.
- Rota `POST /participantes/import` (admin).
- Service frontend: `participantesService.importar(...)`.

A resolução de município (UF:nome) é a mesma lógica usada no `resolverParticipantes` (itens 2/3); pode ser extraída como um sub-helper `resolverMunicipios(rows)` reutilizado pelos três imports, ou mantida no helper compartilhado. O que **não** se compartilha é a política sobre participante inexistente: itens 2/3 → erro; item 4 → cria.

**Frontend**:
- Novo componente `ImportParticipantesModal.tsx` (espelha `ImportInscricoesModal`: template+instruções, upload + parse client-side via PapaParse, preview dry-run, commit). Headers obrigatórios: `nome,municipio_uf,municipio_nome` (subtitulo opcional). Template `modelo_participantes.csv` via `downloadCsvTemplate`.
- Botão "Importar CSV" no cabeçalho da página **Participantes** (`ParticipantesList.tsx`), ao lado das ações existentes. Ao concluir, invalida `['participantes']`.

## Tratamento de erros

- Remover-todos com sorteio → 400 (toast).
- Import (ambos): linhas inválidas viram `erro` com mensagem específica; o commit importa só as válidas (parcial). Cabeçalho de CSV faltando colunas obrigatórias → erro no modal (client-side), como hoje.
- Import de campeões em modalidade que não é Chaves/Grupos não acontece (o card/botão não existe nesses tipos).

## Testes

- **Backend (Vitest, mock prisma):**
  - `resolverParticipantes`: resolve existentes; marca `participante_nao_cadastrado` e `municipio_nao_encontrado`.
  - `removerTodosDaModalidade`: bloqueia (400) com sorteio; deleta sem sorteio.
  - inscritos `importar`: não cria participante; linha não cadastrada vira erro; conta `nao_cadastrados`; importa os válidos.
  - campeões `importar`: pula posição já preenchida/repetida; erro para não cadastrado e posição inválida; cria os válidos.
  - participantes `importar`: cria os novos; pula duplicado (mesmo município+nome, do banco ou do arquivo); erro para município inexistente.
- **Frontend:** `npm run build` (`tsc -b && vite build`) + teste manual (remover todos com/sem sorteio; importar inscritos com não cadastrados; importar campeões; importar participantes).

## Fora de escopo

- Criar participantes/municípios a partir do CSV (passa a ser proibido por design).
- Import de campeões para modalidades específico/ordem_entrada (sem card de campeões).
- Alterar o cadastro de "Participantes" em si.
