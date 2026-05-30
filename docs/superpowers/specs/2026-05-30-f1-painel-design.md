# F1 — Painel (MVP) — Design

**Data:** 2026-05-30
**Status:** Aprovado para implementação
**Versão alvo:** 1.13.0

## Objetivo

Substituir o placeholder atual de `/painel` por um dashboard real com 3 seções: hero com saudação + CTAs, 4 KPIs do estado atual do sistema, e lista de "Próximos sorteios" (eventos ativos com modalidades pendentes). Frontend-only — sem novo backend, sem migrations.

## Escopo

- **In:**
  - Página `Painel.tsx` reescrita do zero.
  - Hero com gradiente `--grad-brand-deep`, saudação personalizada (nome/email do user), 2 CTAs (Modo Congresso, + Novo evento).
  - 4 KPI cards (Competições, Eventos, Participantes, Sorteios realizados).
  - Lista "Próximos sorteios" derivada client-side a partir de eventos + modalidades + sorteios.
  - Empty states amigáveis.
- **Out:**
  - Gráficos (área de inscrições 6 meses + donut por tipo) — F1b.
  - Atividade recente — exige `ActivityLog` (F1c).
  - Mini-stats redundantes dentro do hero.
  - Comparativo histórico ("+12% este mês").
  - Mudanças no backend.

## Arquitetura

### Página principal — `frontend/src/pages/Painel.tsx`

Reescreve o placeholder atual. Renderiza 3 seções verticais:

1. **Hero**
2. **KPIs grid**
3. **Próximos sorteios card**

Tudo dentro de `<div className="p-6 space-y-6">` (padding e gap padrão das outras páginas).

### 1. Hero

Componente inline (não vale extrair pra um arquivo só). Estrutura:

```tsx
<div style={{
  background: 'var(--grad-brand-deep)',
  borderRadius: 22,
  padding: '32px 36px',
  color: '#fff',
}}>
  <div className="eyebrow text-white/80 mb-2">VISÃO GERAL</div>
  <h1 className="text-3xl font-bold mb-2">Olá, {user?.nome ?? user?.email ?? 'admin'}!</h1>
  <p className="text-sm text-white/80 mb-5 max-w-xl">
    Acompanhe o estado das competições e prepare o próximo sorteio.
  </p>
  <div className="flex flex-wrap gap-3">
    <button onClick={handleCongresso} className="...">
      <Trophy size={16} /> Modo Congresso
    </button>
    <button onClick={() => navigate('/eventos/novo')} className="...">
      <Plus size={16} /> Novo evento
    </button>
  </div>
</div>
```

Botões:
- "Modo Congresso": fundo branco semi-transparente, mesma lógica da Topbar (`requestFullscreen` + `navigate('/congresso')`).
- "+ Novo evento": fundo `--accent` (esmeralda) ou ghost. Navega `/eventos/novo`.

Estilos via classes `btn` do design system + cores explícitas inline para contraste no gradiente escuro.

### 2. KPI cards

4 cards no grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4`. Cada card:

```tsx
function KpiCard({ icon: Icon, eyebrow, valor, gradient }: {...}) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div style={{ background: gradient, padding: 12, borderRadius: 12, display: 'inline-flex' }}>
        <Icon size={22} color="#fff" />
      </div>
      <div>
        <div className="eyebrow text-[var(--t3)]">{eyebrow}</div>
        <div className="text-3xl font-black tabular-nums text-[var(--t1)]">{valor}</div>
      </div>
    </div>
  )
}
```

Os 4 KPIs:
| Eyebrow | Valor | Icon | Gradient | Query |
|---|---|---|---|---|
| COMPETIÇÕES | `competicoes.length` | `Trophy` | `--grad-brand` | `competicoesService.listar()` |
| EVENTOS | `eventos.length` | `Evento` (Calendar) | `--grad-success` | `eventosService.listar()` |
| PARTICIPANTES | `participantes.length` | `Cadastro` (Users) | `--grad-info` | `participantesService.listar()` |
| SORTEIOS REALIZADOS | `sorteios.length` | `Dice` | `--grad-violet` | `sorteiosService.listar()` |

Loading state: mostra `—` no valor. Não bloqueia o render de toda a página.

### 3. Próximos sorteios

Card único:

```tsx
<div className="card p-5">
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-lg font-semibold text-[var(--t1)]">Próximos sorteios</h2>
    <span className="text-xs text-[var(--t3)]">{proximos.length} pendentes</span>
  </div>
  {proximos.length === 0 ? (
    <p className="text-sm text-[var(--t3)]">Nenhum sorteio pendente. Crie um evento ou ative as inscrições.</p>
  ) : (
    <ul className="divide-y divide-[var(--card-border)]">
      {proximos.slice(0, 10).map(p => (
        <li
          key={p.evento.id}
          onClick={() => navigate(`/eventos/${p.evento.id}/inscricoes`)}
          className="py-3 cursor-pointer hover:bg-[var(--card-bg-2)] -mx-2 px-2 rounded transition-colors"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-[var(--t1)]">{p.evento.nome}</div>
              <div className="text-xs text-[var(--t3)] mt-0.5">
                {p.evento.competicao.nome} · {formatDateBR(p.evento.data_hora)}
              </div>
            </div>
            <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-[var(--warn-soft)] text-[var(--warn-700)] border border-[var(--warn)]">
              {p.pendentes} {p.pendentes === 1 ? 'pendente' : 'pendentes'}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )}
</div>
```

### Derivação de "próximos sorteios"

Usa `useMemo` sobre 4 queries:
- `eventos`, `modalidades`, `sorteios`

```ts
const proximos = useMemo(() => {
  const ATIVOS = new Set(['inscricoes', 'pronto', 'parcial'])
  return eventos
    .filter(e => ATIVOS.has(e.status))
    .map(e => {
      const modsDaCompeticao = modalidades.filter(m => m.competicao_id === e.competicao_id)
      const sorteadasIds = new Set(
        sorteios.filter(s => s.evento_id === e.id).map(s => s.modalidade_id)
      )
      const pendentes = modsDaCompeticao.filter(m => !sorteadasIds.has(m.id)).length
      return { evento: e, pendentes }
    })
    .filter(p => p.pendentes > 0)
    .sort((a, b) => new Date(a.evento.data_hora).getTime() - new Date(b.evento.data_hora).getTime())
}, [eventos, modalidades, sorteios])
```

### Data fetching

```ts
const { data: competicoes = [] } = useQuery({ queryKey: ['competicoes'], queryFn: competicoesService.listar })
const { data: eventos = [] } = useQuery({ queryKey: ['eventos'], queryFn: () => eventosService.listar() })
const { data: participantes = [] } = useQuery({ queryKey: ['participantes'], queryFn: participantesService.listar })
const { data: sorteios = [] } = useQuery({ queryKey: ['sorteios'], queryFn: () => sorteiosService.listar() })
const { data: modalidades = [] } = useQuery({ queryKey: ['modalidades'], queryFn: () => modalidadesService.listar() })
```

5 queries em paralelo. Cache compartilhado com outras páginas (mesmas chaves).

### Auth store

Acessa `useAuthStore()` para `user.nome` ou `user.email` no hero. Se ambos undefined, mostra "admin".

## Release

- `package.json`: `1.12.0` → `1.13.0` (MINOR).
- `CHANGELOG.md`: bloco `[1.13.0]` com `Added` (Painel real substitui placeholder).

## Smoke pós-deploy

1. Login admin. Sidebar → "Painel" (já é a rota raiz após login).
2. Hero aparece com saudação "Olá, {nome}!" e 2 botões CTA.
3. Click "Modo Congresso" → entra fullscreen + navega `/congresso`. Voltar.
4. Click "+ Novo evento" → navega `/eventos/novo`. Voltar.
5. 4 KPI cards mostram valores (números reais do DB). Tabular-nums.
6. "Próximos sorteios" lista eventos ativos com pendentes. Click num item → navega `/eventos/:id/inscricoes`.
7. Se DB estiver vazio: empty state amigável.
8. Rodapé sidebar: `v1.13.0`.

## Risco / efeitos colaterais

- **Performance**: 5 queries em paralelo, todas sem paginação. Em DBs maiores (1000+ participantes), pode ficar lento. Aceito por enquanto — quando virar gargalo, otimização vai pra F1b junto com cache mais agressivo.
- **`participantesService.listar()` sem filtro**: retorna todos. Reusa cache se outra página já carregou.
- **Cache compartilhado**: invalidar `['eventos']` em F2 também atualiza o painel. Bom — coerência grátis.
- **"data_hora" pode estar no passado**: ordenação ASC mostra eventos atrasados no topo se status ainda for ativo. Aceito — operador vê eventos perdidos.
- **Auth user shape**: depende da estrutura armazenada em `useAuthStore`. Se `nome` não existir, fallback para `email` cobre.
