# Tooltips de função nos botões de Eventos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans. Steps usam checkbox (`- [ ]`).

**Goal:** Adicionar `title` (tooltip) explicando a função dos botões de ação nas telas principais de Eventos.

**Tech Stack:** React 18 + TS + Vite. Frontend-only, sem backend/migration. Mudança = adicionar atributo `title` (não mexer em comportamento/estilo/lógica). Onde já existe `title`, não tocar.

**Validação obrigatória:** `npm run build` (frontend).

**Spec:** `docs/superpowers/specs/2026-06-14-tooltips-botoes-eventos-design.md`

**Git:** identidade NÃO configurada — commitar inline (`git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit ...`). Não pular hooks. Caminhos absolutos.

---

## Task 1: EventosList.tsx

**File:** `frontend/src/pages/eventos/EventosList.tsx`. Localize cada botão pelo rótulo/onClick e adicione o `title`:

- [ ] Botão do cabeçalho de grupo (competição) — o `<button type="button" onClick={() => toggleGrupo(g.competicaoId)}>` → adicionar `title="Recolher ou expandir os eventos desta competição"`.
- [ ] Botão "Inscrições" (`navigate('/eventos/'+ev.id+'/inscricoes')`, texto "Inscrições") → `title="Abrir inscrições, sorteio e campeões do evento"`.
- [ ] Botão "Remover" (`onClick={e => handleRemove(e, ev)}`, texto "Remover") → `title="Excluir o evento (inscrições e sorteios vinculados serão perdidos)"`.
- [ ] Botão "Novo Evento" (`navigate('/eventos/novo')`) → `title="Criar um novo evento"`.
- [ ] Chips de filtro (`onClick={() => setFiltro(f.id)}`) → `title={f.id === 'todos' ? 'Mostrar todos os eventos' : `Mostrar apenas eventos de ${f.label}`}`.
- [ ] Cabeçalho "Sorteados" (`onClick={toggleSorteados}`) → `title="Recolher ou expandir os eventos já sorteados"`.

Não tocar: Publicar/Despublicar (já têm `title`).

- [ ] **Build:** `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend" && npm run build` → PASS.
- [ ] **Commit:** `git add frontend/src/pages/eventos/EventosList.tsx && git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(eventos): tooltips de funcao nos botoes da lista de eventos"`

---

## Task 2: EventoForm.tsx

**File:** `frontend/src/pages/eventos/EventoForm.tsx`. Adicionar `title`:

- [ ] Label de upload de logo (o `<label>` com input file escondido, texto "Enviar logo"/"Trocar logo") → `title="Enviar uma imagem de logo do evento (JPG, PNG ou WebP)"`.
- [ ] Botão "Remover" do logo (`onClick` chama `removerLogoMutate`, texto "Remover"/"Removendo...") → `title="Remover o logo do evento"`.
- [ ] Botão "Gerenciar inscrições" (`navigate('/eventos/'+id+'/inscricoes')`) → `title="Abrir inscrições, sorteio e campeões deste evento"`.

Não tocar: "Cancelar" e "Criar evento"/"Salvar alterações" (óbvios).

- [ ] **Build:** `npm run build` → PASS.
- [ ] **Commit:** `git add frontend/src/pages/eventos/EventoForm.tsx && git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(eventos): tooltips de funcao nos botoes do formulario de evento"`

---

## Task 3: EventoInscricoes.tsx

**File:** `frontend/src/pages/eventos/EventoInscricoes.tsx`. Adicionar `title` nos botões de ação (pular modais e os que já têm `title`):

- [ ] "Editar evento" → `title="Editar os dados do evento"`.
- [ ] "Modalidades do evento" (`setModalidadesModalOpen(true)`) → `title="Escolher quais modalidades da competição participam deste evento"`.
- [ ] Item da lista de modalidade (o `<button onClick={() => setModalidadeId(m.id)}>` da sidebar) → `title="Ver inscritos, sorteio e campeões desta modalidade"`.
- [ ] "Importar CSV" de inscritos (`setImportOpen(true)`) → `title="Importar inscritos via arquivo CSV"`.
- [ ] "Inscrever" (abre modal de inscrever participantes) → `title="Inscrever participantes na modalidade selecionada"`.
- [ ] "Salvar" da posição do anfitrião (ordem de entrada, `salvarPosAnfitriao`) → `title="Salvar a posição de entrada do anfitrião"`.
- [ ] "Re-sortear" (`handleResortear`) → `title="Refazer o sorteio desta modalidade"`.
- [ ] "Apagar" do sorteio (`handleApagarSorteio`, texto "Apagar") → `title="Apagar o sorteio desta modalidade"`.
- [ ] "Realizar sorteio" (`handleSortear`, icon Shuffle) → `title="Executar o sorteio da modalidade selecionada"`.
- [ ] "Importar CSV" de campeões (`setImportCampeoesOpen(true)`) → `title="Importar campeões do ano anterior via CSV"`.

Não tocar: "Exportar HTML", "Reiniciar evento", "Remover todos", o "X" de remover inscrito, "PDF" (já têm `title`); e todos os botões dentro de modais.

- [ ] **Build:** `npm run build` → PASS. (e `npm run test` para garantir sem regressão).
- [ ] **Commit:** `git add frontend/src/pages/eventos/EventoInscricoes.tsx && git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(eventos): tooltips de funcao nos botoes da tela de inscricoes"`

---

## Manual Test Checklist
- Passar o mouse em cada botão listado mostra a explicação; nenhum comportamento/estilo mudou; botões com `title` pré-existente continuam com o texto original.

## Self-Review
**Spec coverage:** todos os botões listados na spec cobertos (T1 EventosList, T2 EventoForm, T3 EventoInscricoes). Modais/obvios pulados; botões com `title` pré-existente inalterados.
**Placeholders:** nenhum; cada item tem o texto exato do `title`. Locador = rótulo/onClick (únicos).
**Type consistency:** apenas atributo `title` (string). Chips usam `title` dinâmico com `f.label`.
