# Perfil de usuário "Comissão Técnica" — Design

**Data:** 2026-06-12
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Criar um novo perfil **Comissão Técnica** que, **somente nos eventos atribuídos a ele**, pode fazer a manutenção operacional (inscritos, campeões do ano anterior, sorteios/Modo Congresso e relatórios). Esse perfil **não** acessa Administração, Competições nem Participantes.

## Decisões (do brainstorming)

- Vínculo evento↔usuário é **muitos-para-muitos**, atribuído **no formulário do EVENTO** (admin escolhe os membros da comissão técnica do evento).
- A Comissão Técnica **não tem Painel**. Menu dela: **Eventos** (só os seus), **Relatórios**, **Modo Congresso**.
- Dentro do evento, o CT opera inscritos/campeões/sorteio/relatório, mas **não** edita o evento, nem mexe em "Modalidades do evento" nem publica o site.

## Modelo de dados

1. `Role` enum ganha `COMISSAO_TECNICA`:
```prisma
enum Role {
  ADMIN
  PARTICIPANTE
  VIEWER
  COMISSAO_TECNICA
}
```

2. Vínculo M2M Evento↔User via tabela explícita:
```prisma
model EventoComissao {
  id         Int     @id @default(autoincrement())
  evento     Evento  @relation(fields: [evento_id], references: [id], onDelete: Cascade)
  evento_id  Int
  usuario    User    @relation(fields: [usuario_id], references: [id], onDelete: Cascade)
  usuario_id Int

  @@unique([evento_id, usuario_id])
  @@index([usuario_id])
  @@map("evento_comissao")
}
```
Back-relations: `comissao EventoComissao[]` em `Evento`; `eventos_comissao EventoComissao[]` em `User`.

Migrations manuais: (a) `ALTER TYPE "Role" ADD VALUE 'COMISSAO_TECNICA';` (b) criar a tabela `evento_comissao` com índices/FKs. Requer Cloud SQL prod ligado no deploy-main.

## Backend — autorização por evento

Novo helper + middleware em `backend/src/middleware/evento-acesso.ts`:

- `usuarioTemAcessoAoEvento(user, evento_id): Promise<boolean>` — `true` se `user.role === 'ADMIN'`; se `user.role === 'COMISSAO_TECNICA'`, consulta `EventoComissao` por `(evento_id, usuario_id = user.sub)`; caso contrário `false`.
- `requireAcessoEvento(resolver: (req) => number | null | Promise<number | null>)` — middleware que resolve o `evento_id` da requisição (via `resolver`) e chama `usuarioTemAcessoAoEvento`; 403 se negar; 400 se o `evento_id` não puder ser resolvido. Usa `(req as any).user` (já populado por `requireAuth`).

Aplicação (trocar `requireRole('ADMIN')` por `[requireAuth, requireAcessoEvento(resolver)]` nas rotas operacionais; o resolver indica de onde vem o `evento_id`):

- **inscricoes** (`inscricoes.routes.ts`):
  - `POST /` (body.evento_id), `POST /bulk` (body.evento_id), `POST /import` (body.evento_id).
  - `DELETE /:id` → resolver busca `inscricao.evento_id` por `req.params.id`.
  - `DELETE /evento/:eventoId/modalidade/:modalidadeId` (params.eventoId).
  - (`GET` continuam `requireAuth`.)
- **campeoes_anteriores** (`campeoes_anteriores.routes.ts`):
  - `POST /` (body.evento_id), `POST /import` (body.evento_id), `DELETE /:id` → busca `campeaoAnterior.evento_id`.
- **sorteios** (`sorteios.routes.ts`):
  - `POST /executar` (body.evento_id), `DELETE /:id` → busca `sorteio.evento_id`, `DELETE /evento/:evento_id` (params).
- **relatorios** (`relatorios.routes.ts`):
  - `GET /eventos/:eventoId/congresso` (params.eventoId).

Continuam **ADMIN-only** (sem mudança): `POST/PUT/DELETE /eventos`, logo/publicar/despublicar, `evento_keys`, modalidades, competicoes, participantes (CRUD), users, sistemas-disputa, tipos-modalidade, municipios, inspetorias, delegacias, `PATCH /modalidades/:id/ativa`, `PUT /eventos/:id/modalidades-excluidas`, `PUT /eventos/:id/anfitriao-ordem`.

Leitura: `GET /participantes`, `GET /modalidades` (via `GET /eventos/:id/modalidades`), `GET /eventos/:id/modalidades-excluidas`, etc., permanecem `requireAuth` (CT lê o necessário para operar; só não tem o menu/CRUD).

### Escopo da listagem de eventos

- `GET /eventos` (`eventos.service.listar` + controller): passar `req.user`. Quando `role === 'COMISSAO_TECNICA'`, filtrar `where: { comissao: { some: { usuario_id: user.sub } } }` (além do filtro de competição existente). ADMIN/outros: sem filtro.
- `GET /eventos/:id` (`buscarPorId`): se `role === 'COMISSAO_TECNICA'` e não atribuído → 403/404.

### Criação/edição do evento com a comissão

- `eventos.service.criar`/`editar` e o controller aceitam um campo opcional `comissao_ids: number[]` (ids de usuários). No create/edit, sincroniza a tabela `EventoComissao` (apaga e recria o conjunto). Validar que os ids são usuários com role `COMISSAO_TECNICA` (senão 400).
- `GET /eventos/:id` (e `LIST_INCLUDE`/`INCLUDE`) inclui `comissao` (com `usuario: { id, nome }`) para o form e a exibição.

## Frontend

- **Tipos:** `Role` (frontend) ganha `'COMISSAO_TECNICA'`. `Evento` ganha `comissao?: { usuario: { id: number; nome: string } }[]`.
- **Sidebar** (`Sidebar.tsx`): filtrar o `NAV` por `user.role`. Adicionar ao `NAV` um item **"Modo Congresso"** (`path: '/congresso'`). Para `COMISSAO_TECNICA`, mostrar apenas: **Eventos**, **Relatórios** (Visão geral + Congresso técnico) e **Modo Congresso**. Ocultar Painel, Competições, Participantes, Administração. (Para ADMIN/demais, o item "Modo Congresso" também passa a aparecer; o resto do menu não muda.)
- **Rotas** (`App.tsx` + `ProtectedRoute`): adicionar `roles` barrando `COMISSAO_TECNICA` em `/competicoes`, `/participantes` e nas rotas de Administração (`/usuarios`, `/municipios`, `/inspetorias`, `/delegacias`, `/tipos-modalidade`, `/modalidades`, `/sistemas-disputa`) e `/painel`. CT que tentar acessar é redirecionado para `/eventos`.
- **Modo Congresso:** o `/congresso` continua acessível ao CT. Garantir um ponto de entrada no menu/Eventos para CT (item "Modo Congresso" no NAV visível ao CT, ou botão na lista de eventos). A lista de eventos do Modo Congresso (`CongressoStepEvento`) já usa `GET /eventos` (agora filtrado para CT).
- **EventoForm** (admin): novo campo "Comissão Técnica" — multi-seleção de usuários com role `COMISSAO_TECNICA` (busca via `GET /users` filtrando role no client; ou um endpoint dedicado). Envia `comissao_ids` no create/edit. Carrega os atuais de `evento.comissao`.
- **EventoInscricoes**: para `role === 'COMISSAO_TECNICA'`, **ocultar** os botões/seções de admin: "Editar evento", "Modalidades do evento", e a publicação de site (se houver). As ações operacionais (Inscrever, Importar, Remover, Sortear/Re-sortear, Apagar sorteios, campeões) **permanecem** (o backend autoriza por evento).
- **Usuários** (`UsuarioForm`, `UsuariosList`): adicionar a opção/pill `COMISSAO_TECNICA` ("Comissão Técnica — operação de eventos atribuídos").

## Tratamento de erros

- CT em ação fora dos seus eventos → 403 (toast).
- `comissao_ids` com id que não é usuário CT → 400.
- CT acessando rota proibida no front → redirect para `/eventos`.

## Testes

- **Backend (Vitest, mock prisma):**
  - `usuarioTemAcessoAoEvento`: ADMIN sempre true; CT atribuído true; CT não atribuído false; outro role false.
  - `requireAcessoEvento`: 403 quando nega, segue quando permite, 400 sem evento_id.
  - `eventos.service.listar`: filtra por comissão quando role CT.
  - sincronização de `comissao_ids` em criar/editar (apaga+recria; valida role dos ids).
- **Frontend:** `npm run build` + teste manual (login como CT: vê só seus eventos, menus reduzidos, opera inscritos/sorteio/relatório; é barrado em competições/participantes/admin; admin atribui comissão no form do evento).

## Fora de escopo (vai em spec separada)

- Trocar o e-mail pelo nome do usuário na sidebar.
- Separar, na lista de eventos, os de status "Sorteado" dos demais.

## Fora de escopo (geral)

- CT cadastrar participantes/municípios.
- CT editar dados do evento, modalidades, competição.
- Permissões mais granulares por ação (ex.: CT só inscritos mas não sorteio) — o perfil é um pacote único.
