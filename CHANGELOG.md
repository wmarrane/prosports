# Changelog

Todos os releases notáveis deste projeto.

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versionamento: [SemVer](https://semver.org/lang/pt-BR/).

## [1.45.0] - 2026-06-01

### Changed (EventoInscricoes — modal re-sortear padrão do sistema)
- Substituído `confirm()` nativo pelo modal padrão: ícone Shuffle em círculo `--warn-soft`, mostra nome da modalidade, botões Cancelar (ghost) + Confirmar (brand).

### Changed (CongressoStepEvento — usa logo do evento)
- Cards de evento na primeira etapa do Modo Congresso priorizam `evento.logo_url`: quando ausente exibe o badge Troféu atual. Quando presente, renderiza o logo dentro de um quadrado com fundo neutro + borda sutil.

### Added (InspetoriasList — agrupar por delegacia + side panel)
- Lista agora agrupa inspetorias por delegacia, com cabeçalho clicável (chevron + ícone Building2 + contador). Recolhidas por padrão. Atalhos "Expandir todas / Recolher todas" quando há mais de uma delegacia.
- Layout 2-colunas: lista à esquerda + `ParticipantesAssociadosPanel` à direita (sticky) mostrando participantes da inspetoria selecionada.

### Added (DelegaciasList — side panel)
- Layout 2-colunas: grid de delegacias à esquerda + `ParticipantesAssociadosPanel` à direita (sticky). Cards clicáveis selecionam (borda highlight); links Editar/Remover preservados.

### Added (componente reutilizável)
- `ParticipantesAssociadosPanel` aceita filtro por delegacia ou inspetoria, mostra count, lista sortable, botões clicáveis abrem ParticipanteForm. Estado vazio amigável quando nada selecionado.

## [1.44.1] - 2026-06-01

### Changed (Login: logo Montana maior e centralizado)
- Logo horizontal V3 acima do formulário aumentou de 120px → **160px** de altura, com `justify-content: center` no wrapper.

## [1.44.0] - 2026-06-01

### Added (Apagar todos os sorteios de um evento)
- **Backend**: novo endpoint `DELETE /sorteios/evento/:evento_id` (admin). Usa `prisma.sorteio.deleteMany({ where: { evento_id } })` e retorna `{ count }`.
- **Frontend (EventoInscricoes — banner de progresso)**: botão "Apagar sorteios" (vermelho, com ícone Trash) aparece ao lado de "Editar evento" **apenas se houver sorteios executados** (`sorteadas > 0`).
- **Modal de confirmação** (padrão do sistema): ícone Trash em círculo `--danger-soft`, mostra nome do evento + quantidade que será apagada, aviso "inscrições e campeões anteriores permanecem", botões Cancelar/Apagar N. Após sucesso mostra tela de confirmação com ícone Check verde + contador.

## [1.43.3] - 2026-06-01

### Fixed (Banner Olá no Painel)
- Título "Olá, …" estava ilegível (cor escura sobre fundo azul) — `h1` global em `tokens.css` sobrescrevia a cor branca herdada. Cor explícita `#fff` aplicada inline.
- Padding do banner aumentou de `32px 36px` para `44px 48px` (mais respiro lateral/vertical).
- Espaçamento entre elementos: eyebrow→título 12px, título→parágrafo 10px, parágrafo→botões 24px (antes era inconsistente).
- Título com `letter-spacing: -0.02em` para um look mais display.

## [1.43.2] - 2026-06-01

### Changed (Login: logo Montana mais visível)
- Logo horizontal V3 acima dos campos de e-mail/senha aumentou de 70px para 120px de altura.

## [1.43.1] - 2026-06-01

### Added (Logo do evento mais visível no Modo Congresso)
- **CongressoStepModalidade** (card direito): logo do evento (110×110, padding 8, borda sutil) aparece abaixo do badge "Sorteado" na coluna direita do top do card da modalidade selecionada. Renderiza apenas se o evento tem `logo_url`.
- **CongressoShell** (etapas Participantes e Sorteio): logo do evento renderizado como **marca d'água centralizada** no fundo do painel (max 55% width / 60% height, opacity 0.06, grayscale 40%, `pointer-events: none`, atrás do conteúdo via `z-index`). Aparece apenas se `eventoLogoUrl` existir e step ∈ {participantes, sorteio}.

## [1.43.0] - 2026-06-01

### Added (Logotipo customizado por evento)
- **Schema**: `Evento.logo_url String?`. Migration `20260601200000_evento_logo_url`.
- **Backend**:
  - `POST /eventos/:id/logo` (multer.single 'logo', até 2MB, JPEG/PNG/WebP) → salva em `uploads/eventos/{uuid}.{ext}`, atualiza `Evento.logo_url = /uploads/eventos/{uuid}.{ext}`. Apaga logo antiga antes de salvar a nova.
  - `DELETE /eventos/:id/logo` → apaga arquivo + limpa `logo_url`.
  - Service `setLogoUrl` + `getLogoUrl`.
- **EventoForm**: novo card "Logotipo do evento" (visível apenas em edição, depois que o evento existe). Mostra preview 140×140, botões "Enviar logo / Trocar logo / Remover", validação de tipo/tamanho exibida ao usuário. Texto explicativo: "Modo Congresso usará logo padrão do sistema" quando ausente.
- **Modo Congresso (`CongressoShell`)**: a posição do brand glyph (canto superior esquerdo, ao lado de "ProSports / CONGRESSO") agora prioriza o logo do evento. Quando o evento não tem logo customizado, exibe o símbolo Montana padrão (fallback). Funciona em todas as 4 etapas do wizard.
- **Volume**: `uploads_data` já mapeado em `docker-compose.yml`, persiste entre restarts do container.

## [1.42.1] - 2026-06-01

### Changed (Login com logo V3 no formulário)
- **Hero (esquerdo)**: glyph do brand agora usa quadrado branco semi-transparente (rgba 0.96, 58×58, padding 6) com o símbolo V3 colorido dentro (42px), em vez do quadrado azul gradient + símbolo branco procedural — destaca melhor o logo oficial.
- **Hero (rodapé)**: bloco "powered by" removido (era redundante com o V3 prominente no formulário).
- **Formulário (direito)**: logo horizontal V3 grande (70px) acima do título "Acesso administrativo". Marca a página com a identidade Montana no lado claro onde o V3 colorido tem contraste perfeito.

## [1.42.0] - 2026-06-01

### Changed (Logo V3 oficial + substituição do glyph "PS")
- Arquivos `LogoMarca/files_V3/simbolo-isolado.png` e `op5B-montana-eventos.png` copiados para `frontend/public/montana/` como `simbolo.png` e `horizontal.png`. Servidos como assets estáticos (cache de browser).
- `LogoMontana` reescrito: variantes `simbolo` e `horizontal-cor` agora carregam as imagens V3 via `<img>`. Variantes `simbolo-branco` e `horizontal-branco` continuam como SVG procedural (branco, para fundos escuros).
- **Sidebar — brand**: glyph "PS" no topo substituído pelo símbolo Montana V3 (36px). Removido o logo horizontal duplicado no rodapé (que tinha sido adicionado em v1.41.0).
- **CongressoShell — brand**: glyph "PS" no topo substituído pelo símbolo Montana V3 (40px). Removido o símbolo duplicado nas ações.
- **Login**: brand do hero continua com `simbolo-branco` (procedural branco) — V3 colorida não tem contraste suficiente sobre o gradient azul escuro.

## [1.41.1] - 2026-06-01

### Changed (Logo Montana no topo do hero do Login)
- Substituído o glyph "PS" do brand do Login pelo símbolo Montana (variante branca). O quadrado azul com gradiente foi mantido como moldura.
- `LogoMontana` ganhou nova variante `simbolo-branco` (arcos em paleta clara para fundos escuros).

## [1.41.0] - 2026-06-01

### Added (Logomarca Montana Eventos no sistema)
- Novo componente `LogoMontana` (SVG inline em React, ~3 variantes: `horizontal-cor`, `horizontal-branco`, `simbolo`). Aceita prop `height` (largura derivada do aspect 620:180), `style`, `className`, `title`. Escala perfeita, sem request HTTP, herda cores via fill.
- **Login** (hero esquerdo, rodapé): bloco "powered by [logo branco]" alinhado à direita do bloco de estatísticas, opacidade 0.85.
- **Sidebar** (rodapé, abaixo da versão): logo horizontal cor (32px) quando expandida; símbolo (26px) quando recolhida.
- **Modo Congresso → CongressoShell** (top bar, antes das ações): símbolo isolado (32px) com opacidade 0.75, aparece em todas as telas do modo apresentação.
- **Relatório** (header, lado das ações): logo horizontal cor (36px) com opacidade 0.85.

## [1.40.3] - 2026-06-01

### Changed (CampeaoBadge alinhado à direita em grupos / chaves / inscritos)
- Por consistência com o `AnfitriaoBadge`, o `CampeaoBadge` (posição do campeão anterior) também migrou para o lado direito do item.
- Ordem final dos badges à direita: `... [CampeaoBadge] [AnfitriaoBadge]`.
- Aplicado em: `SorteioGrupos`, `SorteioChaves` (slot + vertical list), `BracketTree`, lista de inscritos (`EventoInscricoes`).
- Banner "Cabeças" e `CampeoesPanel` continuam com badge à esquerda (são listas semânticas do campeão, não do participante).

## [1.40.2] - 2026-05-31

### Changed (AnfitriaoBadge alinhado à direita)
- O badge 🏠 verde do anfitrião migrou da posição inicial (após o `CampeaoBadge`) para o final do item (depois do nome + linha complementar). Cada item ganhou um wrapper com `flex: 1` para empurrar o badge para a borda direita.
- Aplicado em: `SorteioGrupos`, `SorteioChaves` (slot + vertical list), `SorteioOrdem`, `BracketTree`, banner Cabeças e modal de grupo expandido (`CongressoStepSorteio`), `CampeoesPanel` e lista de inscritos (`EventoInscricoes`).

## [1.40.1] - 2026-05-31

### Added (Badge 🏠 do anfitrião nas telas de sorteio)
- Novo componente `AnfitriaoBadge` (quadrado verde com ícone Home), análogo ao `CampeaoBadge`.
- Componentes de sorteio (`SorteioGrupos`, `SorteioChaves`, `SorteioOrdem`, `BracketTree`) aceitam prop `anfitriaoPid?: number | null` e exibem o badge ao lado do nome do participante anfitrião.
- `EventoInscricoes` passa `evento.anfitriao_id` para os 3 renders de sorteio.
- `CongressoStepSorteio`: carrega `evento` para obter `anfitriao_id`, passa para os renders, para `CampeoesPanel` e mostra o badge no banner "Cabeças" e no modal de grupo expandido.
- `CampeoesPanel`: badge ao lado do nome do campeão que também é anfitrião.

## [1.40.0] - 2026-05-31

### Added (Anfitrião do evento + privilégio de cabeça no sorteio)
- **Schema**: `Competicao.considerar_anfitriao Boolean @default(false)` e `Evento.anfitriao_id Int?` (FK Participante, `ON DELETE SET NULL`). Migration `20260601010000_anfitriao_evento`.
- **CompeticaoForm**: novo checkbox "Considerar anfitrião do evento" abaixo da seção "Linha de exibição do participante" com explicação da regra.
- **EventoForm**: novo card "Participante anfitrião do evento" com `ParticipanteSelect`. Mostra dica se a competição considera ou não a regra.
- **EventoInscricoes**: ícone 🏠 verde ao lado do participante anfitrião na lista de inscritos da modalidade.
- **Backend sorteios (engine de cabeças)**: nova função `applyAnfitriaoRule` ativada quando `competicao.considerar_anfitriao === true`, `evento.anfitriao_id != null` e o anfitrião está inscrito na modalidade:
  - Se anfitrião já é top-4 campeão: regra não se aplica (mantém posição).
  - **Grupos** com 3 grupos: anfitrião vira cabeça do grupo C (pos 3, deslocando o atual).
  - **Grupos** com 4+ grupos: anfitrião vira cabeça do grupo D (pos 4).
  - **Grupos** com < 3 grupos: regra não se aplica.
  - **Chaves** (sempre máx 4 cabeças): anfitrião vira 4º cabeça, deslocando antigo.
- **Tests**: 13 novos casos cobrindo todas as combinações da regra. 192 testes passando.

## [1.39.4] - 2026-05-31

### Changed (Linha de exibição abaixo do nome em Chaves bracket)
- `BracketTree`: linha complementar do participante quebra para uma segunda linha em fonte menor (`0.7rem`/`0.8rem`) e cor `--t3`. Card de match aumentou de 90×240px para 120×260px para acomodar nome + linha em cada slot sem estourar.
- Nome em `lineHeight 1.15`, ellipsis quando ainda exceder a largura do card.

## [1.39.3] - 2026-05-31

### Changed (Linha de exibição abaixo do nome em Sorteio de Grupos)
- `SorteioGrupos`: linha complementar do participante (delegacia/subtítulo/etc) agora aparece em uma segunda linha abaixo do nome, em fonte menor e cor `--t3`. Antes ficava inline como "Nome — Linha", o que dificultava leitura quando havia muitos itens.
- Modal de grupo expandido no Modo Congresso: mesmo layout (nome em cima, linha abaixo em fonte menor).

## [1.39.2] - 2026-05-31

### Fixed (Linha de exibição vinha vazia nas telas de sorteio)
- Causa raiz real: `inscricoes.service.ts` e `campeoes_anteriores.service.ts` carregavam `{ participante: true }` sem deep-include de `municipio`/`inspetoria`/`delegacia`. Resultado: a função `composeSubtituloLine` recebia `p.delegacia` undefined e retornava null em todas as telas que reaproveitam essas listas (Inscritos, Sorteio de grupos/chaves/ordem, Cabeças, Campeões anteriores).
- Fix: deep-include `{ participante: { include: { municipio: true, inspetoria: true, delegacia: true } } }` nos dois services. Testes ajustados (179 passando).

### Changed (Confirmação de remoção de inscrição)
- `EventoInscricoes`: substituído `confirm()` nativo pelo modal de confirmação padrão do sistema (X em círculo `--danger-soft`, "Cancelar" ghost + "Remover" `--danger`), igual ao usado em `ModalidadesPanel` e `CongressoStepParticipantes`.

## [1.39.1] - 2026-05-31

### Fixed (Linha de exibição do participante não propagava em todas as telas de sorteio)
- **CampeoesPanel** (Modo Congresso → Sorteio): adicionou prop `subtituloLine` e renderiza a linha tanto na lista resumida quanto em cada `CampeaoSlot` do modal de edição. Antes mostrava só `nome`.
- **CongressoStepSorteio** → banner "Cabeças": agora mostra nome + linha de exibição abaixo (em fonte menor) para cada cabeça inscrita ou não-inscrita.
- `CongressoStepSorteio` passa `subtituloLine` (já derivado de `competicao.subtitulo_campos`) para o `CampeoesPanel`.

## [1.39.0] - 2026-05-31

### Added (Inscritos por modalidade + inscrição múltipla)
- **Backend**:
  - `GET /inscricoes/counts?evento_id=N` → `{ [modalidade_id]: count }` via Prisma `groupBy`.
  - `POST /inscricoes/bulk` aceita `{ evento_id, modalidade_id, participante_ids: [] }` (até 500). Usa `createMany skipDuplicates`, retorna `{ criadas, duplicadas, erros }`.
- **EventoInscricoes — sidebar**: badge com ícone Users + count ao lado de cada modalidade (preenchida pela nova rota counts; invalida sempre que inscrições mudam).
- **EventoInscricoes — modal Inscrever**: agora multi-select. Novo componente `ParticipantesMultiSelect` (checklist com busca, "Marcar/Desmarcar visíveis", contagem de selecionados). Após confirmar mostra resumo (Inscritos / Já inscritos / Erros) com opção "Inscrever mais" para continuar na mesma modalidade.

## [1.38.0] - 2026-05-31

### Added (Inspetoria pertence a Delegacia + filtro em participante)
- **Schema**: `Inspetoria.delegacia_id` agora é NOT NULL com FK `Delegacia` (`ON DELETE RESTRICT`). Migration tolerante: se houver inspetorias preexistentes assigna ao menor `id` de delegacia (em prod estavam zeradas, sem efeito).
- **Backend**: `inspetorias.listar` aceita `?delegacia_id=` para filtrar; create/edit exigem `delegacia_id`; responses incluem `delegacia` (nested).
- **InspetoriaForm**: select de delegacia obrigatório no topo.
- **InspetoriasList**: cards mostram nome da delegacia abaixo do nome da inspetoria.
- **ParticipanteForm**: ordem trocada — Delegacia primeiro, Inspetoria depois (disabled enquanto sem delegacia). Mudar delegacia limpa inspetoria se ela não pertencer mais à nova delegacia. Mensagem amigável quando a delegacia não tem inspetorias.

## [1.37.0] - 2026-05-31

### Added (Manutenção dos sistemas de disputa + copiar entre competições)
- **Schema**: `SistemaDisputasChaves` agora é por competição. Migration `20260531235000_sistema_disputas_chaves_per_competicao` adiciona `competicao_id`, replica linhas existentes para TODAS as competições (cada competição herda o template global anterior), troca unique `(numero_inscrito)` por `(competicao_id, numero_inscrito)` e adiciona FK com `ON DELETE CASCADE`.
- **Backend**: novo módulo `sistemas-disputa` com CRUD admin para `grupos` e `chaves` (filtrados por `competicao_id`) e endpoint `POST /sistemas-disputa/copiar` que dentro de uma transaction faz DELETE+INSERT atômico (substituir destino).
- **Frontend**: nova página `Administração → Sistemas de disputa` com seletor de competição no topo, tabs Grupos/Chaves, tabelas com add row inline + edit inline + delete por linha, e modal "Copiar de outra competição" (escolhe origem + tipo `grupos | chaves | ambos`, com aviso de substituição).
- **Sorteios**: query de `sistemaDisputasChaves` agora filtra por `competicao_id` do evento (alinhado com `SistemaDisputasGrupos`).

## [1.36.1] - 2026-05-31

### Added (Versão na tela de login)
- Linha discreta `v<APP_VERSION> (<APP_COMMIT>)` em fonte mono no final do bloco de credenciais, abaixo dos badges de segurança. Reutiliza as constantes `APP_VERSION`/`APP_COMMIT` (já usadas na Sidebar).

## [1.36.0] - 2026-05-31

### Added (Indicadores dinâmicos na tela de login)
- **Backend**: novo endpoint público `GET /stats/public` (sem auth) retornando `{ inscritos_ativos, sorteios_realizados }`. `inscritos_ativos` = `COUNT(inscricoes)` filtrando `evento.data_hora >= hoje (00:00)`. `sorteios_realizados` = `COUNT(sorteios)` total.
- **Frontend**: `Login` busca via React Query (staleTime 60s) e formata em pt-BR. \"100% Auditados\" continua estático (branding). Enquanto carrega, mostra `—`.

## [1.35.0] - 2026-05-31

### Added (Recolher/expandir competições em Modalidades)
- `ModalidadesList` (Administração → Modalidades): cabeçalho de cada competição vira botão clicável com chevron que recolhe/expande as modalidades daquela competição. Quando há mais de uma competição, aparece também atalho "Recolher todas / Expandir todas". Estado vive em memória (session-only).

## [1.34.2] - 2026-05-31

### Fixed (Import de modalidades deslogava o usuário)
- Clicar em **Enviar e processar** no `ImportModalidadesModal` causava reload da página e redirect para `/login`. Causa raiz: o `<form>` interno do modal estava aninhado dentro do `<form>` do `CompeticaoForm` — HTML descarta forms aninhados, então o submit disparava o form externo (full-page GET para `/competicoes/:id/editar?`), descartando o accessToken em memória. Fix: substituir o `<form>` interno por `<div>` e invocar a mutation via `onClick` em botão `type="button"`.

### Changed (Confirmação de remoção de modalidade)
- Substituído `confirm()` nativo do browser em `ModalidadesPanel` pelo modal de confirmação padrão do sistema (ícone X em círculo `--danger-soft`, botão "Cancelar" ghost + "Remover" `--danger`).

## [1.34.1] - 2026-05-31

### Fixed (Migration reset_all_sequences quebrada)
- A migration `20260531230000_reset_all_sequences` (v1.33.1) falhava no `prisma migrate deploy` com `relation "user_id_seq" does not exist` — `format('SELECT setval(%L, ...)')` passava o nome cru e Postgres lowercased. Fix: `quote_ident(rec.seq_name)` preserva o case. Migration reaplicada em prod manualmente; CI deploy desbloqueado.

## [1.34.0] - 2026-05-31

### Added (Import CSV de Modalidades)
- **Backend**: novo endpoint `POST /modalidades/import` (multipart/form-data com `arquivo` + `competicao_id`). Service `importarCsv(competicao_id, content)` faz upsert por `(competicao_id, nome)`: existentes ganham update de sigla/tipo se diferentes; novos são criados. Erros por linha (nome vazio, sigla vazia, tipo_modalidade desconhecido, sigla conflitando) são reportados. CSV parser reutiliza `municipios/csv-parser.ts`.
- **Frontend**: `ImportModalidadesModal` no padrão dos demais imports (modelo + instruções + upload + resultado). Botão "Importar CSV" no header do `ModalidadesPanel` (dentro do CompeticaoForm edit).
- **Template**: `nome,sigla,tipo_modalidade` — onde `tipo_modalidade` é o `nome` do `TipoModalidade` cadastrado (case-insensitive).

## [1.33.1] - 2026-05-31

### Fixed (Postgres sequences dessincronizadas)
- Bug: criar modalidade em qualquer competição retornava HTTP 409 "Já existe..." mesmo quando a sigla/nome não conflitava. Causa raiz: `Modalidade_id_seq.last_value = 13` enquanto `MAX(id) = 68` no banco — `nextval()` retornava IDs já existentes, disparando P2002 na PK.
- Origem provável: seed/restore com IDs explícitos não atualiza a sequence automaticamente no Postgres.
- Fix imediato em prod: `SELECT setval('"Modalidade_id_seq"', MAX(id), true)`.
- **Migration preventiva** `20260531230000_reset_all_sequences/migration.sql`: bloco `DO` em PL/pgSQL que itera `pg_class/pg_depend` e reseta TODAS as sequences (autoincrement) para `MAX(id)` da tabela correspondente. **Idempotente** — pode rodar quantas vezes for necessário. Aplicada via `prisma migrate deploy` no CI.

## [1.33.0] - 2026-05-31

### Added (Subtítulo parametrizável por Competição)
- **Schema**: `Competicao.subtitulo_campos: String[]` substitui o boolean `adicionar_subtitulo`. Migration preserva comportamento atual (`true` → `['subtitulo']`, `false` → `[]`); coluna antiga removida.
- **Backend**: validação zod aceita enum (`subtitulo | municipio | inspetoria | delegacia`), rejeita duplicatas e máx 4 itens. Service `validateCampos` mantém invariantes.
- **Frontend — util `composeSubtituloLine(p, campos)`** (em `frontend/src/lib/compose-subtitulo.ts`): junta valores na ordem definida com ` | `, omite vazios silenciosamente, retorna `null` quando nada compõe. 8 testes vitest cobrindo todos os casos.
- **CompeticaoForm** ganhou seção "Linha de exibição do participante": checkboxes dos 4 campos + reorder via setas ↑↓ + preview ao vivo com dados de exemplo ("João Silva — Clube XYZ | Campinas/SP | ...").
- **Componentes de sorteio** (`SorteioOrdem`, `SorteioGrupos`, `SorteioChaves`, `BracketTree`, `CampeaoSlot`) trocam prop `mostrarSubtitulo: boolean` por `subtituloLine?: (p) => string | null`.
- **Pages atualizadas**: `EventoInscricoes`, `CongressoStepParticipantes`, `CongressoStepSorteio`, `CongressoStepCampeoes`, `ImportInscricoesModal`, `Relatorio` derivam `camposSubtitulo` de `evento.competicao.subtitulo_campos` e passam o callback aos children. `ImportInscricoesModal` e `Relatorio` ainda usam `incluiSubtitulo = camposSubtitulo.includes('subtitulo')` para decidir se a coluna `subtitulo` aparece no CSV.
- **CompeticoesList**: badge "com subtítulo" virou contador `"N campo(s) extra(s)"` com tooltip listando os campos selecionados.
- **EventoInscricoes** — chip de inscrito: agora compõe a linha pela config; se `municipio` está na config, não duplica com o município mostrado separadamente.

### Migration
- `adicionar_subtitulo = true` → `subtitulo_campos = ['subtitulo']`
- `adicionar_subtitulo = false` → `subtitulo_campos = []`
- Coluna `adicionar_subtitulo` é removida no fim da migration.

### Telas globais (sem mudança)
- `ParticipantesList`, `ParticipanteForm`, `ParticipanteSelect` continuam exibindo subtítulo sempre — cadastro global não pertence a competição específica.

## [1.32.14] - 2026-05-31

### Changed (Bracket — conectores coloridos por match)
- Cada conector do bracket agora ganha cor própria com **rotação de hue HSL** baseada no índice do match-source (J1 azul, J2 verde, J3 ciano, ...). Saturação `65%` e lightness `60%` ficam visíveis em light e dark mode, mantendo a paleta dos cards.
- Permite rastrear visualmente de onde cada linha sai (J3 sai de J1, J7 sai de J3 + J4, etc.).
- **Conectores do 3º lugar** continuam em `--t4` (cinza neutro) para se diferenciar do caminho principal.

## [1.32.13] - 2026-05-31

### Fixed (Título de Grupo — override de tokens.css)
- O título "Grupo X" em `SorteioGrupos` continuava cinza no dark mode mesmo após v1.32.12. Causa raiz: `tokens.css` tem `h1..h5 { color: var(--fg-1) }` como regra unlayered, que vence Tailwind utilities (que ficam em `@layer utilities`). Fix: aplicar `color: 'var(--warn)'` via `style` inline (especificidade 1000, sempre vence).

## [1.32.12] - 2026-05-31

### Changed (Grupos — legibilidade dark + modal expandido)
- **Título "Grupo X"** trocado de `--brand-500` (azul escuro, baixo contraste no dark) para `--warn` (âmbar) — alto contraste em light e dark. Visual consistente com o badge "Cabeças" e "Final".
- **Modal de grupo expandido** (Modo Congresso): título "Grupo X" também em âmbar; borda do modal `1.5px --t2` (era `--card-bd`, invisível); cada participante na lista ganhou borda `1px --t3` para destacar do fundo `--cw-soft`; box-shadow externo mais forte para profundidade.

## [1.32.11] - 2026-05-31

### Changed (SorteioGrupos — legibilidade dark mode)
- **Bordas dos cards de Grupo** trocadas de `--card-border` (≈7% white no dark, imperceptível) para `--t2` `1.5px`. Divisor entre título e participantes em `--t3`.
- **Título "Grupo X"** trocado de `--t1` para `--brand-500` (cor de destaque azul) — sobressai em light e dark, alinhado com o pattern visual do projeto.

## [1.32.10] - 2026-05-31

### Changed (Campeões anteriores — regras por tipo de modalidade)
- **Banner Cabeças no Modo Congresso** (`CongressoStepSorteio`): mostra TODOS os campeões cadastrados (não mais só os 4 primeiros). Os não-inscritos seguem tachados. Aplicação visual única; backend continua semeando até 4 cabeças no bracket de Chaves e todos no Grupos.
- **Card "Campeões do ano anterior"** em `EventoInscricoes`: agora só aparece para `tipo === 'chaves'` ou `tipo === 'grupos'`. Antes escondia só para `ordem_entrada` — agora também esconde para `especifico` (não faz sentido seedar por colocação em modalidades sem disputa).

## [1.32.9] - 2026-05-31

### Changed (Modo Congresso — banner de Cabeças)
- O banner "Cabeças" agora mostra os **top-4 campeões do ano anterior independente da inscrição**. Os que **não estão inscritos** nesta modalidade aparecem **tachados** (line-through) com opacidade reduzida (`0.55`) e tooltip explicativo. Antes só os inscritos eram listados, sem indicação de quem ficou de fora.

## [1.32.8] - 2026-05-31

### Changed (Bracket — conectores, bordas dark mode)
- **Conectores principais**: stroke `2.5px` → `4px` com cor `--t2` + linecap/linejoin `round`.
- **Conectores do 3º lugar** (refs `L:Jx` ou destino = thirdPlace): stroke `2.5px` com cor `--t4` (mais claro). Visualmente distingue a "disputa do bronze" do caminho principal do bracket.
- **Borda das caixas** trocada de `--card-border` (≈7% white opacity no dark) para `--t2` (cinza claro) com largura `1.5px`. Borda do divisor interno trocada para `--t3`. Garante leitura em dark mode sem prejudicar light.
- **Borda da Final** mantida amarela `#f59e0b 2px`.

### Changed (Modo Congresso — confirmar remoção)
- `CongressoStepParticipantes`: substituído `confirm()` nativo do browser por modal de confirmação seguindo o padrão `.cw-confirm` (mesmo visual do "Realizar novo sorteio"). Ícone X dentro de círculo `--danger-soft`, botão **Remover** em `--danger`, **Cancelar** ghost.

## [1.32.7] - 2026-05-31

### Changed (Bracket — BYE alinhado com confronto antecedente)
- Em R2+, quando um input é BYE (P ref) e o outro é match real (V:/L:), o card é posicionado de modo que o **slot do BYE fique alinhado horizontalmente com o centro do match antecedente**. Ex.: J3 (P1 BYE + V:J1) → Valinhos aparece na mesma linha de J1. Casos sem BYE seguem midpoint dos inputs.

## [1.32.6] - 2026-05-31

### Changed (Bracket — espaçamento vertical compacto)
- **Altura total** agora é `r1MatchesCount × (CARD_HEIGHT + ROW_GAP)`, não mais `N × ROW_HEIGHT`. Para N=10 (4 R1 matches), o bracket passa de ~1140px → ~416px (cards quase encostados). Para N=12 (6 R1 matches), ~624px.
- **Gap entre cards de R1** reduzido para `ROW_GAP=14` (era 24). R2+ funilam automaticamente via midpoint dos inputs.
- **posY[Px]** agora mapeia linearmente em `[0, totalHeight]` pelo índice, mantendo as BYE positions no topo/fundo proporcional.

## [1.32.5] - 2026-05-31

### Changed (Bracket — refinamento do funil)
- **R1 com espaçamento igual; R2+ posicionado no meio entre seus inputs** — agora cada rodada converge para o centro (funil verdadeiro). Resolve o problema onde R3 ficava no mesmo Y de R2 e os conectores se sobrepunham.
- **Conectores mais grossos e escuros**: stroke `1.5px` → `2.5px`, cor `--card-border` → `--t3` (mais legíveis sobre os cards).
- **Fonte do nome do inscrito ainda maior**: `large` `1.15rem` → `1.45rem`; `small` `1rem` → `1.2rem`. Card: width 220→240, height 78→90.

## [1.32.4] - 2026-05-31

### Changed (Bracket de Chaves — funil, fonte, layout)
- **BracketTree** agora posiciona matches por **rodada com espaçamento igual** (funil visual): cada rodada divide a altura total em N slots iguais (em vez de calcular Y pela média dos inputs, que puxava os BYEs para os extremos). Matches ordenados dentro da rodada pela Y "natural" preservam o sentido top→bottom da planilha.
- **3º lugar** posicionado abaixo do bracket, alinhado horizontalmente com a Final.
- **Fonte do participante inscrito** aumentada (`1.15rem` no large, `1rem` no small, peso 600) — só para nomes reais (P refs). Labels "BYE", "Vencedor JX" e "Perdedor JX" mantêm a fonte original.
- **Cards do bracket**: `CARD_WIDTH` 200→220 e `CARD_HEIGHT` 64→78 para acomodar a fonte maior.

### Changed (EventoInscricoes — sticky panels)
- Sidebar de Modalidades (esquerda) e painel principal (direita) agora são **`position: sticky`** com scroll interno (`maxHeight: calc(100vh - 32px)`, `overflowY: auto`). Permite percorrer a lista longa de modalidades sem perder o conteúdo do painel direito.

## [1.32.3] - 2026-05-31

### Fixed (Bracket Chaves — J-IDs canônicos da planilha)
- **Extração da planilha CHAVES CT** reescrita para ler os J-IDs do diagrama visual (cols C-I), não da tabela estruturada (cols Q-V). As duas têm numerações distintas — a do diagrama é a que árbitros/atletas leem na chave impressa.
- Exemplo N=10: R1 agora numera J1, J4, J5, J2 (top→bottom) em vez de J1, J2, J4, J5; R2 (BYEs) J3, J6.
- Seed `bracket_chaves_matches.sql` regenerado para todos os N suportados.
- Sorteios já realizados retêm os J-IDs antigos. Para aplicar a nova numeração: apagar + re-sortear a modalidade.

## [1.32.2] - 2026-05-31

### Changed (Subtítulo condicional por competição)
- **Regra**: o `subtitulo` do participante só aparece em telas vinculadas a evento/competição quando a flag `Competicao.adicionar_subtitulo === true`. Telas globais (ParticipantesList, ParticipanteForm, ParticipanteSelect) seguem mostrando sempre.
- **Componentes de sorteio** (`SorteioOrdem`, `SorteioGrupos`, `SorteioChaves`, `CampeaoSlot`): nova prop `mostrarSubtitulo?: boolean` (default `false`); quando `false` não renderiza o subtítulo (nem dentro de `SlotRender`/`MatchCard` do bracket).
- **EventoInscricoes**: deriva `mostrarSubtitulo` de `evento.competicao.adicionar_subtitulo` e propaga para os 3 SorteioX, CampeaoSlot, e o chip de inscritos (a linha de subtítulo + município agora omite o subtítulo quando flag off).
- **CongressoStepParticipantes / StepSorteio / StepCampeoes**: cada step busca a `Competicao` via service, deriva a flag e condiciona a renderização (lista de inscritos, modal de grupo expandido, lista de campeões, e o que é passado aos componentes de sorteio).
- **ImportInscricoesModal**: ao abrir, busca o evento → competição. Quando flag off: template CSV cai para 3 colunas (`nome,municipio_uf,municipio_nome`), preview mono espelha, e a bullet list omite a linha sobre `subtitulo`. Quando on: mantém 4 colunas.
- **Relatorio.tsx**: o CSV exportado omite a coluna `participante_subtitulo` (header + valor por linha) quando flag off.

## [1.32.1] - 2026-05-31

### Changed (Sorteio Ordem de Entrada)
- **SorteioOrdem**: removidas medalhas 🥇🥈🥉 e badges de campeão anterior. Agora renderiza apenas índices numéricos em destaque (`1. 2. 3. ... N.`) para todos os participantes, alinhado ao conceito de "sequência de apresentação" (não pódio).
- **EventoInscricoes** e **CongressoStepSorteio**: stop de passar `campeoesByParticipanteId` para SorteioOrdem (prop não usada mais).
- **EventoInscricoes**: card "Campeões do ano anterior" agora é **escondido** quando `modalidade.tipo === 'ordem_entrada'` — campeões só fazem sentido para Chaves/Grupos (seeding por colocação).

## [1.32.0] - 2026-05-31

### Added (Usuários, perfis, alterar senha, logout)
- **Backend — módulo `users`** (`backend/src/modules/users/`): endpoints `GET/POST/PATCH/DELETE /users` e `POST /users/:id/resetar-senha`, todos protegidos por `requireAuth + requireRole('ADMIN')`. Service com auto-proteção (não pode remover/desativar/rebaixar a si mesmo) e enforcement de "último ADMIN ativo" (operação recusada se deixar o sistema sem nenhum admin ativo). Validações zod: `nome` 2–80 chars, `email` único, `senha` 8–72 chars, `role` enum (ADMIN/PARTICIPANTE/VIEWER). 18 testes unitários cobrindo todos os caminhos.
- **Backend — `POST /auth/alterar-senha`**: usuário logado troca a própria senha; valida `senha_atual` com bcrypt antes; após sucesso, revoga TODAS as sessões ativas do usuário no Redis (SCAN `refresh:${id}:*` + DEL). Frontend reage com toast + logout automático. 3 testes unitários.
- **Backend — helper `revogarTodosRefreshTokens(userId)`** em `auth.service.ts`: usa `redis.scanIterator` (node-redis v4) para listar e deletar todas as chaves `refresh:${userId}:*`. Usado por `users.resetarSenha` e `auth.alterarSenha`.
- **Frontend — páginas novas**:
  - `/usuarios` (lista): DataTable em card com busca client-side por nome/email, pill de role colorida (ADMIN brand-deep, PARTICIPANTE verde, VIEWER teal/brand-50), badge Ativo/Inativo, último login em mono. Ações Editar/Senha/Remover por linha.
  - `/usuarios/novo` e `/usuarios/:id/editar` (form): 2 cards seccionados (**Identificação** com Users/brand-deep + **Acesso** com ShieldCheck/violet), asterisco vermelho em obrigatórios, senha inicial no create / toggle Ativo + botão "Resetar senha" no edit.
  - `/conta` (Minha conta): card único com avatar grande, role pt-BR, último login formatado, atalho "Trocar senha".
  - `/conta/senha` (Trocar senha): form com senha atual + nova + confirmar; valida match e mínimo 8 chars; após sucesso desloga e redireciona para `/login`.
- **Frontend — `ResetSenhaModal`**: modal de admin para resetar senha de outro usuário (campos nova + confirmar). Avisa que o usuário será deslogado.
- **Frontend — `UserMenuPopover`**: popover ancorado ao card de usuário do rodapé da sidebar. Itens: **Minha conta** (UserCog), **Trocar senha** (Key), divisor, **Sair** (LogOut, vermelho). Fecha com clique fora ou ESC.
- **Frontend — `Sidebar`**: item "Usuários" como primeiro filho de Administração; card de usuário do rodapé virou botão que abre o popover. Label do role pt-BR (Administrador/Participante/Viewer).
- **Frontend — rotas em `App.tsx`**: `/usuarios*` aninhadas sob `<ProtectedRoute roles={['ADMIN']} />`; `/conta` e `/conta/senha` para qualquer usuário logado; nova rota `/sem-acesso` (mensagem amigável).
- **Service `users` + types `User/UserCreatePayload/UserUpdatePayload`** com método `alterarSenha(senha_atual, nova_senha)` que chama `POST /auth/alterar-senha`.
- **Ícones**: `Key`, `LogOut`, `UserCog` adicionados em `lib/icons.ts`.

### Security
- Trocar/resetar senha **revoga todas as sessões ativas** do usuário-alvo (não apenas a current). Reset por admin também zera `tentativas_login` e `bloqueado_ate` (libera conta bloqueada).

## [1.31.0] - 2026-05-31

### Added (Import CSV — modelo + instruções)
- **Novo utilitário `lib/csv-template.ts`**: gera template CSV (UTF-8 com BOM para Excel pt-BR, RFC 4180 com escape de vírgula/aspas/quebra de linha) e dispara o download no browser via Blob. API: `downloadCsvTemplate({ filename, headers, exampleRows })`.
- **MunicipiosImport** redesenhado em 3 cards seccionados:
  - **Passo 1 — Baixar modelo + instruções** (FileSpreadsheet/brand-deep): botão "Baixar modelo CSV" + preview do cabeçalho em mono + bullet list explicando cada coluna (`codigo_ibge`, `nome`, `uf`) com aliases aceitos (`Código Município Completo`, `Nome_Município`, `Nome_UF`) e regra upsert por código IBGE.
  - **Passo 2 — Enviar arquivo** (Upload/amber): file input com nome+tamanho do arquivo selecionado.
  - **Resultado** (Check/teal): grid de Stats (Criados/Atualizados/Ignorados/Erros) + `<details>` expansível listando erros por linha.
- **ImportInscricoesModal** com bloco "Passo 1 — Baixar modelo + instruções": botão Baixar + preview de cabeçalho `nome,subtitulo,municipio_uf,municipio_nome` + bullet list de cada campo (obrigatórios marcados; `subtitulo` opcional) + regra de reaproveitamento de participantes.

## [1.30.2] - 2026-05-31

### Changed (Participantes)
- **ParticipantesList** modernizado:
  - Header eyebrow "Cadastro" + sub explicativo (cadastro global).
  - Card de filtros com **busca client-side por nome/subtítulo/município** (com ícone Search inline). Contador "X de Y" / "total" com Users icon.
  - DataTable em card com shadow; nome em bold, subtítulo dim, Inspetoria em pill brand-50, Delegacia em pill violet, Município com sigla UF em pill mono.
  - Empty/no-result states contextuais.
  - Ordenação alfabética pt-BR.
- **ParticipanteForm** redesenhado:
  - 2 cards seccionados: **Identificação** (Users/brand-deep) com nome + subtítulo (hint explicativo); **Vínculo** (MapPin/violet) com município + grid 2-col Inspetoria/Delegacia.
  - Asterisco vermelho em obrigatórios (Nome, Município).
  - Action bar fim: Cancelar + Salvar/Criar com ícones.
- Header eyebrow "Cadastro" + sub contextual.

## [1.30.1] - 2026-05-31

### Changed (Inspetorias & Delegacias)
- **InspetoriasList** e **DelegaciasList**: DataTable → grid de cards 280px+ ordenados alfabeticamente (pt-BR). Cada card: ícone gradient (ShieldCheck brand-deep para Inspetorias; Building2 violet para Delegacias) + nome + ID monospace + ações Editar/Remover. Card todo clicável. Empty state com ícone.
- **InspetoriaForm** e **DelegaciaForm**: form linear → card seccionado único com ícone gradient + asterisco vermelho obrigatório + action bar Cancelar/Salvar com ícones.
- Headers com eyebrow "Cadastro" + sub explicativo.

## [1.30.0] - 2026-05-31

### Changed (Tipos de Modalidade)
- **TiposModalidadeList**: DataTable → **agrupado por tipo de disputa** (Chaves/Grupos/Ordem/Específico). Cada seção tem header com ícone gradient + nome + descrição do tipo + contagem. Cards 280px+ com ícone gradient 42px + nome do tipo + label da disputa + ações. Card todo clicável (vai pra Editar). Empty state amigável.
- **TipoModalidadeForm**: Form linear → **card seccionado único** (Shapes icon + brand-deep gradient) com:
  - Nome com hint contextual.
  - **Seleção visual do tipo de disputa**: cards verticais clicáveis (em vez de dropdown) com ícone gradient 40px + label + descrição + check visual quando ativo (fundo `--brand-50` + borda `--brand-500`).
- Header com eyebrow "Cadastro" + sub contextual.
- Asterisco vermelho em campos obrigatórios.
- Action bar fim: Cancelar (ghost) + Salvar/Criar (primary) com ícones.

## [1.29.0] - 2026-05-31

### Changed (Municípios)
- **MunicipiosList** modernizado:
  - Header com eyebrow "Cadastro" + sub explicativo; actions "Importar CSV" (ghost) + "+ Novo Município" (primary) com ícones lucide.
  - Card de filtros (UF/Buscar) com label uppercase, ícone Search dentro do input, contador total de municípios à direita com Building2 icon e formatação `toLocaleString('pt-BR')`.
  - DataTable agora dentro de card com shadow; UF como pill (`--brand-50`/`--brand-700`), código IBGE em mono dim, nome em bold.
  - Paginação melhorada no rodapé do card: "X–Y de N" formato + botões ghost com ↑↓ + indicador `página / total` em mono.
- **MunicipioForm** redesenhado:
  - Card seccionado único (Building2 icon brand-deep gradient) "Dados do município".
  - Grid responsivo `1fr / 120px` (Nome largo + UF compacto).
  - Código IBGE com font-mono, máscara só dígitos, inputMode numeric, hint contextual.
  - Asterisco vermelho em campos obrigatórios.
  - Validação manual no submit (formato IBGE + nome obrigatório).
  - Action bar fim: Cancelar (ghost) + "Salvar alterações"/"Criar município" (primary) com ícones.
- Header com eyebrow "Cadastro" + sub contextual.

### Added
- Ícone `Download` exportado em `lib/icons.ts`.

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
