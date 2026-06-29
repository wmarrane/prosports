# Editar evento (admin) — redesign do editor — Design

**Data:** 2026-06-28
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Redesenhar a tela de **edição/criação de evento** do admin (NewProsports) conforme `personaladmin/handoff/design_handoff_editar_evento/`: layout de 2 colunas (`.evx`) com formulário à esquerda e coluna de apoio sticky à direita (pré-visualização do card público ao vivo, resumo, publicação e zona de perigo).

Escopo aprovado: **melhoria visual/UX** reusando os campos reais existentes + o que já é persistível. A mesma rota e o mesmo backend são mantidos (exceto onde já há endpoint). **Sub-projeto A** (o B — detalhe mobile + chave público — é separado).

**Fonte de design:** `editar-evento.jsx` + `editar-evento.css` (protótipo). Reusar `tokens.css` + `prosports-theme.css`. Sem cores novas.

## Contexto (codebase)

- Tela atual: `frontend/src/pages/eventos/EventoForm.tsx` (1 coluna, max 800px). Campos reais: competição (travada na edição), município, nome, local, organizador, anfitrião, comissão técnica, logo, data_hora, data_inicio/data_fim, status. Cards extras: Logo, `AcessoMobileCard`, `EventoBoletins`. Rotas: `/eventos/novo`, `/eventos/:id/editar`.
- Persistência por evento de modalidades: **só** `EventoModalidadeExcluida` (ativar/desativar). Não há, por evento: meta de inscritos, override de tipo, nem ordem. `Competicao` **não** tem campo "esporte".
- Serviços disponíveis (`frontend/src/services/eventos.ts`): `buscar`, `criar`, `editar`, `remover`, `getModalidadesDoEvento`, `getModalidadesExcluidas`, `setModalidadesExcluidas`, `progressoSorteio`, logo. `modalidadesService.listar({ competicao_id })` (todas da competição). `inscricoesService.listar({ evento_id })` (para inscritos distintos).
- Status real (`EventoStatus`): rascunho/inscricoes/pronto/sorteado/parcial/suspenso. Mapa de status público: `frontend/src/site-publico/lib/status-evento.ts` (não usar direto no admin; replicar rótulo/cor com tokens do admin se necessário).
- Tipos de sorteio → ícone/gradiente: já existe no admin (ex.: `EventoCardListagem`/`EventosList` usam `Brackets/Group/ListOrdered/FileText` + grads `--grad-brand/-accent/-violet/-warn`).

## Arquitetura

Reescrever `EventoForm.tsx` no layout `.evx` de 2 colunas. CSS novo em `frontend/src/styles/editar-evento.css` (importado no `main.tsx`, ao lado de `boletins.css`/`congresso-wizard.css`), com classes prefixadas `.evx-*`. Componentes novos:
- `frontend/src/pages/eventos/EventoCardPreview.tsx` — réplica do card público para a coluna de apoio.
- `frontend/src/pages/eventos/ModalidadesDaEdicao.tsx` — lista ativar/desativar das modalidades (persiste via exclusões).

### Layout `.evx-grid`
2 colunas: formulário `1.35fr` + `.evx-aside` `0.82fr` (`position: sticky`). Empilha em `≤1080px`; `.evx-row2` → 1 coluna em `≤520px`. Alvos de toque ≥44px.

### Coluna esquerda — formulário (cards `.card.pad`)
1. **Identificação** — `<select>` Competição (travado na edição; troca recarrega modalidades na criação), Nome*, Município (`MunicipioSelect`), Organização. (Sem "esporte".)
2. **Congresso · data e local** — Data e hora* (`datetime-local`), Local*, Início/Fim (`date`, opcionais). (Mantém data/hora obrigatória; sem o toggle "Agendar" do protótipo, para preservar a validação atual.)
3. **Anfitrião & Comissão Técnica** — `ParticipanteSelect` (anfitrião) + nota "considerar anfitrião" da competição + checkboxes de Comissão Técnica (usuários `COMISSAO_TECNICA`). (Igual ao atual, reorganizado.)
4. **Modalidades desta edição** (`ModalidadesDaEdicao`) — lista de **todas** as modalidades da competição (via `modalidadesService.listar({ competicao_id })`) com ícone+gradiente do tipo, nome+tipo e **switch ativar/desativar**. "Ativa" = não excluída. Estado inicial vem de `getModalidadesExcluidas`. Salvar persiste via `setModalidadesExcluidas` (lista de ids desativados). Linha desativada com `data-off` (opacidade + strike). Nota: criar/renomear modalidade é na competição. (Sem meta/override/reorder.)
5. **(somente edição)** Logo do evento, `AcessoMobileCard`, `EventoBoletins` — mantidos.

### Coluna direita — apoio (`.evx-aside`, sticky)
1. **Pré-visualização · card público** (`EventoCardPreview`) — recalcula ao vivo a partir do formulário:
   - tipos = tipos das modalidades **ativas**; gradiente dominante = `--grad-brand-deep` se >1 tipo, senão o gradiente do tipo único; tiles (até 2 + "+N"); badge de status (rótulo do `status` do evento); local/cidade/data (mono); título display = nome; competição; **barra de progresso** e rodapé inscritos/modalidades.
   - Modalidades = nº de ativas. Inscritos (edição) = participantes distintos via `inscricoesService.listar({ evento_id })`; criação = 0. Progresso (edição) = `progressoSorteio(eventoId)`; criação = 0/0.
2. **Resumo** (`.evx-stats`, 2×2) — Modalidades (ativas) · Inscritos (real) · Tipos de sorteio (distintos das ativas) · Com sorteio (`sorteadas` real).
3. **Publicação** (`.evx-status-opt`) — rádio-cards dos 6 status (dot colorido), ligados ao campo `status`. Substitui o `<select>` de status atual.
4. **Zona de perigo** (`.evx-danger`, só edição) — botão excluir evento → `ConfirmDialog` → `eventosService.remover` → navega para `/eventos`.

### Header
Breadcrumb (Eventos › {nome|Novo}) + `PageHeader` com ações: badge "Salvo" (após salvar, em edição), **Cancelar** (ghost → `/eventos`) e **Salvar evento** (primário) — **desabilitado** se nome vazio **ou** nenhuma modalidade ativa.

## Persistência ao salvar
- "Salvar" grava os campos do evento (`criar`/`editar`, payload atual) **e** as exclusões de modalidades (`setModalidadesExcluidas`) quando houver mudança. Em criação, salva o evento primeiro e então aplica exclusões (se o operador desativou alguma).
- O badge "Salvo" aparece após sucesso (sem auto-navegar, para permitir continuar editando) — OU mantém o comportamento atual de navegar para `/eventos`. Decisão: **mostrar "Salvo" e permanecer** na edição; em criação, navegar para a edição do novo evento.

## Reatividade (derivados)
A partir das modalidades **ativas**: `total` (ativas), `tiposAtivos` (distintos), `gradienteDominante`, `pct = sorteadas/sorteaveis` (real), `full` (100% → barra `--grad-accent` + "✓"), `canSave = nome && total ≥ 1`.

## CSS (`editar-evento.css`)
Portar do protótipo, prefixo `.evx-*`: `.evx-grid`/`.evx-col`/`.evx-aside`, `.evx-prev`/`.evx-cover`/`.evx-prev-body`/`.evx-prog`/`.evx-bar`, `.evx-stats`/`.evx-stat`, `.evx-status-opt`, `.evx-mod`, `.evx-static`(se usado), `.evx-danger`/`.evx-btn-danger`, `.evx-note`, media queries (≤1080px, ≤520px). Reusar tokens; sem cores novas.

## Testes / Verificação
- `cd frontend && npm run build` (tsc -b + vite) sem erros.
- **`EventoCardPreview`** (render): tipo dominante (>1 tipo → `--grad-brand-deep`), tiles "+N", rótulo de status, progresso N/M, inscritos/modalidades.
- **`ModalidadesDaEdicao`** (render): lista as modalidades, marca desativadas (`data-off`) conforme exclusões; o toggle altera o conjunto de exclusões emitido.
- Verificar `canSave` (desabilita Salvar sem nome ou sem modalidade ativa).
- **Demo (screenshots) antes do merge na develop**: editor em desktop (2 colunas, preview ao vivo) e empilhado (≤1080px); criação e edição.

## Fora de escopo (vs handoff)
- Meta de inscritos, override de tipo de sorteio, reordenar modalidades por evento (sem backend; "tipo" afeta o motor de sorteio).
- Toggles inventados de "Inscrições" / "janela de inscrições" e "esporte travado" (sem campo).
- Sub-projeto B (detalhe mobile + visualizador de chave público).

## Restrições globais
- Host Windows; ler antes de editar; caminhos absolutos. Git identity inline (`-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`).
- Validar com `npm run build`. Reusar tokens/classes/componentes existentes (`PageHeader`, `MunicipioSelect`, `ParticipanteSelect`, `ConfirmDialog`, `switch`, `AcessoMobileCard`, `EventoBoletins`). Nunca `git add -A`.
- Demo antes da develop; promoção a prod só com confirmação do Wagner.
