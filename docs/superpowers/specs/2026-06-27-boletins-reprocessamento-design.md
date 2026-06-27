# Boletins — classificação por data+hora e reprocessamento (substituir) — Design

**Data:** 2026-06-27
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Permitir que o "Último boletim" (e a ordem das listas) seja classificado por **data+hora real de publicação/processamento**, não só pela data editorial. Como boletins do mesmo dia hoje empatam (admin escolhe só a data → meia-noite UTC), o destaque não reflete o mais recente. Além disso, um boletim pode ser **reprocessado (substituído)**: ao trocar o PDF/dados, ele deve voltar a ser o "último".

Decisões (brainstorming):
- **Carimbo do sistema** ordena: novo campo `atualizado_em` (`@updatedAt`) no `Boletim`. Criação e substituição carimbam o momento.
- Admin continua escolhendo só a **data** (editorial, `data_publicacao`); as telas exibem só a data.
- **Reprocessar = substituir o mesmo boletim** (mesmo número): novo fluxo `PUT`. PDF **opcional** (pode só corrigir título/categoria/data).
- Ordenação (público e admin) por `atualizado_em` **desc**, desempate por `numero` desc.

## Contexto (codebase)

- Model `Boletim` (`backend/prisma/schema.prisma`): `id, evento_id, numero, titulo, categoria(CategoriaBoletim), data_publicacao, filename, object_key(unique), public_url, size_bytes, content_type, criado_em`. `@@unique([evento_id, numero])`. **Não tem** `atualizado_em`.
- Módulo `backend/src/modules/boletins/{boletins.routes.ts, .controller.ts, .service.ts}`: rotas ADMIN `GET/POST /eventos/:eventoId/boletins`, `DELETE /eventos/:eventoId/boletins/:boletimId`. Storage via `getStorage()` (`backend/src/lib/storage`). Re-publica via `publicar(eventoId)` quando `site_publicado_em != null`.
- Snapshot: `boletins[]` = `{numero,titulo,categoria,data,url,tamanho}` (backend+frontend `snapshot-types.ts`, `montaSnapshot` em `snapshot.ts`, select em `site-publico.service.ts`).
- Frontend: `frontend/src/services/boletins.ts` (`listar/enviar/remover`); admin `frontend/src/pages/eventos/EventoBoletins.tsx` (painel + modal `PublicarModal`, kebab com Remover); público `frontend/src/site-publico/pages/EventoPage.tsx` (destaque + grupos); mapa `frontend/src/lib/boletim-categorias.ts`.
- Ordenação atual (já no ar): público ordena por `data` desc com desempate `numero` desc; admin por `numero` desc.

## Mudanças

### 1. Modelo — `atualizado_em`
`backend/prisma/schema.prisma`, no model `Boletim`, adicionar:
```prisma
  atualizado_em   DateTime         @updatedAt
```
Migration Prisma (dev: poucos boletins, `@updatedAt` preenche com now() nos existentes; prod: feature ainda não deployada). Abortar se Prisma propor reset destrutivo.

### 2. Backend — endpoint de substituição
- `boletins.service.ts`: `substituirBoletim(eventoId, boletimId, { titulo?, categoria?, data_publicacao?, file? })`:
  - `findFirst({ id: boletimId, evento_id: eventoId })`; 404 se não existe.
  - Se `file`: `objectKey` novo (`eventos/{eventoId}/boletim-{numero}-{uuid}.pdf`), `getStorage().put(...)`; depois `getStorage().remove(object_key_antigo)`; atualiza `filename/object_key/public_url/size_bytes`.
  - Atualiza `titulo/categoria/data_publicacao` quando enviados (número não muda).
  - `prisma.boletim.update(...)` (o `@updatedAt` carimba `atualizado_em`).
  - Re-publica snapshot se o evento estiver publicado (mesma regra de criar/remover).
  - Em falha de update após subir arquivo novo, fazer rollback do arquivo novo (best-effort), igual ao create.
- `boletins.controller.ts`: handler `substituir` com zod **parcial** (`numero` NÃO aceito/ignorado; `titulo?` min(1), `categoria?` enum, `data_publicacao?` coerce date); `file` opcional (multer). Pelo menos um campo OU arquivo deve vir (senão 400 "Nada para atualizar").
- `boletins.routes.ts`: `router.put('/eventos/:eventoId/boletins/:boletimId', ...admin, uploadPdf.single('file'), ctrl.substituir)`.

### 3. Snapshot — `atualizadoEm`
- Adicionar `atualizadoEm: string` ao `boletins[]` de `SnapEvento` (backend + frontend `snapshot-types.ts`).
- `montaSnapshot`: `EventoRow.boletins` ganha `atualizado_em: Date`; mapear `atualizadoEm: b.atualizado_em.toISOString()`.
- `publicar()` select de `boletins`: adicionar `atualizado_em: true`.

### 4. Site público — classificação
`EventoPage.tsx`: a ordenação dos boletins passa a:
```ts
const ordenados = [...boletins].sort((a, b) =>
  (+new Date(b.atualizadoEm) - +new Date(a.atualizadoEm)) || (b.numero - a.numero))
```
`destaque = ordenados[0]`; grupos por tipo iteram preservando essa ordem. Exibição inalterada (mostra `data` via `dataPtBr`). (Substitui a ordenação atual por `data`.)

### 5. Admin
- `frontend/src/services/boletins.ts`: `substituir(eventoId, boletimId, { titulo?, categoria?, data_publicacao?, file? })` → `PUT` multipart.
- `EventoBoletins.tsx`:
  - A lista do painel ordena por `atualizado_em` desc (desempate `numero` desc) — o boletim recém-publicado/reprocessado fica no topo. (Requer `atualizado_em` no tipo `Boletim` do service e no retorno da API — já vem por estar no model.)
  - Kebab ganha ação **"Substituir"** (além de "Remover"): abre o modal em modo substituir — número exibido travado (read-only), título/categoria/data pré-preenchidos com o boletim atual, dropzone **opcional** (texto "Trocar PDF (opcional)"). Ao confirmar → `boletinsService.substituir(...)` → toast "Boletim atualizado" → recarrega.
  - O modal `PublicarModal` é generalizado para os dois modos (publicar / substituir) ou um componente irmão reutilizando os campos; em modo substituir, Publicar vira "Salvar" e o PDF é opcional.

## Testes / Verificação
- Backend (Vitest): `substituirBoletim` — substitui com PDF (put novo + remove antigo + update), substitui só campos (sem arquivo), 404 se inexistente, re-publica só se publicado. `snapshot.test` asserir `atualizadoEm`.
- `tsc --noEmit` backend; `npm run build` + `npm run build:site` frontend; ajustar `EventoPage-boletins.test.tsx` para o novo campo `atualizadoEm` no fixture e para o destaque por timestamp.
- Manual: publicar boletim A e B (mesma data) → B (mais novo) é o "último". Substituir A (trocar PDF) → A vira o "último". Download abre o PDF novo.
- Demo (screenshots) antes do merge na develop; promoção a prod só com OK do Wagner.

## Fora de escopo
- Mostrar a hora nas telas (só ordena).
- Status Publicado/Rascunho, contagem de páginas, auditoria real.
- Mudar o número no reprocessamento (número é fixo).
- Histórico de versões do boletim (substituir sobrescreve).

## Restrições globais
- Host Windows; ler antes de editar; caminhos absolutos. Git identity inline (Wagner Marrane <wmarrane@gmail.com>).
- Validar com `npm run build`/`build:site`; backend `vitest` + `tsc --noEmit`. Reusar design system; sem cores novas.
