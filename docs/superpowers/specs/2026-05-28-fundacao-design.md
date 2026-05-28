# Sub-projeto 1: Fundação — Delegações, Modalidades e Categorias

**Data:** 2026-05-28
**Status:** Aprovado

---

## Visão Geral

Cadastro administrativo das entidades de base do sistema: Delegações (times participantes), Modalidades esportivas e Categorias (combinação de modalidade + gênero + faixa etária). Todos os sub-projetos futuros dependem destes cadastros.

**Constraint:** Somente usuários com role `ADMIN` podem criar, editar e remover registros.

---

## Modelos de Dados

```prisma
model Delegacao {
  id            Int      @id @default(autoincrement())
  nome          String
  municipio     String
  estado        String   @db.Char(2)
  logo_path     String?
  criado_em     DateTime @default(now())
  atualizado_em DateTime @updatedAt
}

model Modalidade {
  id            Int         @id @default(autoincrement())
  nome          String      @unique
  descricao     String?
  categorias    Categoria[]
  criado_em     DateTime    @default(now())
  atualizado_em DateTime    @updatedAt
}

enum Genero {
  MASCULINO
  FEMININO
  MISTO
  LIVRE
}

model Categoria {
  id            Int        @id @default(autoincrement())
  modalidade    Modalidade @relation(fields: [modalidade_id], references: [id])
  modalidade_id Int
  nome          String
  genero        Genero
  idade_min     Int?
  idade_max     Int?
  criado_em     DateTime   @default(now())
  atualizado_em DateTime   @updatedAt

  @@unique([modalidade_id, nome, genero])
}
```

---

## API REST

Todos os endpoints exigem autenticação (`Authorization: Bearer <token>`) e role `ADMIN`, exceto `GET /uploads/:filename`.

### Delegações

| Método | Rota | Body | Descrição |
|--------|------|------|-----------|
| GET | `/delegacoes` | — | Lista todas |
| GET | `/delegacoes/:id` | — | Detalhe |
| POST | `/delegacoes` | `multipart/form-data` | Cria (logo opcional) |
| PUT | `/delegacoes/:id` | `multipart/form-data` | Edita (nova logo substitui a anterior) |
| DELETE | `/delegacoes/:id` | — | Remove (apaga arquivo de logo) |

### Modalidades

| Método | Rota | Body | Descrição |
|--------|------|------|-----------|
| GET | `/modalidades` | — | Lista todas (inclui count de categorias) |
| GET | `/modalidades/:id` | — | Detalhe com categorias |
| POST | `/modalidades` | `{ nome, descricao? }` | Cria |
| PUT | `/modalidades/:id` | `{ nome?, descricao? }` | Edita |
| DELETE | `/modalidades/:id` | — | Remove (bloqueia se tiver categorias vinculadas) |

### Categorias

| Método | Rota | Body | Descrição |
|--------|------|------|-----------|
| GET | `/categorias` | `?modalidade_id=` | Lista (filtrável por modalidade) |
| GET | `/categorias/:id` | — | Detalhe |
| POST | `/categorias` | `{ modalidade_id, nome, genero, idade_min?, idade_max? }` | Cria |
| PUT | `/categorias/:id` | campos opcionais | Edita |
| DELETE | `/categorias/:id` | — | Remove |

### Arquivos

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/uploads/delegacoes/:filename` | Serve imagem de logo (público, sem auth) |

---

## Armazenamento de Logos

- **Biblioteca:** multer com `diskStorage`
- **Destino:** `/app/uploads/delegacoes/` dentro do container
- **Nome do arquivo:** `<uuid>.<ext>` gerado no upload
- **Banco:** `logo_path` armazena apenas o nome do arquivo (ex: `a1b2c3.jpg`)
- **URL pública:** `http://<host>:3000/uploads/delegacoes/<filename>`
- **Limites:** 2 MB máximo; tipos aceitos: `image/jpeg`, `image/png`, `image/webp`
- **Substituição:** ao editar com nova logo, o arquivo anterior é deletado do disco com `fs.unlink`

### Docker — volume persistente

```yaml
# docker-compose.yml
services:
  backend:
    volumes:
      - uploads_data:/app/uploads

volumes:
  uploads_data:
  redis_data:
```

---

## Estrutura de Arquivos — Backend

```
backend/src/
  lib/
    upload.ts                  # config multer (storage, limites, filtro de tipo)
  modules/
    delegacoes/
      delegacoes.routes.ts
      delegacoes.controller.ts
      delegacoes.service.ts
    modalidades/
      modalidades.routes.ts
      modalidades.controller.ts
      modalidades.service.ts
    categorias/
      categorias.routes.ts
      categorias.controller.ts
      categorias.service.ts
```

**Padrão de responsabilidade:**
- `routes`: declara endpoints, aplica middlewares (auth, upload, validação Zod)
- `controller`: extrai params/body, chama service, devolve resposta HTTP
- `service`: lógica de negócio, queries Prisma, operações de arquivo

---

## Estrutura de Arquivos — Frontend

```
frontend/src/
  components/
    Layout.tsx           # sidebar agrupada + <Outlet />
    PageHeader.tsx       # título da página + botão de ação primária
    DataTable.tsx        # tabela reutilizável (colunas configuráveis)
  pages/
    delegacoes/
      DelegacoesList.tsx   # tabela: nome, município/estado, logo, ações
      DelegacaoForm.tsx    # form: nome, município, estado, upload de logo
    modalidades/
      ModalidadesList.tsx  # tabela: nome, descrição, nº categorias
      ModalidadeForm.tsx   # form: nome, descrição
    categorias/
      CategoriasList.tsx   # tabela: modalidade, nome, gênero, faixa etária
      CategoriaForm.tsx    # form: select modalidade, nome, gênero, idades opcionais
  services/
    delegacoes.ts          # axios: CRUD + upload multipart
    modalidades.ts
    categorias.ts
```

---

## Navegação — Sidebar com Grupos

```
Cadastros
  ├─ Delegações      → /delegacoes
  ├─ Modalidades     → /modalidades
  └─ Categorias      → /categorias

Competições
  ├─ Edições         → (sub-projeto 2)
  └─ Competições     → (sub-projeto 2)

Configurações
  └─ Usuários        → (futuro)
```

---

## Padrão de CRUD — Página Própria

Cada entidade segue o mesmo padrão de rotas:

```
/delegacoes              # lista com tabela + botão "Nova Delegação"
/delegacoes/nova         # formulário de criação
/delegacoes/:id/editar   # formulário de edição pré-preenchido
```

O formulário tem botão `← Voltar` que retorna à lista sem salvar.

---

## Validações

### Delegação
- `nome`: obrigatório, string não vazia
- `municipio`: obrigatório
- `estado`: obrigatório, exatamente 2 caracteres (UF)
- `logo`: opcional; se enviado, valida tipo e tamanho

### Modalidade
- `nome`: obrigatório, único no banco
- Não pode ser deletada se tiver categorias vinculadas (retorna 409)

### Categoria
- `modalidade_id`: obrigatório, deve existir
- `nome`: obrigatório
- `genero`: obrigatório, enum `MASCULINO | FEMININO | MISTO | LIVRE`
- `idade_min` / `idade_max`: opcionais; se ambos presentes, `idade_min < idade_max`
- Combinação `(modalidade_id, nome, genero)` deve ser única (constraint no banco)

---

## Gerenciamento de Estado — Frontend

- **React Query** (`@tanstack/react-query`): fetch, cache, invalidação após mutações
- **Zustand**: apenas auth (já existente, sem alterações)
- Após criar/editar/deletar: `queryClient.invalidateQueries` para atualizar a lista automaticamente

---

## Decisões de Design

- **`logo_path` nullable:** delegação pode ser criada sem logo e o logo adicionado depois
- **`estado` como `Char(2)`:** UF brasileira sempre tem 2 caracteres; simplifica validação
- **`@@unique([modalidade_id, nome, genero])` em Categoria:** evita duplicatas do tipo "Futebol Masculino Sub-17" em duas competições diferentes da mesma modalidade
- **Modalidade bloqueia deleção com categorias:** evita orphans; admin deve remover categorias primeiro
- **UUID no nome do arquivo de logo:** evita colisões e não expõe IDs sequenciais
- **Volume Docker `uploads_data`:** garante persistência dos logos entre rebuilds e restarts do container
