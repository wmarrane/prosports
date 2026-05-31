# Changelog

Todos os releases notáveis deste projeto.

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versionamento: [SemVer](https://semver.org/lang/pt-BR/).

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
