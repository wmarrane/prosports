# F4c — Workspace UI — Design

**Data:** 2026-05-30
**Status:** Aprovado para implementação
**Versão alvo:** 1.10.0
**Sub-projeto pai:** F4 Workspace (decomposto em F4a Inscrições → F4b Motor + persistência → **F4c Workspace UI**)

## Objetivo

Frontend-only: expandir a tela `/eventos/:id/inscricoes` (criada em F4a) para incluir a seção de sorteio por modalidade, consumindo os endpoints `POST /sorteios/executar`, `GET /sorteios?evento_id=X`, `DELETE /sorteios/:id` (criados em F4b). Indicador de progresso (N de M sorteadas) no topo. Visualização dedicada do resultado por tipo de disputa.

## Escopo

- **In:**
  - Tipo `Sorteio` + service frontend (`listar`, `executar`, `remover`).
  - Indicador de progresso no header (X/Y sorteadas).
  - Selo verde na chip da modalidade que já foi sorteada.
  - Seção "Sorteio" na página: botão sortear (ou re-sortear com confirm; ou apagar com confirm; ou aviso para tipo `especifico`).
  - 3 componentes de visualização: `SorteioGrupos`, `SorteioChaves`, `SorteioOrdem`.
  - Tratamento de error states (400 inline).
- **Out:**
  - Animações spin / stagger reveal (handoff descreve mas adicionam trabalho — fica para iteração futura).
  - Botões "Agendar congresso" / "Publicar congresso" / "Exportar PDF".
  - Modo Congresso (F6 — projeto separado).
  - Mudança de URL/rota (mantém `/eventos/:id/inscricoes`).
  - Mudanças no backend (tudo já existe em F4b).

## Arquitetura

### Estrutura de arquivos

**Frontend — Create:**
- `frontend/src/types/sorteio.ts` — tipo `Sorteio` com union discriminada por `tipo`.
- `frontend/src/services/sorteios.ts` — `sorteiosService.{listar, executar, remover}`.
- `frontend/src/components/sorteio-result/SorteioGrupos.tsx` — render do tipo `grupos`.
- `frontend/src/components/sorteio-result/SorteioChaves.tsx` — render do tipo `chaves`.
- `frontend/src/components/sorteio-result/SorteioOrdem.tsx` — render do tipo `ordem_entrada`.

**Frontend — Modify:**
- `frontend/src/pages/eventos/EventoInscricoes.tsx` — adicionar seção "Sorteio" abaixo da seção de inscritos + indicador de progresso no header + selo nas chips.

**Release:**
- `package.json` (root): `1.9.0` → `1.10.0`.
- `CHANGELOG.md`: bloco novo `[1.10.0]`.

### Tipo `Sorteio` (discriminado)

```ts
import type { TipoDisputa } from './modalidade'

export type GruposResultado = {
  regra_id: number
  classificados_por_grupo: number
  grupos: { letra: string; participantes: number[] }[]
}

export type ChavesResultado = {
  size: number
  slots: (number | null)[]
}

export type OrdemResultado = {
  ordem: number[]
}

type SorteioBase = {
  id: number
  evento_id: number
  modalidade_id: number
  seed: string
  gerado_em: string
  atualizado_em: string
}

export type Sorteio =
  | (SorteioBase & { tipo: 'grupos'; resultado: GruposResultado })
  | (SorteioBase & { tipo: 'chaves'; resultado: ChavesResultado })
  | (SorteioBase & { tipo: 'ordem_entrada'; resultado: OrdemResultado })
  | (SorteioBase & { tipo: 'especifico'; resultado: unknown })  // não ocorre na prática
```

### Service

```ts
import api from './api'
import type { Sorteio } from '../types/sorteio'

const BASE = '/sorteios'

export const sorteiosService = {
  listar: (params?: { evento_id?: number; modalidade_id?: number }) =>
    api.get<Sorteio[]>(BASE, { params }).then(r => r.data),
  executar: (data: { evento_id: number; modalidade_id: number }) =>
    api.post<Sorteio>(`${BASE}/executar`, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
}
```

### Componentes de resultado

Todos recebem `participantesById: Map<number, Participante>` que vem das inscrições já carregadas na página. Renderizam dentro do design system R2P (tokens semânticos).

#### `SorteioGrupos`
```tsx
type Props = { resultado: GruposResultado; participantesById: Map<number, Participante> }
```
Render: grid `auto-fill minmax(240px, 1fr)` gap 16. Cada card:
- Header: "Grupo A" (letra grande, font-semibold) + badge sutil "X classificados"
- Lista de participantes: ul com nome (e subtítulo opcional em texto menor).
- Background: `--card-bg-2`, border `--card-border`, padding 16, radius 12.

#### `SorteioChaves`
```tsx
type Props = { resultado: ChavesResultado; participantesById: Map<number, Participante> }
```
Render: lista vertical numerada (1, 2, 3, ...). Cada item:
- Número em mono (font-mono, text-[var(--t3)], w-8).
- Nome do participante OU `<span className="text-[var(--t4)] italic">BYE</span>` se slot é `null`.

#### `SorteioOrdem`
```tsx
type Props = { resultado: OrdemResultado; participantesById: Map<number, Participante> }
```
Render: lista numerada. Para os 3 primeiros, exibir medalhas 🥇 🥈 🥉 antes do nome (text emoji). Para o restante, "4.", "5.", etc em mono.

### Modificações em `EventoInscricoes.tsx`

#### Estado novo
- `const { data: sorteios = [] } = useQuery(['sorteios', eventoId], () => sorteiosService.listar({ evento_id: eventoId }))`
- Derivado: `const sorteioDaModalidade = modalidadeId != null ? sorteios.find(s => s.modalidade_id === modalidadeId) : null`
- Derivado: `const modalidadesSorteadasIds = new Set(sorteios.map(s => s.modalidade_id))`
- Map: `const participantesById = new Map(inscricoes.map(i => [i.participante_id, i.participante]))`

#### Indicador de progresso no header
Logo abaixo do `<PageHeader>` (ainda dentro do mesmo container do header, antes da seção principal):
- Texto: `{modalidadesSorteadasIds.size} de {modalidades.length} modalidades sorteadas`
- Barra: div com width 100%, height 6px, bg `--card-bg-2`, com inner div proporcional bg `--brand-500`.

#### Chips de modalidade
Adicionar dentro de cada botão de chip, ao lado do nome, um pequeno selo ✓ verde quando `modalidadesSorteadasIds.has(m.id)`. Ex: `<span className="ml-1 text-[var(--success)]">✓</span>`.

#### Seção "Sorteio" (abaixo da seção atual de inscritos)
Renderizada apenas quando `modalidadeId != null`. Estrutura:

```tsx
<div className="border-t border-[var(--card-border)] pt-5">
  <h2 className="text-sm font-medium text-[var(--t2)] mb-3">Sorteio</h2>
  {tipoDaModalidade === 'especifico' ? (
    <p className="text-sm text-[var(--t3)]">Esta modalidade não possui sorteio automático.</p>
  ) : sorteioDaModalidade ? (
    <ResultadoView sorteio={sorteioDaModalidade} participantesById={...} onResortear={...} onApagar={...} />
  ) : (
    <BotaoSortear
      disabled={inscricoes.length === 0}
      onClick={handleSortear}
      pending={executando}
      erro={erroSorteio}
    />
  )}
</div>
```

`tipoDaModalidade` vem de `modalidades.find(m => m.id === modalidadeId)?.tipo_modalidade?.tipo`. Backend já inclui `tipo_modalidade` no `modalidades.service.listar` (confirmado: `INCLUDE = { competicao: true, tipo_modalidade: true } as const`), e o frontend já tipa `Modalidade.tipo_modalidade: TipoModalidade` com `tipo: TipoDisputa`.

#### Mutations
```ts
const { mutate: sortear, isPending: executando } = useMutation({
  mutationFn: () => sorteiosService.executar({ evento_id: eventoId, modalidade_id: modalidadeId! }),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sorteios', eventoId] }),
  onError: (err: any) => setErroSorteio(err?.response?.data?.message ?? 'Erro ao sortear.'),
})

const { mutate: apagarSorteio } = useMutation({
  mutationFn: (id: number) => sorteiosService.remover(id),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sorteios', eventoId] }),
  onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao apagar.'),
})
```

#### Handlers
- `handleSortear()` → `sortear()`.
- `handleResortear()` → `if (confirm('Re-sortear esta modalidade? Isso vai sobrescrever o resultado atual com uma nova seed.')) sortear()`.
- `handleApagar(id)` → `if (confirm('Apagar o sorteio? A próxima execução vai gerar um novo do zero.')) apagarSorteio(id)`.

#### Bloco do resultado (inline na página ou em sub-componente)
```tsx
<div>
  <div className="flex justify-between items-center mb-3">
    <div className="text-xs text-[var(--t3)]">
      seed: <span className="font-mono">{sorteio.seed}</span> · gerado em {formatDateBR(sorteio.gerado_em)}
    </div>
    <div className="flex gap-2">
      <button onClick={handleResortear} className="text-xs text-[var(--brand-500)] hover:text-[var(--brand-400)]">Re-sortear</button>
      <button onClick={() => handleApagar(sorteio.id)} className="text-xs text-[var(--danger)] hover:text-[var(--danger-700)]">Apagar sorteio</button>
    </div>
  </div>
  {sorteio.tipo === 'grupos' && <SorteioGrupos resultado={sorteio.resultado} participantesById={participantesById} />}
  {sorteio.tipo === 'chaves' && <SorteioChaves resultado={sorteio.resultado} participantesById={participantesById} />}
  {sorteio.tipo === 'ordem_entrada' && <SorteioOrdem resultado={sorteio.resultado} participantesById={participantesById} />}
</div>
```

### Comportamento e edge cases

- **0 inscritos:** botão "Sortear" disabled, texto auxiliar "Adicione participantes antes de sortear."
- **Modalidade `especifico`:** sem botão, só o aviso.
- **Modalidade `grupos` sem regra para N:** botão habilitado, mas o POST retorna 400 amigável — exibido em `erroSorteio` abaixo do botão.
- **Re-sortear sem confirm:** impossível pela UI (confirm sempre antes).
- **Apagar sorteio:** confirm + DELETE; sucesso volta para o estado "sem sorteio" (botão Sortear reaparece).
- **Trocar de modalidade durante uma execução de sortear:** a mutation é por modalidade selecionada; trocar antes da resposta não causa corrupção (cada execução é stateless). O resultado vai pra cache do React Query e o display da nova modalidade atualiza independente.
- **Nome de participante não encontrado no map** (raro — só se o pool mudou após sortear): exibir "—" ou "Participante removido" para não quebrar render.

## Risco / efeitos colaterais

- ~~Suposição: `modalidadesService.listar` retorna `tipo_modalidade` populado.~~ Verificado: vem populado (include default no backend).
- **Participantes do pool vs do sorteio**: a página usa as inscrições da modalidade selecionada para montar `participantesById`. Se o pool muda APÓS o sorteio (alguém é removido), o sorteio mantém os IDs antigos e a UI pode exibir nomes em branco. Aceito por enquanto — comportamento esperado em F4b (sorteio é snapshot).
- **Performance**: `GET /sorteios?evento_id=X` retorna todos os sorteios do evento (no máximo N modalidades). Não paginado, fine.
- **Sem cabeças de chave / regras extras**: as visualizações `SorteioChaves` e `SorteioGrupos` exibem ordem aleatória pura, sem destacar seeds (não temos esse dado).

## Release

- `package.json`: `1.9.0` → `1.10.0` (MINOR).
- `CHANGELOG.md`: bloco `[1.10.0]` com `Added` (seção sorteio na tela, 3 componentes visuais, indicador de progresso, selo em chips).

## Smoke pós-deploy

1. Login admin.
2. /eventos → click "Inscrições" em algum evento. Header mostra "0 de N modalidades sorteadas" (ou similar).
3. Selecionar modalidade `grupos` que tenha inscritos e regra cadastrada → seção "Sorteio" abaixo dos inscritos com botão "Sortear esta modalidade".
4. Click "Sortear" → grid de cards (Grupo A, B, ...) com nomes dos participantes aparece. Header de seção mostra seed em mono + data + botões "Re-sortear" / "Apagar sorteio".
5. Chip da modalidade ganha ✓ verde. Header atualiza para "1 de N".
6. "Re-sortear" → confirm → nova seed, nova distribuição.
7. "Apagar sorteio" → confirm → volta para botão Sortear. Chip perde ✓.
8. Selecionar modalidade `chaves` (criar uma se preciso) → sortear → lista numerada com slots e BYEs onde aplicável.
9. Selecionar modalidade `ordem_entrada` → sortear → lista numerada com medalhas nos 3 primeiros.
10. Selecionar modalidade `especifico` → aviso aparece, sem botão.
11. Modalidade sem regra de grupos para N atual → POST 400 → mensagem inline abaixo do botão.
12. Footer da sidebar mostra `v1.10.0`.
