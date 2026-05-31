# Changelog

Todos os releases notáveis deste projeto.

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versionamento: [SemVer](https://semver.org/lang/pt-BR/).

## [1.28.1] - 2026-05-31

### Changed (Eventos → Inscrições)
- **EventoInscricoes** redesenhado em **layout master-detail 2-colunas** (sidebar 320px + conteúdo). Single-column ≤1024px.
- **Banner do evento** no topo: data/hora + local + município com ícones; barra de progresso "X de Y sorteadas" com % monospace; atalho "Editar evento".
- **Sidebar (esquerda)**: lista de modalidades como botões verticais com ícone gradient 32px por tipo + nome + sigla mono + check verde se sorteada. Item ativo em `--brand-50` com borda `--brand-500`.
- **Conteúdo (direita)** organizado em 4 cards seccionados:
  - **Header da modalidade**: ícone gradient 52px + nome + sigla pill + "Disputa por X".
  - **Inscritos** (Users/brand-deep): contagem no header, botões "Importar CSV" (ghost) + "Inscrever" (primary). Grid 280px+ de cards compactos (em vez de DataTable) com posição mono, badge campeão, nome, subtítulo/município, botão remover hover-danger. Empty state amigável. Ordenação alfabética pt-BR.
  - **Sorteio** (Shuffle/amber gradient): título dinâmico (Aguardando/Resultado/Modalidade específica). Seed+timestamp em card destacável com ações inline (Re-sortear/Apagar). Estado idle com hero icon + botão grande.
  - **Campeões do ano anterior** (Crown/golden gradient): mesma grid de 12 slots, descrição mais clara mencionando seeding em Grupos/Chaves.
- Estado "Selecione uma modalidade" com Trophy icon + mensagem explicativa.
- Modal "Inscrever" estilizado consistentemente (cards + ícones + action bar).

## [1.28.0] - 2026-05-31

### Changed (Modalidades — alinhamento visual)
- **ModalidadesList** trocou DataTable por **agrupamento por competição**: header por seção (Trophy + nome da competição + contagem) e cards de modalidade abaixo (320px+ grid). Cada card: ícone gradient 46px por tipo, nome, sigla mono pill, tipo label, Editar/Remover.
  - **Filter chips** no topo (Todos / Chaves / Grupos / Ordem de entrada / Específico) com contadores ao vivo.
  - Card inteiro clicável (abre Editar); hover muda borda pra brand-400.
  - Empty state com Shapes icon.
- **ModalidadeForm** redesenhado em **2 cards seccionados**:
  - **Vinculação** (Trophy/brand-deep): Competição (bloqueada no Editar) + Tipo de Modalidade. Preview visual do tipo selecionado (ícone gradient + descrição).
  - **Identificação** (Shapes/violet gradient): grid `1fr / 140px` com Nome (largo) + Sigla (compacta, font-mono uppercase).
- Header com eyebrow "Operação" + sub contextual.
- Asterisco vermelho em campos obrigatórios.
- Action bar fim: Cancelar (ghost) + "Salvar alterações"/"Criar modalidade" (primary, com ícones).

## [1.27.1] - 2026-05-31

### Changed (Eventos — formulário Nova/Editar)
- `EventoForm` redesenhado em **3 cards seccionados** alinhados com o padrão visual de `CompeticaoForm`:
  - **Vinculação** (Trophy/brand-deep): Competição (select bloqueado no Editar) + Município.
  - **Identificação** (MapPin/violet gradient): Nome + Local + Organizador (opcional).
  - **Agenda** (Calendar/amber gradient): Data e hora + Status com descrição dinâmica do status selecionado.
- Indicadores visuais de campo obrigatório (asterisco `*` em vermelho).
- Texto de ajuda contextual em cada campo (ex.: "evento herda modalidades da competição").
- Competição não pode mais ser alterada em modo edit (com aviso explicativo) — coerente com a regra de integridade dos dados.
- **Action bar** no fim: à esquerda "Gerenciar inscrições" (só em edit, vai pra `/eventos/:id/inscricoes`); à direita Cancelar + Salvar com ícones.
- Header com eyebrow "Operação" + subtítulo contextual.

## [1.27.0] - 2026-05-31

### Changed (Competições — alinhamento com design v3 atualizado)
- **Editar Competição** agora usa **layout 2-colunas** (`minmax(0, 1fr) minmax(0, 1.2fr)` no desktop, single-column ≤1100px) alinhado ao `competicoes.jsx` v3:
  - **Esquerda**: Informações + Estados + Configurações (stack vertical de cards).
  - **Direita**: novo painel **Modalidades** com CRUD inline.
- **Nova Competição** mantém single-column (modalidades só após criar).
- Novo componente `ModalidadesPanel`:
  - Botão "+ Adicionar" no header revela **inline ADD form** (nome + sigla + dropdown de tipo) — cria modalidade sem sair da tela.
  - Lista de modalidades existentes com ícone gradient por tipo + nome + sigla mono + tipo label.
  - Ações por linha: "Editar" (link `/modalidades/:id/editar`) e "Remover" (com confirm).
  - Empty state com Shapes icon + mensagem amigável.
  - Legenda de tipos no rodapé.
- Action bar fim: Cancelar + "Salvar alterações" / "Criar competição".
- `max-width` da página aumenta para 1400px no modo edição (era 720px).

## [1.26.0] - 2026-05-31

### Changed (Eventos — alinhamento com design v3 atualizado)
- **EventosList refeito** alinhado ao `eventos.jsx` da referência v3:
  - **Filter chips** no topo (Todos / Chaves / Grupos / Ordem de entrada) com contadores ao vivo por tipo. Chip ativo em `--brand-500` sólido, inativos em `--card-bg-2`.
  - **Cards reformulados**: ribbon top de 4px com gradient (`--grad-brand-deep` para multi-tipo, gradient específico do tipo se único), **multi-tipo icons stack** no topo esquerdo (Brackets/Group/ListOrdered com gradient + sombra), status badge à direita, ID monospace + município com ícone MapPin, nome em sec-title, competição com Trophy, data+local, e **3 metas no footer** (modalidades / inscritos / sorteadas) com mini-cards de ícone.
  - Hover lift: card eleva 2px + borda muda para `--brand-400`.
  - Ações Inscrições/Remover continuam disponíveis (rodapé).
  - Empty state com Trophy + mensagem amigável; filtro vazio mostra texto simples.

### Added (backend)
- `eventos.service.listar` agora inclui:
  - `competicao.modalidades` (id + tipo_modalidade.tipo) para derivar tipos disponíveis no evento e mostrar os ícones agregados.
  - `_count` (inscricoes + sorteios) para os metas dos cards (X inscritos, Y/Total sorteadas).
- Tipo `Evento` ganhou campo opcional `_count` e `CompeticaoComModalidades` para refletir o include estendido.
- Teste correspondente atualizado (9/9 passando).

## [1.25.2] - 2026-05-31

### Added (Editar Competição — modalidades vinculadas)
- `CompeticaoForm` em modo edição agora mostra um **4º card "Modalidades vinculadas"** com a lista de modalidades dessa competição (busca via `modalidadesService.listar({ competicao_id })`).
- Cada linha mostra: ícone gradient por tipo de disputa (`Brackets`/`Group`/`ListOrdered`/`FileText`), nome, sigla em mono, label do tipo, link "Editar" e botão "Remover" (com confirmação).
- Botão **"+ Adicionar modalidade"** no header da seção navega para `/modalidades/nova?competicao_id=:id`.
- Empty state amigável quando não há modalidades.
- `ModalidadeForm` agora **lê query param `competicao_id`** e pré-seleciona o dropdown ao criar nova modalidade (vindo do form de Competição).

### Notes
- Resolve relato: "ao editar a competição não localizei as modalidades cadastradas".

## [1.25.1] - 2026-05-31

### Changed (Competições — formulário Nova/Editar)
- `CompeticaoForm` totalmente refeito em 3 **cards seccionados** (Informações / Estados / Configurações), em vez de form linear básico:
  - **Informações**: ícone troféu + nome com placeholder + dica explicativa.
  - **Estados**: UFs agrupadas por **região geográfica** (Norte/Nordeste/Centro-Oeste/Sudeste/Sul) como chips clicáveis (não checkboxes). Cada chip mostra estado ativo (fundo brand-500) ou inativo (card-bg-2). Botões "Toda região" por seção + "Selecionar Brasil"/"Limpar tudo" no header. Mostra contagem `X/Y` por região.
  - **Configurações**: checkbox de subtítulo em card destacável (muda cor de fundo quando ativo).
- **Action bar** no fim: Cancelar (ghost) + Salvar (primary com ícone Check). Mensagem de erro em card vermelho destacado.
- Header com `eyebrow="Operação"` + subtítulo contextual (varia entre Editar/Criar).
- Action button label dinâmico: "Salvar alterações" (editar) ou "Criar competição" (nova).

## [1.25.0] - 2026-05-31

### Changed (Competições)
- **Competições** trocou de DataTable para **grid de cards** (360px+ auto-fill) alinhado com o design de referência (`claudedesign/design_v3/competicoes.jsx`). Cada card mostra: ícone troféu em gradient brand-deep, ID monospace, nome, badge com contagem de eventos, pills de estados UF, contagem de modalidades, indicador de subtítulo, ações (Editar/Remover) + "Ver eventos →".
- Empty state com ícone Trophy + mensagem amigável (em vez de texto "Nenhuma competição.").
- Header agora usa eyebrow "Operação" + subtítulo explicativo.

### Added (backend)
- `competicoesService.listar()` agora inclui `_count` (modalidades + eventos) via Prisma `include`. Atualizado teste correspondente.
- Tipo `Competicao` frontend ganhou campo opcional `_count`.
- Ícone `Users` exportado em `frontend/src/lib/icons.ts`.

## [1.24.1] - 2026-05-31

### Changed (Modo Congresso — ajustes UX)
- **Participantes** agora renderizam em **ordem alfabética** pelo nome (pt-BR, ignorando acentos/caixa). Antes seguiam a ordem de inclusão do backend.
- **Modalidade master-detail**: painel direito (`.cw-md-detail`) agora é **sticky** (`position: sticky; top: 0`) — fica visível enquanto o usuário rola a lista da esquerda. `max-height: calc(100vh - 200px)` com `overflow-y: auto` permite que o painel role internamente se o card for maior que a viewport.

## [1.24.0] - 2026-05-30

### Changed (Modo Congresso — Master-Detail Modalidade)
- **CongressoStepModalidade** agora usa layout **master-detail** (`cw-md` grid: 360px sidebar esquerda + painel detalhe direita), substituindo o grid de cards.
- **Esquerda**: lista vertical compacta (`cw-md-list`/`cw-md-item`) com ícone de tipo gradiente, nome da modalidade, e badge "✓" se já sorteada.
- **Direita**: card grande (`cw-md-card`) com hero icon 84px, eyebrow do tipo, título display (`clamp(30px, 3.4vw, 46px)`), descrição do tipo de disputa, dois cards de stats (Inscritos / Forma do sorteio), e botão grande "Iniciar" (`cw-btn-xl`) para avançar.
- Auto-seleção da primeira modalidade ainda não sorteada (ou a primeira da lista se todas já foram).
- Empty state na direita quando nada selecionado (`cw-md-empty` tracejado).

## [1.23.0] - 2026-05-30

### Changed (Modo Congresso — consolidação de Campeões em Sorteio)
- **Wizard agora tem 4 steps** (Evento, Modalidade, Participantes, Sorteio) em vez de 5. O step dedicado "Campeões" foi removido do fluxo de navegação.
- **Edição de campeões agora aparece inline no Sorteio idle state** (quando ainda não há sorteio gerado), apenas para modalidades tipo `grupos` ou `chaves`. Mostra lista compacta de campeões cadastrados como pills com badge de posição + status "inscrito"/"não inscrito"; botão "Editar" abre o mesmo modal de 12 slots.
- Criado componente `CampeoesPanel` reutilizável (`frontend/src/pages/congresso/CampeoesPanel.tsx`) extraído do step dedicado, contendo apenas a lista + botão editar + modal.
- `ModoCongresso` simplificado: rota direto de Participantes → Sorteio para grupos/chaves/ordem_entrada. Específico continua pulando direto pra próxima modalidade.

### Notes
- Arquivo `CongressoStepCampeoes.tsx` continua existindo no repo mas não é mais usado no fluxo. Pode ser removido em release futura.
- Type `CongressoStep` mantém `'campeoes'` por compatibilidade.

## [1.22.0] - 2026-05-30

### Added (Modo Congresso)
- **Modal de grupo expandido**: no resultado do sorteio tipo "grupos", clicar em qualquer card de grupo abre um modal grande (até 900px) mostrando o grupo em letra display gigante + lista vertical de participantes em fonte responsiva (28px+). Útil para apresentação em Datashow.
- **Botão PDF/Imprimir**: barra de ações do Sorteio ganhou botão "PDF" (ícone Report) que dispara `window.print()` para gerar PDF via diálogo do navegador.
- `SorteioGrupos` ganhou prop opcional `onGroupClick: (letra: string) => void`; quando fornecido, cards de grupo viram clicáveis com hover destacando borda em `--brand-500`.

## [1.21.1] - 2026-05-30

### Changed (Congresso — Phase B visual refactor)
- `CongressoStepParticipantes` refatorado para usar classes `cw-parts-head`, `cw-plist`, `cw-prow` (grid 330px+ em vez de lista vertical estreita). Botão "Incluir participante" como `cw-btn-accent`, navegação "Próximo" como `cw-btn-primary`. Empty state com card tracejado. Modal de inclusão com `cw-card` + tokens.
- `CongressoStepModalidade` refatorado para grid de cards (`cw-grid` + `cw-card`) com ícone gradient por tipo de disputa (`Brackets`, `Group`, `ListOrdered`, `FileText`), título responsivo, badge "Sorteado" quando aplicável. Substitui a lista vertical simples.
- `CongressoStepCampeoes` refatorado para usar `cw-parts-head` no header, `cw-card` para cards de campeão, `cw-badge b-success/b-slate` para status inscrito/não inscrito. Empty state com ícone Crown. Modal de edição modernizado.

## [1.21.0] - 2026-05-30

### Added (Modo Congresso — quick wins funcionais)
- **Banner de cabeças semeadas** acima do resultado do sorteio (apenas para grupos/chaves quando há campeões inscritos). Mostra ícone Crown + medalha + nome de cada um dos top 4.
- **Animação de "Sorteando..."** com spinner circular de 1.5s mínimo antes de mostrar o resultado (substitui o "🎲 Sorteando..." imediato que sumia em 100ms).
- **Modal próprio de confirmação** para "Novo sorteio" com ícone Shuffle, botões Cancelar/Confirmar estilizados (em vez do `window.confirm()` nativo).
- Ícone Crown adicionado a `lib/icons.ts`.

### Changed (fluxo)
- Modo Congresso agora **pula Campeões + Sorteio** para modalidades tipo `específico` — após Participantes, volta direto pra próxima modalidade.
- Modo Congresso agora **pula Campeões** para modalidades tipo `ordem_entrada` — vai direto pra Sorteio (campeões não fazem sentido em ordem de entrada).
- Botão "Realizar sorteio" inicial ganhou ícone Shuffle e sombra `--shadow-brand`.
- Confirmação de re-sortear em modal próprio (REMEDIACAO_DESIGN sugeria substituir confirm()).

## [1.20.1] - 2026-05-30

### Fixed
- Modo Congresso ilegível em tema claro: substituídas constantes hardcoded para tema escuro (`#f1f5fb`, `#94a3b8`, `rgba(255,255,255,...)`) por variáveis `var(--cw-fg/dim/card/card-bd/line)` que reagem ao `[data-theme]`. Agora textos e cards têm contraste correto tanto em light quanto dark.

## [1.20.0] - 2026-05-30

### Added
- Importado `congresso-wizard.css` (design system R2P) em `frontend/src/styles/`. Adiciona ~250 classes `cw-*` para wizard fullscreen.
- Modo Congresso ganhou **stepper horizontal** com bolinhas numeradas no header, mostrando passo atual (`.on`) e passos concluídos (`.done` com check).
- Modo Congresso ganhou **toggle de tema** (Sol/Lua) na barra de ações.
- Modo Congresso suporta `contexto` opcional pra mostrar breadcrumb (Evento › Modalidade) abaixo do header.

### Changed
- `CongressoShell.tsx` reescrita para usar classes `cw-*` (`.cw`, `.cw-top`, `.cw-brand`, `.cw-steps`, `.cw-actions`, `.cw-main`, `.cw-panel`) em vez de inline styles hardcoded. Background dark/light agora segue tokens `--cw-*` que reagem ao `[data-theme]`.
- `CongressoStepEvento.tsx` refatorada para usar `cw-h1`, `cw-sub`, `cw-grid`, `cw-card`, `cw-card-top`, `cw-card-ic`, `cw-card-title`, `cw-card-meta`, `cw-card-stats`. Tipografia agora responsiva via `clamp()`. Ícone de troféu lucide no card.

### Notes
- Fase A do alinhamento com `REMEDIACAO_DESIGN.md` + `claudedesign/design_v3/`. Outros steps (Modalidade, Participantes, Campeões, Sorteio) ainda usam inline styles — refatoração em release seguinte. Master-detail no step Modalidade fica para v1.21.0.

## [1.19.1] - 2026-05-30

### Changed
- Modo Congresso (steps Campeões, Sorteio, Participantes, Evento, Modalidade) agora usa tokens do design system R2P em vez de hex hardcoded: `var(--brand-500)` no lugar de `#1061d8`, `var(--card-bg)` no lugar de `#0f1623` (modal BG), `var(--card-border)` para bordas.
- Border-radius padronizado nos botões usando `var(--radius-md/lg/xl)` (8/12/16) em vez de px inline.
- Tipografia das telas Congresso usa `clamp()` responsivo (`clamp(22px, 2.6vw, 32px)` etc.) em vez de px fixos para títulos h2 — corrige o "caos de tamanhos" apontado no guia de remediação de design (REMEDIACAO_DESIGN.md passo 3).

### Notes
- Audit completo do guia revelou 85% de conformidade. Esta versão fecha os gaps do Modo Congresso. Demais critérios (dark mode, sidebar, ícones lucide, shadows, fonte Inter) já estavam em conformidade.

## [1.19.0] - 2026-05-30

### Added
- Nova tabela `bracket_chaves_matches(numero_inscrito INT PK, matches_graph JSONB)` com grafo completo de matches por N (extraído da planilha CHAVES CT.xlsx).
- Script `backend/scripts/extract-bracket-graphs.py` combina matches list (Venc/Perd refs) + BYE positions já extraídas (v1.18.0) para reconstruir o grafo. Cobre 29 dos 76 N possíveis (limitação da planilha — outros N têm dados incompletos).
- Novo componente `BracketTree.tsx` renderiza bracket de chaves como árvore visual: cards de match posicionados por coordenadas (round/y) com conectores SVG L-shape entre vencedores e próximas partidas. Final destacada com borda dourada + 🏆.
- `Sorteio.resultado` agora inclui `matchesGraph` (nullable — `null` quando N não tem grafo na planilha).

### Changed
- `SorteioChaves` (frontend) usa `BracketTree` quando `matchesGraph` presente. Para N sem grafo, cai no fallback v1.18.1 (lista vertical com BYEs marcados).

### Notes
- Sorteios pré-v1.18.0 (sem `byePositions`) continuam renderizando via builder legado.
- Planilha CHAVES CT.xlsx tem dados completos apenas para N=2-12, 15, 17, 19, 21-28, 31-33 (29 valores). Outros N (incluindo a maioria entre N=34 e N=77) usam fallback de lista vertical. Para extender a cobertura: completar a planilha (preencher matches list direita para os N faltantes) e re-rodar `python backend/scripts/extract-bracket-graphs.py`.

## [1.18.1] - 2026-05-30

### Changed
- `SorteioChaves` agora renderiza lista vertical 1→N (preservando a ordem das posições da planilha), com BYEs marcados in-line ("BYE — avança direto"). Substitui o layout em 3 colunas (R1 / Avançam / Demais rodadas) do v1.18.0, que ficou distante do desenho de referência da planilha CT.

## [1.18.0] - 2026-05-30

### Added
- Nova tabela `bracket_chaves_byes(numero_inscrito INT PK, posicoes_bye INT[])` populada com posições de BYE por número de inscritos (N=2..77), extraídas da planilha oficial `CHAVES CT.xlsx`.
- Script de extração `backend/scripts/extract-bracket-byes.py` para regenerar o seed quando a planilha mudar.

### Changed
- Engine `drawBracket` agora usa `bracket_chaves_byes.posicoes_bye` em vez de `nextPow2 - N` para determinar BYEs. Estrutura assimétrica do regulamento (ex.: N=20 com 4 BYEs nas posições 1, 10, 11, 20) preservada.
- `SorteioChaves` (frontend) renderiza bracket em 3 colunas: R1 (pares reais) / Avançam (cards individuais para cada BYE) / Demais rodadas (placeholder "conforme regulamento").
- `Sorteio.resultado` agora inclui `byePositions: number[]` (1-indexed).

### Notes
- Sorteios pré-v1.18.0 (sem `byePositions`) continuam renderizando via builder legado (nextPow2).
- Render fiel de R3+ para estruturas assimétricas (ex.: N=20 onde 4 R1-winners vão direto pra R3) fica para V2.
- Posições BYE para N=2..5 e N=23..77 foram derivadas via fórmula `min(N - pot2_below, pot2_above - N)` + standard seeding. Marcadas como "DERIVED — VERIFICAR" no seed SQL para conferência manual contra a planilha.

## [1.17.1] - 2026-05-30

### Fixed
- Mudar o `tipo_modalidade_id` de uma Modalidade agora apaga automaticamente os sorteios antigos da modalidade quando o novo tipo (grupos/chaves/etc) diverge do anterior. Antes, o sorteio antigo (com `tipo` snapshot do tipo anterior) continuava sendo renderizado por EventoInscricoes e Modo Congresso.
- Mudar o campo `tipo` de um TipoModalidade agora apaga automaticamente os sorteios de todas as Modalidades vinculadas quando o tipo muda. Mesma causa raiz.

### Notes
- Dados existentes corrigidos via SQL: TipoModalidade "Chaves" estava com `tipo='grupos'` (default da migration de criação do enum); ajustado para `chaves`. Mesma correção aplicada para "Especifico" e "Ordem de entrada". Sorteio órfão da modalidade Tênis Feminino 21 anos (Jogos Regionais de Campinas) apagado — re-sortear pela UI para gerar bracket de chaves.

## [1.17.0] - 2026-05-30

### Changed
- `SorteioChaves` (modalidades tipo chaves) agora renderiza bracket de eliminação simples em árvore (colunas horizontais por rodada), em vez de lista flat de slots.
- Labels semânticos por rodada: Final / Semifinal / Quartas / Oitavas / "Nª Rodada" para tamanhos maiores.
- Round 0 mostra os pares iniciais (nomes ou BYE quando N não é potência de 2). Rounds seguintes mostram placeholders "Vencedor M{n}".

### Notes
- Sem mudança no backend. Sorteios antigos (formato `size = pot2` com nulls) continuam renderizando — frontend confia em `slots.length` para determinar N atual.
- Badge de campeão do ano anterior continua aparecendo ao lado do nome na 1ª rodada.
- Constraint "modalidade tipo chaves não tem fase de grupos" já era garantida pelo backend (service dispatch por tipo).

## [1.16.1] - 2026-05-30

### Added
- Modo Congresso: passo "Participantes" agora permite adicionar inscritos (botão "+ Inscrever" abre modal com autocomplete) e remover (botão "×" por linha, com confirmação).
- Modo Congresso: passo "Campeões do Ano Anterior" agora tem botão "Editar campeões" que abre modal com 12 slots para cadastrar/remover.

### Changed
- `CampeaoSlot` extraído de `EventoInscricoes.tsx` para componente reutilizável (`frontend/src/components/CampeaoSlot.tsx`). Comportamento idêntico nas duas telas.

## [1.16.0] - 2026-05-30

### Added
- Tabela `sistema_disputas_chaves` agora gerenciada pelo Prisma (adotada via migration idempotente).
- Motor de sorteio: campeões inscritos viram sementes —
  - `grupos`: 1 campeão por grupo (até qtd grupos) na 1ª vaga; demais e excedentes vão pro sorteio normal.
  - `chaves`: até 4 campeões viram cabeças nas posições definidas em `sistema_disputas_chaves`; demais sorteados nos slots restantes.
- Novo 4º passo "Campeões do Ano Anterior" no Modo Congresso, entre Participantes e Sorteio. Lista grande com pill verde "✓ Inscrito" ou cinza "Não inscrito".

### Changed
- `drawBracket`: agora usa `size = N` literal (não mais próxima potência de 2). Sem BYEs.
- `chaves` exige regra cadastrada em `sistema_disputas_chaves` para o N de inscritos (400 amigável quando ausente).
- Modo Congresso: wizard cresceu de 4 para 5 passos.

### Notes
- Sorteios antigos persistidos em formato `size = pot 2 com nulls` continuam renderizando corretamente. Novos sorteios usam `size = N`.
- Operador re-sorteia para aplicar a nova regra de cabeças/sementes.

## [1.15.1] - 2026-05-30

### Changed
- Campeões do ano anterior: expandido de 3 para **12 slots** por (evento, modalidade) — agora cadastra do 1º ao 12º colocado.
- `CampeaoBadge`: posições 1-3 mantêm 🥇🥈🥉; posições 4-12 ganham círculo discreto com número ordinal (ex: `4º`).
- Grid de slots passa para 4 colunas no desktop (3 linhas × 4 cards = 12).

## [1.15.0] - 2026-05-30

### Added
- Entidade CampeaoAnterior: registra os 3 primeiros colocados do ano anterior por (evento, modalidade), com FK obrigatório para Participante.
- Endpoints `/campeoes-anteriores` (GET com filtros, POST, DELETE).
- Nova seção "Campeões do ano anterior" em `/eventos/:id/inscricoes` (modalidade selecionada) com 3 slots fixos (1º/2º/3º).
- Sinalização visual com medalhas 🥇🥈🥉 em 3 lugares: tabela de inscrições, render do sorteio (F4c) e Modo Congresso (F6).
- Componente reutilizável `CampeaoBadge` (com prop `large` para Datashow).

### Notes
- Componentes de resultado de sorteio ganham prop opcional `campeoesByParticipanteId` — não quebra usos atuais.
- Substituição = DELETE + POST (sem PUT).
- Apagar Evento cascateia (remove campeões anteriores junto).

## [1.14.0] - 2026-05-30

### Added
- Página /admin real: landing com 6 cards (Competições, Modalidades, Tipos de Modalidade, Municípios, Inspetorias, Delegacias) com contadores e link direto pro CRUD correspondente.
- Página /relatorio real: tabela de eventos (com status, inscrições, sorteios) e botão "Exportar CSV" por linha. Download gerado client-side com snapshot do evento: cada linha = (modalidade, participante, status_sorteio) cobrindo todos os tipos (grupos/chaves/ordem_entrada/especifico/não sorteado).

### Notes
- CSV inclui BOM UTF-8 para abrir corretamente no Excel com acentuação.
- Nenhum endpoint novo, nenhuma dependência nova.

## [1.13.0] - 2026-05-30

### Added
- Painel real (`/painel`): hero com saudação + CTAs (Modo Congresso, + Novo evento), 4 KPI cards (Competições / Eventos / Participantes / Sorteios realizados) e lista "Próximos sorteios" (eventos ativos com modalidades pendentes, ordenado por data, click → /eventos/:id/inscricoes).

### Notes
- Frontend-only — sem novos endpoints, sem migrations. Derivação client-side via useMemo sobre as queries de eventos/modalidades/sorteios.
- Gráficos (área inscrições + donut tipo) e Atividade recente ficam para iteração futura (F1b/F1c).

## [1.12.0] - 2026-05-30

### Added
- Modo Congresso (MVP): rota `/congresso` fullscreen dedicada à apresentação em Datashow. Wizard 4 passos: Evento → Modalidade → Participantes → Sorteio. Tipografia grande, cromo mínimo, header dark fixo (invariante ao tema).
- Botão "Modo Congresso" na topbar agora abre a tela (com requestFullscreen + navigate).
- Componentes `SorteioGrupos`/`SorteioChaves`/`SorteioOrdem` ganham prop `large?: boolean` para renderização ampliada (fonte ~1.5x, padding maior, grid mais largo).

### Notes
- Sem novos endpoints ou migrations — reutiliza /eventos, /modalidades, /inscricoes, /sorteios.
- Estado da sessão (passo, evento, modalidade) não persiste — refresh volta para o passo 1.
- Modais de incluir/log/expandir, paginação dinâmica, print PDF, theme próprio e animações ficam para iteração futura (F6b).

## [1.11.0] - 2026-05-30

### Added
- Importação CSV em massa de inscrições no workspace de evento (`/eventos/:id/inscricoes`) — wizard 3 passos: upload → revisão (dry-run com contadores e tabela por linha) → importação.
- Auto-criação de Participante global quando o CSV traz nome+município que ainda não existe (match case-insensitive).
- Endpoint `POST /inscricoes/import` (admin) com modo `dry_run` para preview sem persistência.

### Notes
- CSV header obrigatório: `nome,municipio_uf,municipio_nome,subtitulo` (subtítulo opcional). Linhas com município inexistente viram erro e não bloqueiam as demais.
- Limite de 2000 linhas por import.

## [1.10.0] - 2026-05-30

### Added
- Workspace operacional em /eventos/:id/inscricoes: seção "Sorteio" por modalidade com botão Sortear / Re-sortear (confirm) / Apagar sorteio (confirm).
- Visualização do resultado por tipo: cards de grupo (grupos), lista numerada com BYEs (chaves), lista ordenada com medalhas top 3 (ordem de entrada).
- Indicador de progresso "X de Y modalidades sorteadas" + barra.
- Selo ✓ verde nas chips de modalidades que já foram sorteadas.

### Notes
- Aviso amigável quando modalidade é do tipo `especifico` (sem sorteio automático).
- Erros 400 do backend (sem regra de grupos, 0 inscritos) renderizados inline.

## [1.9.0] - 2026-05-30

### Added
- Entidade Sorteio: persiste resultado por (evento, modalidade) com seed de auditoria e tipo snapshot. Re-sorteio sobrescreve.
- Motor de sorteio determinístico (PRNG mulberry32): drawGroups (consulta sistema_disputas_grupos), drawBracket (pad até potência de 2 com byes), shuffleOrder.
- Endpoints `/sorteios` (GET lista, GET id, DELETE) e `POST /sorteios/executar` (gera + persiste via upsert). Sem UI nesta fase.

### Notes
- Tipo `especifico` não suporta sorteio automático (retorna 400).
- Tipo `grupos` exige regra cadastrada em `sistema_disputas_grupos` para o N de inscritos da competição (400 amigável quando ausente).

## [1.8.0] - 2026-05-30

### Added
- Entidade Inscricao: vínculo Evento × Modalidade × Participante (unique composto, sem duplicatas).
- Tela /eventos/:id/inscricoes com chips de modalidade, lista de inscritos e modal de inscrever (autocomplete sobre pool global de Participantes).
- Componente reutilizável `ParticipanteSelect` (autocomplete client-side).

### Changed
- Card do Evento (lista /eventos) ganha botão "Inscrições" que leva à nova tela operacional.
- Apagar um Evento agora também remove suas inscrições em cascata.

## [1.7.0] - 2026-05-30

### Added
- TipoModalidade ganha campo `tipo` (enum TipoDisputa: grupos / chaves / específico / ordem de entrada) — discriminador que o futuro Workspace (F4) usa para decidir o fluxo de disputa.
- UI admin: select de tipo no formulário e coluna "Tipo" na lista de Tipos de Modalidade.

### Changed
- Tipos de Modalidade existentes recebem `tipo = 'grupos'` por default (reclassificação manual via /admin pós-deploy).

## [1.6.0] - 2026-05-30

### Added
- Entidade Evento: edições de competições com data/hora, local, organizador e status (rascunho / inscrições / pronto / sorteado / parcial). FKs para Competição e Município.
- Página /eventos com grid de cards (substitui placeholder F0) + formulário de criação/edição.

### Changed
- Competição agora bloqueia exclusão se houver Eventos vinculados (além de Modalidades).
- Município agora bloqueia exclusão se houver Eventos vinculados (além de Participantes).

### Fixed
- Recuperação da tabela `sistema_disputas_grupos` (regras de composição de grupos por competição) que havia sido removida por engano em migração intermediária.

## [1.5.0] - 2026-05-29

### Added
- Design System R2P aplicado: tokens (cores, tipografia Inter + JetBrains Mono, sombras, motion) e tema claro/escuro com toggle na topbar.
- Login redesign split-pane (hero gradient + form), mantendo o JWT real.
- Novo app shell: sidebar com gradiente + categorias (Operação / Gestão), botão recolher, sub-menu expansível em "Administração", rodapé com user e versão.
- Topbar 64px sticky com breadcrumbs, busca, toggle de tema, botão "Modo Congresso" (placeholder).
- Páginas placeholder de "Em construção" para Painel, Eventos, Relatório e Administração — fases F1, F2 e F7.

### Changed
- Sidebar reorganizado: itens agrupados em Operação (Competições · Eventos · Participantes) e Gestão (Relatório · Administração ▾). CRUDs atuais (Municípios, Inspetorias, Delegacias, Tipos de Modalidade, Modalidades) viraram sub-itens de Administração.
- Redirect raiz de `/participantes` para `/painel`.
- Todas as páginas existentes (Municípios, Inspetorias, Delegacias, Participantes, Tipos de Modalidade, Modalidades, Competições, Novidades, MunicipioSelect, DataTable) repintadas com tokens semânticos — funcionam em tema claro e escuro.
- `lucide-react` atualizado para a versão mais recente.

### Removed
- Item raiz "Competições" desaparece (movido para dentro de Operação) — sem perda de funcionalidade.

## [1.4.1] - 2026-05-29

### Changed
- Renomeado valor do enum interno `Role.DELEGACAO` para `Role.PARTICIPANTE` (alinha com a nomeação atual da entidade). Sem impacto em UI ou comportamento.

## [1.4.0] - 2026-05-29

### Added
- Entidade TipoModalidade com CRUD admin.
- Modalidade ganha FKs obrigatórias para Competição e TipoModalidade, e novo campo Sigla.

### Changed
- Modalidade reescrita: agora pertence a uma Competição, tem Tipo (FK) e Sigla; nome e sigla únicos por competição (uniqueness composto).
- Sidebar: "Tipos de Modalidade" entra entre Participantes e Modalidades; "Categorias" removido.

### Removed
- Entidade Categoria (e enum Genero — só era usado por Categoria).
- Campo `descricao` de Modalidade.
- Item "Categorias" do sidebar e rotas correspondentes.

## [1.3.0] - 2026-05-29

### Added
- Entidade Competição com CRUD admin (nome único, lista de UFs onde acontece, flag "adicionar subtítulo").

### Changed
- Sidebar reorganizado: item "Competições" movido para o grupo "Cadastros".
- Constante de UFs do Brasil extraída para `frontend/src/lib/ufs.ts` (DRY).

### Removed
- Item "Edições" do sidebar (entidade ainda não implementada).
- Grupo "Competições" do sidebar (item único movido para Cadastros).

## [1.2.0] - 2026-05-29

### Added
- Entidade Inspetoria com CRUD admin.
- Entidade Delegacia com CRUD admin.
- Entidade Participante (substitui Delegação) com FKs para Inspetoria, Delegacia e Município.
- Campo Subtítulo opcional em Participante.

### Changed
- Renomeada "Delegações" para "Participantes" no sidebar e nas rotas.
- Município agora bloqueia exclusão se houver Participante vinculado (antes era Delegação).

### Removed
- Entidade Delegação (substituída por Participante).
- Campo logo do registro (não era usado pelos novos requisitos).

## [1.1.0] - 2026-05-28

### Added
- Cadastro de Municípios com importação de CSV (IBGE).
- Autocomplete de município no formulário de Delegação.
- Versão visível no rodapé do sidebar com badge de novidades.

### Changed
- Delegação agora referencia município por FK (`municipio_id`).

## [1.0.0] - 2026-05-27

### Added
- Autenticação com JWT (admin/delegação/viewer).
- Cadastro de Delegações, Modalidades e Categorias.
