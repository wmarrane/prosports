# F7 — Relatório + Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Frontend-only: substituir 2 placeholders (`/admin` e `/relatorio`) por páginas reais. Admin = grid de 6 cards com contadores e links aos CRUDs. Relatório = tabela de eventos com botão "Exportar CSV" por linha (snapshot completo gerado client-side). Bump para `1.14.0`.

**Architecture:** Duas páginas independentes, ambas reusando services e tokens R2P existentes. Admin paraleliza 6 queries leves (apenas para contagem). Relatório fetcha 3 endpoints específicos do evento ao clicar exportar, deriva status do sorteio por inscrição (5 casos: grupos / chaves / ordem_entrada / especifico / não sorteado), e gera CSV em memória via Blob (com BOM UTF-8 para Excel).

**Tech Stack:** React 18 + TypeScript + Vite + React Query + Tailwind + tokens R2P. Sem novas deps. Sem backend.

**Spec:** `docs/superpowers/specs/2026-05-30-f7-relatorio-admin-design.md`

---

## File Structure

**Frontend — Modify:**
- `frontend/src/pages/Admin.tsx` — reescreve do zero.
- `frontend/src/pages/Relatorio.tsx` — reescreve do zero.

**Release:**
- `package.json` (root): `1.13.0` → `1.14.0`.
- `CHANGELOG.md`: bloco novo `[1.14.0]`.

Sem novos arquivos. Sem backend.

---

## Task 1: Reescrever `Admin.tsx`

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\Admin.tsx`

**Contexto importante:**
- Placeholder atual usa `<EmConstrucao />` — vai sumir.
- `municipiosService.listar` é paginado: retorna `{ data, total, page, limit }`. Para contar, usar `listar({ limit: 1 }).total`. Outros services retornam arrays — usar `.length`.
- Icons disponíveis em `frontend/src/lib/icons.ts`: `Trophy, Bracket, Order, Cadastro, ArrowRight`.
- Gradients R2P: `--grad-brand`, `--grad-info`, `--grad-violet`, `--grad-success`, `--grad-warn`.
- Padrão de `PageHeader`: `eyebrow`, `title`, `sub`.

- [ ] **Step 1: Substituir o arquivo inteiro**

Substituir `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\Admin.tsx` por:

```tsx
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import PageHeader from '../components/PageHeader'
import { competicoesService } from '../services/competicoes'
import { modalidadesService } from '../services/modalidades'
import { tiposModalidadeService } from '../services/tipos-modalidade'
import { municipiosService } from '../services/municipios'
import { inspetoriasService } from '../services/inspetorias'
import { delegaciasService } from '../services/delegacias'
import { Trophy, Bracket, Order, Cadastro, ArrowRight } from '../lib/icons'
import type { LucideIcon } from 'lucide-react'

type CardConfig = {
  eyebrow: string
  rota: string
  icon: LucideIcon
  gradient: string
  valor: number | string
}

function AdminCard({ eyebrow, rota, icon: Icon, gradient, valor }: CardConfig) {
  const navigate = useNavigate()
  return (
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
  )
}

export default function Admin() {
  const { data: competicoes = [] } = useQuery({
    queryKey: ['competicoes'],
    queryFn: competicoesService.listar,
  })
  const { data: modalidades = [] } = useQuery({
    queryKey: ['modalidades'],
    queryFn: () => modalidadesService.listar(),
  })
  const { data: tiposModalidade = [] } = useQuery({
    queryKey: ['tipos-modalidade'],
    queryFn: tiposModalidadeService.listar,
  })
  const { data: municipiosPage } = useQuery({
    queryKey: ['municipios', 'count'],
    queryFn: () => municipiosService.listar({ limit: 1 }),
  })
  const { data: inspetorias = [] } = useQuery({
    queryKey: ['inspetorias'],
    queryFn: inspetoriasService.listar,
  })
  const { data: delegacias = [] } = useQuery({
    queryKey: ['delegacias'],
    queryFn: delegaciasService.listar,
  })

  function valor(n: number | undefined): number | string {
    return n === undefined ? '—' : n
  }

  const cards: CardConfig[] = [
    { eyebrow: 'COMPETIÇÕES', rota: '/competicoes', icon: Trophy, gradient: 'var(--grad-brand)', valor: valor(competicoes.length) },
    { eyebrow: 'MODALIDADES', rota: '/modalidades', icon: Bracket, gradient: 'var(--grad-warn)', valor: valor(modalidades.length) },
    { eyebrow: 'TIPOS DE MODALIDADE', rota: '/tipos-modalidade', icon: Order, gradient: 'var(--grad-success)', valor: valor(tiposModalidade.length) },
    { eyebrow: 'MUNICÍPIOS', rota: '/municipios', icon: Cadastro, gradient: 'var(--grad-info)', valor: valor(municipiosPage?.total) },
    { eyebrow: 'INSPETORIAS', rota: '/inspetorias', icon: Cadastro, gradient: 'var(--grad-violet)', valor: valor(inspetorias.length) },
    { eyebrow: 'DELEGACIAS', rota: '/delegacias', icon: Cadastro, gradient: 'var(--grad-brand)', valor: valor(delegacias.length) },
  ]

  return (
    <div className="text-[var(--t1)]">
      <PageHeader eyebrow="GESTÃO" title="Administração" sub="Cadastros e configurações do sistema." />
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(c => (
            <AdminCard key={c.eyebrow} {...c} />
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: tsc + build**

De `frontend/`:
```
npx tsc --noEmit && npm run build
```

Esperado: tsc clean, vite build OK.

- [ ] **Step 3: Commit**

```
git add frontend/src/pages/Admin.tsx
git commit -m "feat(admin): replace placeholder with 6 CRUD cards landing" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Reescrever `Relatorio.tsx`

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\Relatorio.tsx`

**Contexto importante:**
- Tabela usa `DataTable` (mesmo padrão de outras pages).
- `STATUS_LABEL` e `STATUS_COLOR` vêm de `frontend/src/lib/evento-status.ts`.
- `inscricoesService.listar({ evento_id })` retorna inscrições com `participante` populado (vem do include default `{ participante: true }` no backend).
- `modalidadesService.listar({ competicao_id })` retorna modalidades com `tipo_modalidade` populado.
- `sorteiosService.listar({ evento_id })` retorna sorteios sem includes adicionais.
- O `Sorteio.resultado` é discriminado por `tipo` (vide `frontend/src/types/sorteio.ts`).
- BOM UTF-8 = `﻿` no início do CSV.

- [ ] **Step 1: Substituir o arquivo inteiro**

Substituir `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\Relatorio.tsx` por:

```tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import { eventosService } from '../services/eventos'
import { inscricoesService } from '../services/inscricoes'
import { sorteiosService } from '../services/sorteios'
import { modalidadesService } from '../services/modalidades'
import { STATUS_LABEL, STATUS_COLOR } from '../lib/evento-status'
import type { Evento } from '../types/evento'
import type { Sorteio } from '../types/sorteio'

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
  return '﻿' + lines.join('\n')
}

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function ordemSuffix(i: number): string {
  // 1º, 2º, 3º, 4ª, 5ª... (1-3 º, depois ª — padrão informal pt-BR pra ranking)
  if (i === 0) return '1º lugar'
  if (i === 1) return '2º lugar'
  if (i === 2) return '3º lugar'
  return `${i + 1}ª posição`
}

function deriveStatusSorteio(
  participanteId: number,
  tipoModalidade: string | undefined,
  sorteio: Sorteio | undefined,
): string {
  if (tipoModalidade === 'especifico') return 'sem sorteio automático'
  if (!sorteio) return 'não sorteado'
  if (sorteio.tipo === 'grupos') {
    const grupo = sorteio.resultado.grupos.find(g => g.participantes.includes(participanteId))
    return grupo ? `Grupo ${grupo.letra}` : 'não sorteado'
  }
  if (sorteio.tipo === 'chaves') {
    const idx = sorteio.resultado.slots.findIndex(s => s === participanteId)
    if (idx === -1) return 'não sorteado'
    return `Slot ${String(idx + 1).padStart(2, '0')}`
  }
  if (sorteio.tipo === 'ordem_entrada') {
    const idx = sorteio.resultado.ordem.findIndex(id => id === participanteId)
    if (idx === -1) return 'não sorteado'
    return ordemSuffix(idx)
  }
  return 'não sorteado'
}

export default function Relatorio() {
  const [exportando, setExportando] = useState<Set<number>>(new Set())
  const [erro, setErro] = useState('')

  const { data: eventos = [], isLoading: loadingEventos } = useQuery({
    queryKey: ['eventos'],
    queryFn: () => eventosService.listar(),
  })
  const { data: inscricoes = [] } = useQuery({
    queryKey: ['inscricoes'],
    queryFn: () => inscricoesService.listar(),
  })
  const { data: sorteios = [] } = useQuery({
    queryKey: ['sorteios'],
    queryFn: () => sorteiosService.listar(),
  })

  async function exportarCsv(evento: Evento) {
    setExportando(prev => new Set(prev).add(evento.id))
    setErro('')
    try {
      const [eventoInscricoes, eventoSorteios, modalidades] = await Promise.all([
        inscricoesService.listar({ evento_id: evento.id }),
        sorteiosService.listar({ evento_id: evento.id }),
        modalidadesService.listar({ competicao_id: evento.competicao_id }),
      ])
      const modalidadesById = new Map(modalidades.map(m => [m.id, m]))
      const sorteiosByModalidade = new Map(eventoSorteios.map(s => [s.modalidade_id, s]))

      const headers = [
        'modalidade_nome',
        'modalidade_sigla',
        'participante_nome',
        'participante_subtitulo',
        'participante_municipio',
        'status_sorteio',
      ]
      const rows: string[][] = []
      for (const ins of eventoInscricoes) {
        const m = modalidadesById.get(ins.modalidade_id)
        const sorteio = sorteiosByModalidade.get(ins.modalidade_id)
        const tipo = m?.tipo_modalidade?.tipo
        const status = deriveStatusSorteio(ins.participante_id, tipo, sorteio)
        const municipio = ins.participante.municipio
          ? `${ins.participante.municipio.nome}/${ins.participante.municipio.uf}`
          : ''
        rows.push([
          m?.nome ?? '',
          m?.sigla ?? '',
          ins.participante.nome,
          ins.participante.subtitulo ?? '',
          municipio,
          status,
        ])
      }
      const csv = buildCsv(headers, rows)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `relatorio-evento-${evento.id}-${slug(evento.nome)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Erro ao exportar CSV.')
    } finally {
      setExportando(prev => {
        const next = new Set(prev)
        next.delete(evento.id)
        return next
      })
    }
  }

  const columns = [
    { header: 'Evento', accessor: (row: Evento) => row.nome },
    { header: 'Competição', accessor: (row: Evento) => row.competicao?.nome ?? '—' },
    {
      header: 'Status',
      accessor: (row: Evento) => (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[row.status]}`}>
          {STATUS_LABEL[row.status]}
        </span>
      ),
      className: 'w-32',
    },
    {
      header: 'Inscrições',
      accessor: (row: Evento) => inscricoes.filter(i => i.evento_id === row.id).length,
      className: 'w-28',
    },
    {
      header: 'Sorteios',
      accessor: (row: Evento) => sorteios.filter(s => s.evento_id === row.id).length,
      className: 'w-24',
    },
    {
      header: 'Ações',
      accessor: (row: Evento) => (
        <button
          onClick={() => exportarCsv(row)}
          disabled={exportando.has(row.id)}
          className="text-xs text-[var(--brand-500)] hover:text-[var(--brand-400)] disabled:opacity-50"
        >
          {exportando.has(row.id) ? 'Exportando...' : 'Exportar CSV'}
        </button>
      ),
      className: 'w-32',
    },
  ]

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="GESTÃO"
        title="Relatório"
        sub="Exporte snapshot completo de cada evento (inscrições + resultados de sorteio) em CSV."
      />
      <div className="p-6 space-y-3">
        {erro && <p className="text-sm text-[var(--danger)]">{erro}</p>}
        {loadingEventos ? (
          <p className="text-sm text-[var(--t3)]">Carregando...</p>
        ) : (
          <DataTable
            columns={columns}
            data={eventos}
            keyExtractor={r => r.id}
            emptyMessage="Nenhum evento cadastrado."
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: tsc + build**

De `frontend/`:
```
npx tsc --noEmit && npm run build
```

Esperado: tsc clean, vite build OK.

- [ ] **Step 3: Commit**

```
git add frontend/src/pages/Relatorio.tsx
git commit -m "feat(relatorio): replace placeholder with eventos table + export CSV per evento" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Bump versão + CHANGELOG

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\package.json`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\CHANGELOG.md`

- [ ] **Step 1: Bump version**

Editar `package.json` (root). Mudar **somente** `"version": "1.13.0"` para `"version": "1.14.0"`.

- [ ] **Step 2: Adicionar bloco no `CHANGELOG.md`**

Inserir o bloco abaixo logo após o cabeçalho e **antes** do bloco `## [1.13.0]`:

```md
## [1.14.0] - 2026-05-30

### Added
- Página /admin real: landing com 6 cards (Competições, Modalidades, Tipos de Modalidade, Municípios, Inspetorias, Delegacias) com contadores e link direto pro CRUD correspondente.
- Página /relatorio real: tabela de eventos (com status, inscrições, sorteios) e botão "Exportar CSV" por linha. Download gerado client-side com snapshot do evento: cada linha = (modalidade, participante, status_sorteio) cobrindo todos os tipos (grupos/chaves/ordem_entrada/especifico/não sorteado).

### Notes
- CSV inclui BOM UTF-8 para abrir corretamente no Excel com acentuação.
- Nenhum endpoint novo, nenhuma dependência nova.
```

- [ ] **Step 3: Commit**

```
git add package.json CHANGELOG.md
git commit -m "chore(release): v1.14.0 — F7 Relatório + Admin" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Push + smoke (pós-deploy CI)

**Files:** (sem edição — verificação)

- [ ] **Step 1: Push**

```
git push origin develop
```

CI reconstrói só o frontend. ~3-4min.

- [ ] **Step 2: Verificar deploy**

```
curl -s -o /dev/null -w "/health: %{http_code}\n" http://192.168.56.113:3000/health
curl -s -o /dev/null -w "frontend: %{http_code}\n" http://192.168.56.113:8080/
```

Esperado: ambos 200.

- [ ] **Step 3: Smoke no browser**

Abrir http://192.168.56.113:8080, login `admin@prosports.com` / `admin123`:

**Admin:**
1. Sidebar → Gestão → Administração → `/admin`.
2. Header: "GESTÃO · Administração · Cadastros e configurações do sistema."
3. 6 cards aparecem em grid (3 colunas em desktop), cada um com ícone gradient, contador real do DB e seta direita.
4. Click "Competições" → navega `/competicoes`. Voltar.
5. Click "Municípios" → navega `/municipios`. Voltar (este card usa `.total` do paginado).
6. Click "Modalidades", "Tipos de Modalidade", "Inspetorias", "Delegacias" — cada um navega pro CRUD correspondente.

**Relatório:**
1. Sidebar → Gestão → Relatório → `/relatorio`.
2. Header: "GESTÃO · Relatório · Exporte snapshot completo..."
3. Tabela mostra eventos com colunas Evento, Competição, Status (badge), Inscrições, Sorteios, Ações.
4. Click "Exportar CSV" num evento que tenha pelo menos uma inscrição → arquivo `relatorio-evento-{id}-{slug}.csv` baixa.
5. Abrir o CSV em editor/Excel/LibreOffice:
   - Header correto: `modalidade_nome,modalidade_sigla,participante_nome,participante_subtitulo,participante_municipio,status_sorteio`
   - Linhas: uma por inscrição
   - Para inscritos em modalidade `grupos` sorteada: `status_sorteio` = "Grupo A" etc.
   - Para `chaves` sorteada: `status_sorteio` = "Slot 03"
   - Para `ordem_entrada` sorteada: "1º lugar", "2ª posição", etc.
   - Para `especifico`: "sem sorteio automático"
   - Para sem sorteio ainda: "não sorteado"
   - Acentos abrem corretamente (BOM UTF-8 funcionou).
6. Click no botão durante a execução desabilita o botão ("Exportando...").
7. Eventos sem inscrição: CSV só com header (linha única). Aceitável.
8. Rodapé sidebar: `v1.14.0`.

- [ ] **Step 4: Reportar**

Se passou, F7 fechada — concluiu todo o backlog de sub-projetos do redesign.

---

## Self-review

Cobertura do spec:

| Spec | Coberto por |
|---|---|
| Admin: PageHeader + grid 6 cards (Competições, Modalidades, Tipos, Municípios, Inspetorias, Delegacias) | Task 1 |
| Admin: contador via `.length` (e `.total` para municipios paginado) | Task 1 (helper `valor` + queries) |
| Admin: click no card navega para a rota do CRUD | Task 1 (`AdminCard` onClick) |
| Relatório: PageHeader + tabela eventos com Status badge, contadores Inscrições/Sorteios, botão Exportar CSV | Task 2 (`columns` + queries top-level) |
| Relatório: derivação de `status_sorteio` por tipo (5 casos) | Task 2 (`deriveStatusSorteio`) |
| Relatório: CSV escape + BOM UTF-8 + slug filename + Blob download | Task 2 (`escapeCsv`, `buildCsv`, `slug`, `exportarCsv`) |
| Relatório: state `exportando: Set<id>` para desabilitar botão | Task 2 |
| Bump 1.14.0 + CHANGELOG | Task 3 |
| Smoke pós-deploy (admin + relatório) | Task 4 |

Riscos endereçados:
- **Municipios paginado**: `useQuery` específico com `['municipios', 'count']` + `limit: 1`, leitura via `municipiosPage?.total` (Task 1).
- **inscricoes/sorteios sem evento_id**: na Task 2, queries top-level pegam TUDO sem filtro para os contadores na tabela. Exportar dispara queries específicas filtradas.
- **Sorteio discriminado**: `Sorteio` é union por `tipo` → `deriveStatusSorteio` tem branch por tipo + fallback "não sorteado".
- **BOM UTF-8**: prepended no `buildCsv` (`'﻿' + ...`).
- **Botão duplo click**: state `exportando: Set<id>` previne (disabled durante).
- **Cache compartilhado**: queries `eventos`, `inscricoes`, `sorteios` reutilizam cache de Painel/EventoInscricoes.
- **Sem testes vitest**: F7 é puramente UI + CSV inline. Smoke manual valida.
