# F5 — Import CSV de Inscrições — Design

**Data:** 2026-05-30
**Status:** Aprovado para implementação
**Versão alvo:** 1.11.0

## Objetivo

Importar inscrições em lote a partir de um arquivo CSV, dentro do contexto de uma (evento, modalidade) selecionada. Auto-cria Participantes globais que ainda não existem (match por nome + município). Wizard 3 passos com revisão antes de commit (dry-run no backend).

## Escopo

- **In:**
  - Endpoint `POST /inscricoes/import` (suporta `dry_run`).
  - Wizard 3 passos no frontend (modal) acessível em `/eventos/:id/inscricoes`.
  - Parsing client-side via `papaparse`.
  - Auto-criação de Participante (nome + municipio) quando não existe.
  - Modo parcial (linhas ruins não bloqueiam linhas boas).
- **Out:**
  - Excel `.xlsx` (apenas CSV nesta sub-fase).
  - Import de participantes globais sem inscrição.
  - Auto-criação de inspetoria/delegacia (ambos ficam null).
  - Editar/normalizar linhas durante a revisão (operador corrige o CSV e re-faz upload se preciso).

## Domínio

Operador tem uma planilha (CSV) com participantes que devem ser inscritos numa modalidade específica do evento. Pode ter dezenas ou centenas de linhas. Alguns participantes já existem no pool global; outros são novos.

Regras:
- O CSV é parseado client-side. Antes de tudo, valida que o header bate exatamente.
- Backend resolve cada linha para um Participante existente (busca exata por `nome` trimado + `municipio_id`) ou cria um novo no fluxo. Subtitulo opcional vai junto se Participante é criado.
- Inscrição duplicada (mesmo participante já inscrito naquela evento+modalidade) é status `duplicada` (skip silencioso).
- Erro de validação (município não existe) é status `erro` com mensagem — linha não importa.
- Modo `dry_run: true` simula tudo dentro de uma transação que sempre faz rollback. Retorna os mesmos statuses que aconteceriam em commit real, mas sem persistir.
- Modo `dry_run: false` commita por linha (parcial). Linha com erro não impede as outras.

## CSV schema

```
nome,municipio_uf,municipio_nome,subtitulo
João Silva,SP,São Paulo,Atleta A
Maria Souza,RJ,Rio de Janeiro,
```

- `nome` — obrigatório, string. Trim antes de processar.
- `municipio_uf` — obrigatório, 2 chars. Uppercased antes de match.
- `municipio_nome` — obrigatório, string. Match **case-insensitive** + trim.
- `subtitulo` — opcional. Pode ser vazio. Trim antes de processar.

Outras colunas no CSV são **ignoradas** silenciosamente. Header errado (alguma obrigatória faltando) → erro no passo 1 antes de enviar ao backend.

## Backend

### Service — `inscricoes.service.importar`

```ts
type ImportRow = {
  nome: string
  municipio_uf: string
  municipio_nome: string
  subtitulo?: string
}

type ImportRowResult = {
  linha: number  // 1-based, refere à linha original do CSV (sem header)
  nome: string
  status: 'criada' | 'duplicada' | 'erro'
  erro?: string
  participante_criado?: boolean
}

type ImportResult = {
  rows: ImportRowResult[]
  contadores: {
    criadas: number
    duplicadas: number
    erros: number
    participantes_criados: number
  }
}

export async function importar(input: {
  evento_id: number
  modalidade_id: number
  dry_run: boolean
  rows: ImportRow[]
}): Promise<ImportResult>
```

Algoritmo (executa dentro de uma `prisma.$transaction` única — rollback no `dry_run: true`, commit no `dry_run: false`):

1. Valida evento (404) e modalidade (404).
2. Valida `evento.competicao_id === modalidade.competicao_id` (400).
3. Pre-carrega municípios por UFs únicas presentes nos rows. Indexa em `Map<"UF:nome_lower", Municipio>`.
4. Pre-carrega inscrições já existentes em (evento, modalidade). Indexa em `Set<participante_id>`.
5. Itera linhas:
   - Resolve município: lookup case-insensitive. Se ausente → `{ status: 'erro', erro: "Município '<nome>/UF' não encontrado" }`.
   - Resolve participante: `prisma.participante.findFirst({ where: { nome, municipio_id } })`. Se não acha, cria com `prisma.participante.create({ data: { nome, municipio_id, subtitulo? } })` → `participante_criado: true`.
   - Tenta criar inscrição: `prisma.inscricao.create({ data: { evento_id, modalidade_id, participante_id } })`. Se P2002 → `status: 'duplicada'`. Senão → `status: 'criada'`.
   - **Importante:** dentro da transação, mesmo `dry_run: true`, as `create` REAIS acontecem (e contribuem para os índices internos da transação — duas linhas do CSV com mesmo participante novo NÃO geram 2 cadastros porque a segunda já encontra o primeiro). No final, o controle de transação decide commit/rollback.
6. Se `dry_run: true`: ao final, **lança um erro especial** (`class DryRunRollback extends Error`) capturado fora do `$transaction` para forçar rollback sem propagar. Retorna os statuses acumulados.
7. Se `dry_run: false`: transação commita. Retorna os statuses.

**Nota técnica sobre `$transaction`:** Prisma `$transaction` com callback faz rollback se a função throw. Para implementar `dry_run`, throwear `DryRunRollback` no final da transação e capturar fora.

```ts
try {
  await prisma.$transaction(async (tx) => {
    // processa rows usando tx
    if (input.dry_run) throw new DryRunRollback(resultRef)
  })
  return resultRef
} catch (err) {
  if (err instanceof DryRunRollback) return err.result
  throw err
}
```

**Linha com erro durante o commit real:** dentro da transação, capturar exceções por linha individualmente (`try/catch`) — `status: 'erro'` é registrado mas a transação inteira segue. A transação só faria rollback se um erro escapasse do `try/catch` interno (caso degenerado).

**Atomicidade de "parcial" dentro da transação:** uma transação tudo-ou-nada parece contradizer "parcial". A solução: usar **transações curtas individuais por linha**, fora de uma transação grande. Isto é mais simples e idiomático:

```ts
for (const row of rows) {
  try {
    if (dry_run) {
      await prisma.$transaction(async (tx) => {
        const res = await processRow(tx, row)
        results.push(res)
        throw new DryRunRollback()
      }).catch(e => { if (!(e instanceof DryRunRollback)) throw e })
    } else {
      await prisma.$transaction(async (tx) => {
        const res = await processRow(tx, row)
        results.push(res)
      })
    }
  } catch (e: any) {
    results.push({ linha, nome: row.nome, status: 'erro', erro: e.message })
  }
}
```

**Trade-off**: com `dry_run: true`, cada linha rola sua própria transação, então criação de Participante na linha 1 NÃO é vista pela linha 2 dentro do mesmo dry_run. Resultado: se o CSV tem 2 linhas com o mesmo participante novo, o dry_run reportaria "2 participantes criados" (em vez de 1 + 1 duplicada). Isto é aceito por simplicidade — o commit real teria o mesmo comportamento (cada linha é transação isolada) então o usuário pode contar com o que vê no dry_run.

**Para evitar essa surpresa**, faremos o pre-load de Participantes existentes igual ao pre-load de inscrições, e um **index local em memória** (não no DB) que vai sendo populado durante o loop. Aí, segunda linha com mesmo participante novo vê o "criado em memória" da primeira e vira `duplicada`.

Algoritmo refinado:

```ts
const municipiosByKey = new Map<string, number>()  // "UF:nome_lower" → municipio_id
const participantesByKey = new Map<string, number>()  // "municipio_id:nome_lower" → participante_id (pre-carregados + criados)
const inscricoesSet = new Set<number>()  // participante_id já inscrito (pre-carregado + criado)

// Pre-load municipios (uma query por UF distinta) + participantes existentes desses municipios + inscrições já feitas.
// Loop:
for (const row of rows) {
  // 1. resolve municipio_id via municipiosByKey
  // 2. resolve participante_id via participantesByKey (cria se ausente — adiciona ao map)
  // 3. inscreve (skip se já no inscricoesSet)
}
```

Cada DB operation é numa transação curta (ou auto-commit). O index em memória resolve a ordem dentro do batch.

### Controller (Zod)

```ts
const importRowSchema = z.object({
  nome: z.string().min(1).max(200),
  municipio_uf: z.string().length(2),
  municipio_nome: z.string().min(1).max(120),
  subtitulo: z.string().max(200).optional(),
})

const importSchema = z.object({
  evento_id: z.coerce.number().int().positive(),
  modalidade_id: z.coerce.number().int().positive(),
  dry_run: z.boolean(),
  rows: z.array(importRowSchema).min(1).max(2000),
})
```

`POST /inscricoes/import` (admin) → chama `service.importar` → 200 com `ImportResult`.

### Testes vitest

Mock prisma com `municipio.findMany`, `participante.findMany`, `participante.create`, `inscricao.findMany`, `inscricao.create`. Casos:

1. `importar lança 404 se evento não existe`.
2. `importar lança 404 se modalidade não existe`.
3. `importar lança 400 se competições não batem`.
4. `linha com município inexistente → status 'erro'`.
5. `linha com participante já inscrito → status 'duplicada', sem criar`.
6. `linha com participante existente (não inscrito) → status 'criada', participante_criado: false`.
7. `linha com participante novo → status 'criada', participante_criado: true`.
8. `2 linhas com mesmo participante novo no batch → 1 'criada' (com participante_criado: true) + 1 'duplicada'`.
9. `dry_run: true não chama prisma.inscricao.create nem participante.create de verdade` (verificar via spy que mocks de create NÃO foram chamados; ou checa que o mock de create chamado, mas a transação rola back — depende da implementação; **decisão de implementação**: dry_run usa um caminho separado que NÃO chama os mutators, só os finders, e simula o resultado).
10. `contadores agregados corretamente`.

**Reformulação do dry_run para teste-amigável:** no `dry_run: true`, ao invés de rodar transações e fazer rollback, o service computa os statuses simulando: `participante_criado=true` se não está no map; `status='duplicada'` se está no set/recém-adicionado; etc. Sem nenhum `create`. Mais simples de testar e mais previsível.

**Decisão final**: implementar dry_run como caminho simulado (sem write ops), commit como caminho real. Mais código, mais simples de testar, sem dependência de comportamento transacional do Prisma.

## Frontend

### Componente `ImportInscricoesModal`

Localização: `frontend/src/components/import/ImportInscricoesModal.tsx`. Props:

```ts
type Props = {
  open: boolean
  eventoId: number
  modalidadeId: number
  onClose: () => void
  onImported: () => void  // chamado após commit success → página invalida queries
}
```

State machine (3 steps):
- `step: 'upload' | 'review' | 'done'`
- `file: File | null`
- `rows: ImportRow[]`  (após parse)
- `previewResult: ImportResult | null`
- `commitResult: ImportResult | null`
- `loading: boolean`
- `erro: string`

**Step "upload":**
- Dropzone (input file `accept=".csv"` + click-to-pick). Mostra nome do arquivo escolhido.
- Botão "Próximo": parse CSV com papaparse. Valida header — se faltar coluna obrigatória, mostra erro inline. Se OK, popula `rows`, transita para `review`.

**Step "review":**
- Ao entrar, chama `inscricoesService.importar({ ..., dry_run: true, rows })`.
- Loading state durante o request.
- Após resposta, renderiza tabela: linha, nome, status (badge colorido), erro (se tem). Contadores no topo.
- Botões: "Voltar" (state → upload, mantém file) e "Importar X inscrições" (state → loading → POST commit).

**Step "done":**
- Mostra os contadores finais + ícone ✓.
- Botão "Fechar" → chama `onImported()` + `onClose()`.

### Página `EventoInscricoes`

Adicionar botão "Importar CSV" ao lado de "+ Inscrever" (quando uma modalidade está selecionada). Click → abre `ImportInscricoesModal`. `onImported` → `queryClient.invalidateQueries(['inscricoes', eventoId, modalidadeId])`.

### Tipos

Em `frontend/src/types/inscricao.ts`, adicionar:

```ts
export type ImportRow = {
  nome: string
  municipio_uf: string
  municipio_nome: string
  subtitulo?: string
}

export type ImportRowResult = {
  linha: number
  nome: string
  status: 'criada' | 'duplicada' | 'erro'
  erro?: string
  participante_criado?: boolean
}

export type ImportResult = {
  rows: ImportRowResult[]
  contadores: {
    criadas: number
    duplicadas: number
    erros: number
    participantes_criados: number
  }
}
```

### Service

Adicionar a `inscricoesService`:

```ts
importar: (data: {
  evento_id: number
  modalidade_id: number
  dry_run: boolean
  rows: ImportRow[]
}) => api.post<ImportResult>(`${BASE}/import`, data).then(r => r.data),
```

### Dependência

Adicionar `papaparse` + `@types/papaparse` ao `frontend/package.json`.

```
npm install papaparse @types/papaparse
```

(Tipos via @types — papaparse não vem com types embedded.)

## Release

- `package.json` (root): `1.10.0` → `1.11.0` (MINOR).
- `CHANGELOG.md`: bloco `[1.11.0]` com `Added` (import CSV de inscrições + wizard 3 passos + auto-criação de Participante).

## Smoke pós-deploy

1. Login admin. /eventos → Inscrições → seleciona modalidade.
2. Botão "Importar CSV" aparece ao lado de "+ Inscrever".
3. Click → modal abre no passo 1. Dropzone.
4. Subir um CSV bem-formado com 5 linhas (mistura de participantes existentes + novos). Click "Próximo".
5. Passo 2 mostra tabela com cada linha + status colorido. Contadores corretos.
6. Click "Importar X". Passo 3 mostra resumo. Click "Fechar". Lista de inscritos da modalidade atualiza com as novas.
7. Testar com header errado → erro inline no passo 1.
8. Testar com município inexistente no CSV → linha vai pra revisão como 🔴 erro.
9. Testar com participante já inscrito → linha vai como 🟡 duplicada.
10. Rodapé sidebar: `v1.11.0`.

## Risco / efeitos colaterais

- **Auto-criação de Participantes** popula o pool global. Se o operador subir um CSV com nomes errados, vai poluir o cadastro. Aceito — o operador é admin e responsável. UI exibe "X participantes serão criados" no passo de revisão pra dar oportunidade de revisar.
- **Match exato por nome + município**: "João Silva" e "joão silva" são tratados como pessoas diferentes (case-sensitive no match de Participante). **Decisão**: também fazer match case-insensitive em `participante.nome` para evitar duplicatas por capitalização.
- **CSV com mais de 2000 linhas**: rejeitado pelo Zod. Operador divide em arquivos menores.
- **Performance**: pre-load de municípios por UF (no máximo 27 queries — uma por UF distinta) + pre-load de participantes desses municípios. Para CSV grande pode ser lento em UF densa (São Paulo tem milhares de participantes potenciais). Aceito por enquanto — otimização vem se virar gargalo real.
- **Concurrent imports** na mesma (evento, modalidade): cada linha é transação isolada, então corridas são possíveis mas resolvidas pelo unique constraint (uma vira 'duplicada'). Sem locks.
