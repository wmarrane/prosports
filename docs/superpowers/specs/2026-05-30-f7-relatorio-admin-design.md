# F7 — Relatório + Admin — Design

**Data:** 2026-05-30
**Status:** Aprovado para implementação
**Versão alvo:** 1.14.0

## Objetivo

Substituir dois placeholders (`/admin` e `/relatorio`) por páginas reais e úteis. Frontend-only — sem novo backend, sem migrations, sem novas deps.

- **/admin**: landing visual com 6 cards de CRUDs administrativos, cada um com contador e link "Abrir".
- **/relatorio**: tabela de eventos com botão "Exportar CSV" por linha, que baixa snapshot do evento (inscrições × resultado de sorteio) em CSV gerado client-side.

## Escopo

- **In:**
  - Página `Admin.tsx` reescrita do zero (era placeholder) — 6 cards.
  - Página `Relatorio.tsx` reescrita do zero — tabela de eventos + export CSV por evento.
  - Função utilitária local para gerar CSV (sem dep nova).
  - Helper local para descrever status_sorteio por tipo (grupos / chaves / ordem_entrada / especifico / não sorteado).
- **Out:**
  - Gestão de usuários (CRUD Users) — fica para iteração futura, exige backend.
  - Exportação Excel/XLSX — só CSV nesta sub-fase.
  - Atividade/auditoria — exige ActivityLog.
  - Mudanças no backend.

## Arquitetura

### Página `/admin` — Landing de CRUDs

Substitui `frontend/src/pages/Admin.tsx`. Header padrão + grid responsivo de 6 cards.

**Cards** (ordem para refletir o sidebar atual da seção Administração):

| Card | Service usado para contar | Rota | Ícone | Gradient |
|---|---|---|---|---|
| Competições | `competicoesService.listar()` → `.length` | `/competicoes` | `Trophy` | `--grad-brand` |
| Modalidades | `modalidadesService.listar()` → `.length` | `/modalidades` | `Bracket` | `--grad-warn` |
| Tipos de Modalidade | `tiposModalidadeService.listar()` → `.length` | `/tipos-modalidade` | `Order` | `--grad-success` |
| Municípios | `municipiosService.listar({ limit: 1 })` → `.total` | `/municipios` | `Cadastro` | `--grad-info` |
| Inspetorias | `inspetoriasService.listar()` → `.length` | `/inspetorias` | `Cadastro` | `--grad-violet` |
| Delegacias | `delegaciasService.listar()` → `.length` | `/delegacias` | `Cadastro` | `--grad-brand` |

**Atenção: `municipiosService.listar` é paginado** — retorna `{ data, total, page, limit }`. Para o contador usar `.total` da resposta com `limit: 1` (1 row + total).

Cada card:
```tsx
<button
  onClick={() => navigate(rota)}
  className="card flex items-center gap-4 text-left w-full hover:border-[var(--brand-400)] transition-colors"
  style={{ padding: 20 }}
>
  <div style={{ background: gradient, padding: 14, borderRadius: 12, display: 'inline-flex' }}>
    <Icon size={26} color="#fff" />
  </div>
  <div className="flex-1">
    <div className="eyebrow text-[var(--t3)]">{eyebrow}</div>
    <div className="text-2xl font-black tabular-nums text-[var(--t1)]">{valor}</div>
  </div>
  <ArrowRight size={18} className="text-[var(--t3)]" />
</button>
```

Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`.

PageHeader: `eyebrow="GESTÃO"`, `title="Administração"`, `sub="Cadastros e configurações do sistema."`.

### Página `/relatorio` — Lista de Eventos + Export CSV

Substitui `frontend/src/pages/Relatorio.tsx`.

PageHeader: `eyebrow="GESTÃO"`, `title="Relatório"`, `sub="Exporte snapshot completo de cada evento (inscrições + resultados de sorteio) em CSV."`.

**Tabela (DataTable)** com colunas:
- Evento (`evento.nome`)
- Competição (`evento.competicao.nome`)
- Status (badge colorido — reutiliza `STATUS_LABEL` + `STATUS_COLOR` de `frontend/src/lib/evento-status.ts`)
- Inscrições (contador: `inscricoes.filter(i => i.evento_id === e.id).length`)
- Sorteios (contador: `sorteios.filter(s => s.evento_id === e.id).length`)
- Ações: botão "Exportar CSV"

**Queries no topo da página** (paralelas):
- `useQuery(['eventos'], () => eventosService.listar())`
- `useQuery(['inscricoes'], () => inscricoesService.listar())` — todas as inscrições, para contadores
- `useQuery(['sorteios'], () => sorteiosService.listar())` — todos os sorteios, para contadores

Cache compartilhado com Painel e outras páginas.

### Export CSV — fluxo

Click no botão "Exportar CSV" dispara `async function exportarCsv(evento)`:

1. Fetch específico do evento (não bloqueia outros botões):
   - `inscricoesService.listar({ evento_id: e.id })` — inscrições do evento (com `participante` populado)
   - `sorteiosService.listar({ evento_id: e.id })` — sorteios do evento
   - `modalidadesService.listar({ competicao_id: e.competicao_id })` — modalidades da competição (com `tipo_modalidade` populado, já vem do include default do backend)

2. Para cada inscrição, derivar `statusSorteio` usando o sorteio da modalidade dessa inscrição:
   - Encontrar `sorteio = sorteios.find(s => s.modalidade_id === inscricao.modalidade_id)`.
   - Encontrar `modalidade = modalidades.find(m => m.id === inscricao.modalidade_id)`.
   - Se `modalidade?.tipo_modalidade?.tipo === 'especifico'` → `"sem sorteio automático"`
   - Se `!sorteio` → `"não sorteado"`
   - Senão, switch por `sorteio.tipo`:
     - `grupos`: buscar em `sorteio.resultado.grupos` qual letra contém `participante_id` → `"Grupo A"` etc. Se não encontrar (raro), `"não sorteado"`.
     - `chaves`: buscar índice em `sorteio.resultado.slots` onde o valor é `participante_id` → `"Slot 03"`. Se não encontrar, `"não sorteado"`. (BYE não aparece para inscritos — BYE = null slot, só preenche quando faltam.)
     - `ordem_entrada`: buscar índice em `sorteio.resultado.ordem` onde o valor é `participante_id` → `"1º lugar"`, `"2ª posição"`, ... Se não encontrar, `"não sorteado"`.

3. Gerar linhas do CSV:
   ```
   modalidade_nome,modalidade_sigla,participante_nome,participante_subtitulo,participante_municipio,status_sorteio
   Xadrez,XAD,João Silva,Atleta A,São Paulo/SP,Grupo A
   ```
   - `participante_municipio` = `${participante.municipio.nome}/${participante.municipio.uf}` (ou vazio se não vier).
   - Escape simples: campos com `,` `"` ou `\n` viram `"campo escapado"` (aspas duplas internas dobradas).

4. Disparar download via Blob:
   ```ts
   const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
   const url = URL.createObjectURL(blob)
   const a = document.createElement('a')
   a.href = url
   a.download = `relatorio-evento-${e.id}-${slug(e.nome)}.csv`
   a.click()
   URL.revokeObjectURL(url)
   ```

`slug(s)`: remove acentos (NFD + replace), troca não-alfanuméricos por hífen, lowercase, trim hyphens.

### Função utilitária CSV

Inline na `Relatorio.tsx`:

```ts
function escapeCsv(value: string | null | undefined): string {
  const s = value ?? ''
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function buildCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.map(escapeCsv).join(',')]
  for (const row of rows) lines.push(row.map(escapeCsv).join(','))
  return lines.join('\n')
}

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}
```

### Loading states

- **Admin**: contadores carregam paralelo. Mostrar `—` enquanto loading.
- **Relatório tabela**: mostrar "Carregando..." se eventos loading.
- **Click exportar**: setar state local `exportando: Set<eventId>` para desabilitar o botão durante fetch + gerar CSV. Após download, remover do set.

## Implementação — File Structure

**Frontend — Modify:**
- `frontend/src/pages/Admin.tsx` — reescrita.
- `frontend/src/pages/Relatorio.tsx` — reescrita.

Sem novos arquivos. Sem mudanças em services/types existentes.

**Release:**
- `package.json` (root): `1.13.0` → `1.14.0`.
- `CHANGELOG.md`: bloco novo `[1.14.0]`.

## Smoke pós-deploy

1. Login admin.
2. Sidebar → Gestão → Administração → /admin.
   - 6 cards aparecem com contadores reais (números do DB).
   - Click "Modalidades" → /modalidades. Voltar.
   - Click "Municípios" → /municipios. Voltar.
3. Sidebar → Gestão → Relatório → /relatorio.
   - Tabela mostra eventos com contadores de inscrições/sorteios.
   - Click "Exportar CSV" em um evento que tenha sorteios + inscrições → arquivo `.csv` baixa.
   - Abrir CSV no Excel/LibreOffice: header correto + linhas com modalidade, participante, status_sorteio.
   - Eventos sem sorteios ainda: status_sorteio = "não sorteado" para todas as linhas.
   - Modalidade especifico: status_sorteio = "sem sorteio automático".
4. Empty state: se nenhum evento existe → "Nenhum evento cadastrado." na tabela.
5. Rodapé sidebar: `v1.14.0`.

## Risco / efeitos colaterais

- **Municipios paginado**: spec já diz como usar (`{ limit: 1 }.total`). Sem isso, contador erra.
- **Async fetch ao exportar**: 3 requests por click. Botão desabilitado durante. Em conexões lentas pode demorar — aceitável.
- **CSV grande**: para eventos com centenas de inscrições, CSV pode ter 100KB+. Blob aguenta MBs sem problema.
- **Encoding**: `text/csv;charset=utf-8` + BOM opcional para Excel reconhecer UTF-8. **Decisão**: incluir BOM `﻿` no início do CSV — Excel abre corretamente com acentos.
- **Cache compartilhado**: queries `['eventos']`, `['inscricoes']`, `['sorteios']` reutilizam cache do Painel.
- **Sem testes vitest**: 100% UI. Smoke manual cobre.
