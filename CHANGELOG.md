# Changelog

Todos os releases notáveis deste projeto.

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versionamento: [SemVer](https://semver.org/lang/pt-BR/).

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
