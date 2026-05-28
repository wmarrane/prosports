# Spec: Entidade `Municipios`

Data: 2026-05-28
Status: aprovado para implementação

## Objetivo

Criar a entidade `Municipios` para registrar todos os municípios do Brasil (≈5.570) a partir do arquivo IBGE `RELATORIO_DTB_BRASIL_2024_MUNICIPIOS.xls` e usá-la como tabela de referência em `Delegacao` (substituindo os campos texto `municipio` e `estado`).

## Escopo

- Modelo `Municipio` no Prisma com campos essenciais (código IBGE, nome, UF).
- Migração de `Delegacao` para usar FK `municipio_id` (drop dos campos `municipio` e `estado`).
- Backend: módulo `municipios` com CRUD + endpoint de import via CSV.
- Frontend: páginas de listagem/CRUD/import + componente reutilizável `MunicipioSelect`.
- Atualização do formulário de `Delegacao` para usar o seletor.

Fora de escopo: importar mesorregião, microrregião, região geográfica imediata/intermediária ou qualquer outro campo do DTB além de código IBGE, nome e UF.

## Decisões de design

| # | Decisão | Justificativa |
|---|---|---|
| 1 | CRUD admin + carga inicial via import | Permite ajustes manuais sem depender de re-import |
| 2 | Campos: `codigo_ibge` (7 dígitos), `nome`, `uf` (sigla 2 letras) | Suficiente para dropdowns e identificação; sem dados não usados |
| 3 | Migrar `Delegacao` agora para FK | Não há dados em produção; evita débito técnico |
| 4 | Import via endpoint admin (upload CSV) | Permite recarga futura sem deploy |
| 5 | Aceitar **CSV** (não `.xls`/`.xlsx`) | Mais simples, sem dependência nova; usuário converte o `.xls` IBGE para CSV no Excel |
| 6 | Seletor: autocomplete único (nome + UF) | Melhor UX que UF→município ou `<select>` com 5.570 opções |

## Modelo de dados

```prisma
model Municipio {
  id            Int         @id @default(autoincrement())
  codigo_ibge   String      @unique @db.Char(7)
  nome          String
  uf            String      @db.Char(2)
  delegacoes    Delegacao[]
  criado_em     DateTime    @default(now())
  atualizado_em DateTime    @updatedAt

  @@index([uf, nome])
  @@index([nome])
}

model Delegacao {
  id            Int       @id @default(autoincrement())
  nome          String
  municipio     Municipio @relation(fields: [municipio_id], references: [id])
  municipio_id  Int
  logo_path     String?
  criado_em     DateTime  @default(now())
  atualizado_em DateTime  @updatedAt
}
```

**Migração:** drop dos campos `municipio` e `estado` em `Delegacao`, add `municipio_id Int NOT NULL` com FK para `Municipio(id)`. Como não há dados em produção, é uma migração destrutiva simples (Prisma `migrate dev`).

## Backend

### Estrutura
```
backend/src/modules/municipios/
  municipios.controller.ts
  municipios.routes.ts
  municipios.service.ts
  municipios.service.test.ts
```

### Endpoints

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET`    | `/municipios`         | autenticado | Lista paginada. Query: `uf?` (sigla), `q?` (busca por nome, case-insensitive), `page?` (default 1), `limit?` (default 50, max 200). Resposta: `{ data: Municipio[], total, page, limit }` |
| `GET`    | `/municipios/:id`     | autenticado | Detalhe |
| `POST`   | `/municipios`         | ADMIN | Cria. Body: `{ codigo_ibge, nome, uf }` |
| `PUT`    | `/municipios/:id`     | ADMIN | Edita (mesmo body, parcial) |
| `DELETE` | `/municipios/:id`     | ADMIN | Exclui. Retorna 409 se houver `Delegacao` referenciando |
| `POST`   | `/municipios/import`  | ADMIN | Upload CSV. `multipart/form-data` campo `arquivo`. Resposta: `{ criados, atualizados, ignorados, erros: [{ linha, motivo }] }` |

`GET` é acessível por qualquer usuário autenticado (não só ADMIN) porque o seletor de Delegacao precisa consumir.

Registrar em `src/index.ts`: `app.use('/municipios', municipiosRoutes)`.

### Importador CSV

Arquivo: `backend/src/modules/municipios/municipios.import.ts`.

Comportamento:
- Auto-detecta separador (`;` ou `,`) lendo a primeira linha.
- Trata BOM (`﻿`) no início do arquivo.
- Trata aspas duplas em campos.
- Normaliza headers (lowercase, sem acentos, sem espaços/underscores) antes de mapear.
- Aceita os seguintes nomes de coluna (após normalização) — pelo menos um por campo:
  - `codigo_ibge` ← `codigomunicipiocompleto`, `codigoibge`
  - `nome`        ← `nomemunicipio`, `nome`
  - `uf`          ← `uf`, `nomeuf`, `siglauf`
- Converte nome de UF por extenso (`"São Paulo"`) para sigla (`"SP"`) via mapa interno (27 entradas).
- Valida cada linha:
  - `codigo_ibge`: 7 dígitos numéricos
  - `uf`: 2 letras válidas (presente no mapa)
  - `nome`: não vazio após `trim`
- Linha inválida vai para `erros[]` (com nº da linha e motivo) sem abortar o lote.
- Persistência: lotes de 500 com `upsert` por `codigo_ibge` (ou `createMany skipDuplicates` + `updateMany`, o que ficar mais limpo).
- Sem dependência nova (parser CSV escrito à mão; o formato do IBGE é regular).

### Testes (vitest)

`municipios.service.test.ts` deve cobrir:
- CRUD básico (criar, listar com filtros `uf` e `q`, editar, remover)
- Falha ao deletar município com `Delegacao` vinculada → erro com `status: 409`
- Unicidade de `codigo_ibge`
- Parser CSV:
  - Headers normalizados (com acentos, maiúsculas, espaços)
  - Separador `;` vs `,`
  - BOM no início
  - UF por extenso → sigla
  - Linha inválida vai para `erros[]` sem abortar lote
  - Upsert por `codigo_ibge` (segunda importação atualiza, não duplica)

## Frontend

### Estrutura
```
frontend/src/
  pages/municipios/
    MunicipiosList.tsx
    MunicipiosForm.tsx
    MunicipiosImport.tsx
  services/municipios.ts
  types/municipio.ts
  components/MunicipioSelect.tsx
```

### `MunicipiosList.tsx`
- Tabela: Código IBGE, Nome, UF, Ações (editar/excluir).
- Filtros: combo UF (27 + "Todas") e busca livre (debounce 300ms).
- Paginação server-side (50/página).
- Botões topo: "Novo município" e "Importar CSV".

### `MunicipiosImport.tsx`
- Modal ou página com input file (`.csv`) e botão "Enviar".
- Após resposta do servidor, exibe resumo: `X criados, Y atualizados, Z ignorados, N erros`.
- Lista de erros expandível (linha + motivo) quando houver.

### `MunicipiosForm.tsx`
- Formulário para criar/editar manualmente.
- Campos: `codigo_ibge`, `nome`, `uf` (combo de 27).

### `MunicipioSelect.tsx` (componente reutilizável)
- Input com debounce 300ms que chama `GET /municipios?q=<termo>&limit=20`.
- Cada opção renderizada como `"Nome — UF"` (ex.: "São Paulo — SP").
- Valor controlado: `value: number | null` (id) e `onChange(id: number | null)`.
- Ao receber `value` pré-existente sem label (modo edição), busca o detalhe via `GET /municipios/:id` uma vez para exibir o nome.
- Sem cache global.

### `services/municipios.ts`
```ts
listar(params: { uf?: string; q?: string; page?: number; limit?: number })
buscarPorId(id: number)
criar(data: { codigo_ibge: string; nome: string; uf: string })
editar(id: number, data: Partial<{ codigo_ibge: string; nome: string; uf: string }>)
remover(id: number)
importar(file: File)
```

### Ajuste em `Delegacao`
- `types/delegacao.ts`: trocar `municipio: string; estado: string` por `municipio_id: number` (e opcionalmente `municipio?: Municipio` para exibição quando vier embutido).
- `services/delegacoes.ts`: ajustar payload do `criar` e `editar`.
- `pages/delegacoes/DelegacaoForm.tsx`: substituir os dois inputs antigos por `<MunicipioSelect />`.
- `pages/delegacoes/DelegacoesList.tsx`: exibir `municipio.nome — municipio.uf` (ajustar `GET /delegacoes` no backend para incluir o `municipio` via `include`).

### Rotas (`App.tsx`)
- `/municipios` → `MunicipiosList`
- `/municipios/novo` → `MunicipiosForm`
- `/municipios/:id/editar` → `MunicipiosForm`
- Adicionar item no menu lateral, no mesmo grupo dos outros cadastros (fundação).

## Operação inicial

1. Usuário abre o `.xls` do IBGE no Excel e salva como CSV (UTF-8, separador `;`).
2. Após deploy da nova versão, ADMIN faz upload do CSV em `/municipios` → "Importar CSV".
3. Sistema retorna `5570 criados, 0 atualizados, 0 ignorados, 0 erros` (esperado).

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| CSV mal formado (encoding errado, separador inesperado) | Auto-detecção de separador + BOM; erros por linha sem abortar lote |
| Município removido futuramente pelo IBGE | Não bloqueia: upsert por `codigo_ibge`. Município ausente em nova carga não é deletado (apenas não atualizado); responsabilidade do admin remover via UI se necessário |
| Tentativa de excluir município com delegação vinculada | Backend retorna 409 com mensagem clara; frontend exibe toast |
| Performance da busca com 5570 registros | Índices `(uf, nome)` e `(nome)` no Postgres + `limit` no endpoint |
