# Boletins em PDF por evento + datas início/fim — Design

**Data:** 2026-06-27
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Permitir publicar **boletins em PDF** ao longo da execução de um evento e exibi-los para download na **página pública do evento** (site estático), além de registrar **início e fim** do evento. Foco de acesso é **mobile**. Cada boletim tem uma **categoria** (lista fixa) exibida e filtrável.

Armazenamento em **dev** numa VM dedicada (192.168.56.130) via SFTP+nginx; em **produção** via GCS (provider no código, provisionamento adiado). A página pública continua **100% estática**: o snapshot é re-publicado quando um boletim muda.

## Decisões (do brainstorming)

- **Publicação:** re-publicar snapshot a cada mudança de boletim, **somente se o evento já estiver publicado** (`site_publicado_em` setado). Reusa o fluxo `publicar(eventoId)` existente. Downloads não dependem do backend.
- **Datas:** adicionar `data_inicio` e `data_fim` (opcionais) ao `Evento`, mantendo `data_hora`.
- **Storage dev:** backend envia o PDF por SFTP (chave) para a VM; nginx serve `/srv/boletins` em `http://192.168.56.130/boletins/`. URL de download = `PUBLIC_BOLETINS_BASE_URL/<object_key>`.
- **Storage prod:** `GcsStorage` no código (pronto), **sem** provisionar bucket/IAM/secrets agora.
- **Acesso à VM:** Ubuntu novo com senha → gerar par de chaves, `ssh-copy-id`, instalar nginx + diretório. Chave **privada em `secrets/` fora do git**, montada no container do backend.
- **Boletim:** `numero` (Int), `titulo`, `data_publicacao`, `categoria` (enum) + metadados do arquivo. `@@unique([evento_id, numero])`.
- **Categorias (enum fixo):** `Resultados`, `Comunicado`, `Tabela`, `Regulamento`, `Outros`.
- **Permissão:** apenas `ADMIN` publica/remove boletins.
- **Demo:** implementar em branch/worktree isolada, rodar local, entregar **screenshots** do fluxo; após OK, merge na `develop`.
- **Entrega:** dev completo (VM/SFTP) + abstração + provider GCS no código. Sem git release tag (correção: "tageado" = categoria do boletim, não tag git).

## Arquitetura

```
Admin (React) --multipart--> Backend /eventos/:id/boletins
                                  |--> StorageProvider.put() --SFTP--> VM 192.168.56.130 (nginx /srv/boletins)
                                  |--> Prisma: Boletim
                                  |--> se publicado: publicar(eventoId) -> snapshot (com boletins) -> repository_dispatch 'publicar-site'
Site público estático (evento-N.html) lê boletins do snapshot; download direto da URL da VM/GCS; filtro por categoria em JS client-side.
```

## 1. Banco de dados (Prisma) — `backend/prisma/schema.prisma`

- `Evento`: adicionar
  ```prisma
  data_inicio DateTime?
  data_fim    DateTime?
  boletins    Boletim[]
  ```
- Enum:
  ```prisma
  enum CategoriaBoletim {
    Resultados
    Comunicado
    Tabela
    Regulamento
    Outros
  }
  ```
- Novo model:
  ```prisma
  model Boletim {
    id              Int              @id @default(autoincrement())
    evento          Evento           @relation(fields: [evento_id], references: [id], onDelete: Cascade)
    evento_id       Int
    numero          Int
    titulo          String
    categoria       CategoriaBoletim
    data_publicacao DateTime
    filename        String
    object_key      String           @unique
    public_url      String
    size_bytes      Int
    content_type    String           @default("application/pdf")
    criado_em       DateTime         @default(now())

    @@unique([evento_id, numero])
    @@index([evento_id])
  }
  ```
- Migration local: `npx prisma migrate dev --name add_boletim_e_datas_evento`. Prod: `migrate deploy` (adiado).

## 2. Abstração de storage — `backend/src/lib/storage/`

- `index.ts`: interface + factory por env.
  ```ts
  export interface StorageProvider {
    put(objectKey: string, buffer: Buffer, contentType: string): Promise<string> // retorna public_url
    remove(objectKey: string): Promise<void>
  }
  export function getStorage(): StorageProvider // STORAGE_PROVIDER=sftp|gcs
  ```
- `sftp.ts` (`SftpStorage`): usa `ssh2-sftp-client`. Conecta com `SFTP_HOST/PORT/USER` + chave `SFTP_PRIVATE_KEY_PATH`; garante diretório `SFTP_BASE_DIR/eventos/{id}`; faz `put` do buffer; retorna `${PUBLIC_BOLETINS_BASE_URL}/${objectKey}`. `remove` apaga o arquivo (ignora ausência).
- `gcs.ts` (`GcsStorage`): `@google-cloud/storage` (ADC), bucket `GCS_DOCS_BUCKET`, `file.save` com `cacheControl`; retorna `${PUBLIC_DOCS_BASE_URL}/${objectKey}`. **Não** provisiona nada.
- `object_key` = `eventos/{eventoId}/boletim-{numero}-{uuid}.pdf`. Sanitização de nome reaproveitando padrão existente.

## 3. Backend — módulo `boletins`

Arquivos: `backend/src/modules/boletins/{boletins.routes.ts, boletins.controller.ts, boletins.service.ts, boletins.test.ts}`. Registrar router em `backend/src/index.ts`. Todas as rotas: `requireAuth` + `requireRole('ADMIN')`. Upload via `multer` em memória (novo helper ou ampliação de `backend/src/lib/upload.ts`), `fileFilter` só `application/pdf`, `limits.fileSize = MAX_PDF_BYTES` (default 26214400 = 25MB).

- `POST /eventos/:eventoId/boletins` — body multipart: `file`, `numero`, `titulo`, `categoria`, `data_publicacao`. Valida (Zod: numero int>0, titulo não vazio, categoria ∈ enum, data válida). `storage.put` → cria `Boletim`. Se `evento.site_publicado_em != null`, chama `publicar(eventoId)`. Responde 201 com o boletim. Conflito de `numero` → 409.
- `GET /eventos/:eventoId/boletins` — lista p/ gestão (ordenada por `numero` asc).
- `DELETE /eventos/:eventoId/boletins/:boletimId` — `storage.remove(object_key)` + apaga row. Se publicado, `publicar(eventoId)`. 204.

## 4. Snapshot do site público

- `backend/src/modules/site-publico/snapshot.ts` + `snapshot-types.ts` (backend) e `frontend/src/site-publico/snapshot-types.ts`: adicionar ao `SnapEvento`:
  ```ts
  dataInicio?: string | null
  dataFim?: string | null
  boletins: { numero: number; titulo: string; categoria: string; data: string; url: string }[]
  ```
- `montaSnapshot` busca `boletins` do evento (ordenados por `numero`) e popula. Datas convertidas para ISO.

## 5. Admin (frontend)

- `frontend/src/pages/eventos/EventoForm.tsx`: campos **Início** e **Fim** (inputs date), salvos junto do evento (controller/service de eventos atualizados para aceitar `data_inicio`/`data_fim`).
- Nova seção/componente **`EventoBoletins.tsx`** na tela do evento: formulário (número, título, categoria [select fixo], data, arquivo PDF) + lista com botão remover. Reusa o padrão `eventosService.uploadLogo` (FormData). Métodos novos em `frontend/src/services/boletins.ts`: `listar(eventoId)`, `enviar(eventoId, payload)`, `remover(eventoId, boletimId)`.

## 6. Página pública do evento (mobile-first) — `frontend/src/site-publico/pages/EventoPage.tsx`

- Header: exibir **período** `início–fim` (quando houver) além da data atual.
- Seção **"Boletins"** (some se vazio): chips de **filtro por categoria** + lista de downloads. Cada item: número, título, categoria (badge), data, link `<a href={url} target="_blank" rel="noopener">` com ícone de download. Ordenada por `numero` desc (mais recente primeiro). Estilo mobile-first (linhas full-width, alvos de toque grandes) em `site.css`.
- **Filtro client-side:** como a página é SSG, incluir um `<script>` mínimo (ou data-attributes + JS no html-shell) que filtra os itens por `data-categoria` ao clicar nos chips. Sem dependência de backend.

## 7. Infra de dev (VM 192.168.56.130)

- Gerar par de chaves SSH (ed25519). Instalar a pública via `ssh-copy-id` (usuário/senha fornecidos pelo Wagner). Instalar **nginx**, criar `/srv/boletins` (dono = usuário SFTP) e server block servindo em `http://192.168.56.130/boletins/`.
- `docker-compose.yml` (dev): montar `./secrets/boletins_ssh_key` (read-only) no container do backend; adicionar envs.
- `backend/.env.example`: `STORAGE_PROVIDER=sftp`, `SFTP_HOST=192.168.56.130`, `SFTP_PORT=22`, `SFTP_USER=...`, `SFTP_PRIVATE_KEY_PATH=/app/secrets/boletins_ssh_key`, `SFTP_BASE_DIR=/srv/boletins`, `PUBLIC_BOLETINS_BASE_URL=http://192.168.56.130/boletins`, `MAX_PDF_BYTES=26214400`. (Prod, adiado: `STORAGE_PROVIDER=gcs`, `GCS_DOCS_BUCKET`, `PUBLIC_DOCS_BASE_URL`.)
- `secrets/` adicionado ao `.gitignore` (se ainda não estiver).

## 8. Dependências (backend)

```
npm i ssh2-sftp-client @google-cloud/storage
npm i -D @types/ssh2-sftp-client
```
(`multer` já existe no projeto.)

## Testes / Verificação

- **Backend (Vitest):** `boletins.service` com storage e prisma mockados (criar/listar/remover, re-publica só se publicado); validação de upload (rejeita não-PDF e acima do limite); `snapshot` inclui `boletins`, `dataInicio`, `dataFim`.
- **Frontend:** `npm run build` (`tsc -b && vite build`) sem erros. Render da seção de boletins no `EventoPage` (com e sem boletins) e do filtro.
- **Manual/Demo:** admin → cadastrar início/fim → subir boletim (número, título, categoria, PDF) → arquivo no `/srv/boletins` da VM e linha no Postgres → página do evento (mobile) lista o boletim com badge de categoria, filtro funciona e download abre o PDF da URL da VM. **Screenshots** entregues antes do merge na develop.
- Sem provisionamento de prod nesta rodada.

## Fora de escopo

- Provisionamento do GCS de produção (bucket/IAM/secrets/deploy) — feature futura.
- Edição de boletim (só criar/remover por ora).
- Versão/idioma do filtro além de categorias.
- Git release tag.

## Restrições globais

- Host Windows; ler arquivos antes de editar; caminhos absolutos.
- Git identity inline (`-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`).
- Validar frontend com `npm run build` (CI usa `tsc -b && vite build`).
- Promoção `develop → main` só com confirmação do Wagner; demo antes da develop.
