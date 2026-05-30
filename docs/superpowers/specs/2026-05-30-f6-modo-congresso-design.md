# F6 — Modo Congresso (MVP) — Design

**Data:** 2026-05-30
**Status:** Aprovado para implementação
**Versão alvo:** 1.12.0

## Objetivo

Frontend-only. Tela fullscreen dedicada à apresentação ao vivo de sorteios em Datashow. Wizard 4 passos (Evento → Modalidade → Participantes → Sorteio), tipografia grande, navegação linear, sem chrome do app. Reutiliza todos os endpoints e componentes já existentes (F2/F4a/F4b/F4c).

## Escopo

- **In:**
  - Rota `/congresso` sem o `Layout` padrão (entrega tela cheia limpa).
  - Wizard com state machine 4 passos. Navegação linear ("Voltar" no header; click no card avança).
  - Fullscreen API: gatilho via botão "Modo Congresso" da topbar; toggle e exit dentro da página.
  - Reutilização dos 3 componentes de resultado (`SorteioGrupos`, `SorteioChaves`, `SorteioOrdem`) com prop nova `large?: boolean` para Datashow.
  - Botão "Modo Congresso" da topbar deixa de ser placeholder.
- **Out:**
  - Paginação dinâmica calculada por viewport (passo 3 usa scroll natural).
  - Modais (picker incluir, log alterações, expandir grupo, confirm com semente visível).
  - Edição de participantes no passo 3 (read-only).
  - Print PDF do resultado.
  - Theme toggle próprio do congresso (herda o do app).
  - Animações `spin`/`stagger`.
  - Restos do handoff (Bell, Search etc dentro do congresso).

## Arquitetura

### Rota e shell

`/congresso` fica **fora** do `<Layout>` (que tem sidebar+topbar), mas **dentro** do `<ProtectedRoute>`. Estrutura em `App.tsx`:

```tsx
<Route element={<ProtectedRoute />}>
  <Route path="/congresso" element={<ModoCongresso />} />
  <Route element={<Layout />}>
    {/* ... demais rotas existentes ... */}
  </Route>
</Route>
```

A página `ModoCongresso` renderiza seu próprio shell (header dedicado + área de conteúdo).

### Trigger

`Topbar.tsx`: trocar o `handleCongresso` atual (que faz `alert`) por:

```ts
async function handleCongresso() {
  try {
    await document.documentElement.requestFullscreen()
  } catch {
    // Usuário pode ter negado; segue mesmo assim.
  }
  navigate('/congresso')
}
```

O click do usuário satisfaz o requisito de user gesture do `requestFullscreen()`.

### State machine

```ts
type CongressoStep = 'evento' | 'modalidade' | 'participantes' | 'sorteio'

const [step, setStep] = useState<CongressoStep>('evento')
const [eventoId, setEventoId] = useState<number | null>(null)
const [modalidadeId, setModalidadeId] = useState<number | null>(null)
const [erroSorteio, setErroSorteio] = useState('')
const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement)
```

Recarregar a página perde o estado — aceito (apresentação ao vivo é uma sessão).

### Header dedicado

Altura ~60px, dark-on-light invariante (independente do theme):
- Esquerda: marca "Congresso" (texto grande font-mono ou tipográfico). Se step > 0, botão "← Voltar".
- Centro: indicador "Passo X de 4 · NomeDoStep". **Não clicável** (só visual).
- Direita: botão fullscreen toggle (Maximize/Minimize do lucide) + botão "Sair" (sai fullscreen + navega `/eventos`).

Listener `fullscreenchange` na montagem:
```ts
useEffect(() => {
  const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
  document.addEventListener('fullscreenchange', onFsChange)
  return () => document.removeEventListener('fullscreenchange', onFsChange)
}, [])
```

### Passos

#### 0. Evento (`step === 'evento'`)

- Query `useQuery(['eventos'], eventosService.listar)`. Filtrar `e.status !== 'rascunho'` no client (handoff ativos).
- Render: grid de cards grandes (`auto-fill minmax(380px, 1fr)`, gap 20). Cada card grande contém:
  - Nome do evento (font 24-28px)
  - Competição + cidade (font ~14px texto secundário)
  - Data formatada
  - Status badge
- Click no card: `setEventoId(e.id); setStep('modalidade')`.
- Empty state: "Nenhum evento ativo. Crie um evento e mude status para 'inscrições'."

#### 1. Modalidade (`step === 'modalidade'`)

- Queries:
  - `useQuery(['eventos', eventoId], () => eventosService.buscar(eventoId!))` para o cabeçalho (nome + competição).
  - `useQuery(['modalidades', evento.competicao_id], () => modalidadesService.listar({ competicao_id }))`.
  - `useQuery(['sorteios', eventoId], () => sorteiosService.listar({ evento_id: eventoId! }))` para selo "Sorteado".
- Derivado: `modalidadesSorteadasIds = new Set(sorteios.map(s => s.modalidade_id))`.
- Render: lista vertical de cards. Cada card:
  - Nome + sigla (font ~22px)
  - Label do `tipo_modalidade.tipo` via `TIPO_DISPUTA_LABEL`
  - Selo verde "✓ Sorteado" se na set
- Click no card: `setModalidadeId(m.id); setStep('participantes')`.

#### 2. Participantes (`step === 'participantes'`)

- Query `useQuery(['inscricoes', eventoId, modalidadeId], ...)`.
- Render:
  - Header de seção: nome da modalidade + "X inscritos"
  - Lista vertical com nome (font ~18-20px) e subtítulo (font menor) — read-only.
  - Footer: botão "Próximo →" (avança para `sorteio`).
- Empty state: "Nenhum inscrito nesta modalidade." (sem botão de inscrever).
- Scroll natural (sem paginação dinâmica nesta sub-fase).

#### 3. Sorteio (`step === 'sorteio'`)

- Query `useQuery(['sorteios', eventoId])` (já carregada antes) → `sorteioDaModalidade = sorteios.find(s => s.modalidade_id === modalidadeId)`.
- Derivado: `tipo = modalidades.find(m => m.id === modalidadeId)?.tipo_modalidade.tipo`.
- Derivado: `participantesById` construído a partir das inscrições já carregadas.
- Render condicional:
  - `tipo === 'especifico'`: mensagem grande "Esta modalidade não possui sorteio automático." + botão "Próxima modalidade →" (volta pro step 1).
  - Sem sorteio: botão grande "Realizar sorteio" → mutation `sorteiosService.executar` (com `setErroSorteio` em onError).
  - Com sorteio: header com seed em mono + "Novo sorteio" (com `confirm()`) + render do resultado pelo componente apropriado (`SorteioGrupos|Chaves|Ordem` com prop `large`) + botão "Próxima modalidade →" no rodapé.
- Botão "Próxima modalidade" → `setModalidadeId(null); setStep('modalidade')`. Não altera `eventoId`. O selo na modalidade recém-sorteada aparece automaticamente pelo invalidate.

### Componentes de resultado — prop `large`

Adicionar prop opcional aos 3 componentes existentes:

```tsx
type Props = {
  resultado: ...Resultado
  participantesById: Map<number, Participante>
  large?: boolean
}
```

Quando `large`:
- Texto principal sobe de `text-sm`/`text-base` para `text-xl`/`text-2xl`.
- Padding interno dos cards de grupo aumenta de `p-4` para `p-6`.
- `SorteioGrupos` usa grid `minmax(360px, 1fr)` em vez de `minmax(240px, 1fr)`.
- Margens entre itens aumentam.

Implementação: `className` dinâmico baseado em `large`.

### Tipo

`frontend/src/types/congresso-step.ts`:

```ts
export type CongressoStep = 'evento' | 'modalidade' | 'participantes' | 'sorteio'
```

### Sem novos endpoints / sem migrations

Tudo reutiliza F2/F4a/F4b/F4c. Zero mudança no backend.

## Visual

Tipografia grande, alto contraste, **invariante ao tema** dentro do `/congresso` (fundo escuro fixo, texto claro fixo — para projeção em Datashow funcionar bem na sala). Tons:
- Background: `--app-bg` ainda dá, mas **forçar** `data-theme="dark"` no `<html>` ao montar `/congresso` e restaurar ao desmontar **NÃO** — isso bagunça outras abas. Decisão: usar tokens normais (`--app-bg`, `--t1`, etc) e contar que o operador deixou no dark antes de abrir. Documentar no smoke.

Atualização: para garantir alto contraste sem efeitos colaterais, definir um wrapper com tokens locais:

```css
.congresso-shell {
  background: #0a0e16;
  color: #f1f5fb;
  min-height: 100vh;
}
```

Tokens hardcoded no componente (inline style ou classe nova). Independe do theme do app.

## Implementação — File Structure

**Frontend — Create:**
- `frontend/src/types/congresso-step.ts` — tipo `CongressoStep`.
- `frontend/src/pages/congresso/ModoCongresso.tsx` — página principal com state machine.
- `frontend/src/pages/congresso/CongressoStepEvento.tsx` — passo 0.
- `frontend/src/pages/congresso/CongressoStepModalidade.tsx` — passo 1.
- `frontend/src/pages/congresso/CongressoStepParticipantes.tsx` — passo 2.
- `frontend/src/pages/congresso/CongressoStepSorteio.tsx` — passo 3.
- `frontend/src/pages/congresso/CongressoShell.tsx` — header + wrapper visual.

**Frontend — Modify:**
- `frontend/src/App.tsx` — adicionar rota `/congresso` fora do `Layout`.
- `frontend/src/components/Topbar.tsx` — trocar `handleCongresso` (remove alert, faz fullscreen + navigate).
- `frontend/src/components/sorteio-result/SorteioGrupos.tsx` — adicionar prop `large?: boolean`.
- `frontend/src/components/sorteio-result/SorteioChaves.tsx` — idem.
- `frontend/src/components/sorteio-result/SorteioOrdem.tsx` — idem.

**Release:**
- `package.json` (root): `1.11.0` → `1.12.0`.
- `CHANGELOG.md`: bloco `[1.12.0]`.

## Smoke pós-deploy

1. Login admin.
2. Topbar → "Modo Congresso". Browser pede permissão de fullscreen (primeira vez). Aprova. Navega para `/congresso` em fullscreen.
3. Passo 0: cards de eventos ativos. Selecionar um.
4. Passo 1: lista de modalidades. Modalidades sem sorteio aparecem normais; já sorteadas têm selo ✓. Selecionar uma sem sorteio.
5. Passo 2: lista dos inscritos. Botão "Próximo →".
6. Passo 3: tipo grupos → botão "Realizar sorteio" → cards grandes de grupo aparecem com nomes em fonte grande. Header mostra seed.
7. Botão "Próxima modalidade →" no rodapé → volta pro passo 1. Modalidade anterior agora tem selo ✓.
8. Selecionar outra modalidade tipo `especifico` → step 3 mostra mensagem + "Próxima modalidade".
9. Botão fullscreen toggle no header → sai/entra fullscreen.
10. Botão "Sair" → sai fullscreen + volta para `/eventos`.
11. Tentar reabrir Modo Congresso com tipo `chaves` ou `ordem_entrada` → resultado renderiza com fonte grande.
12. Rodapé sidebar (após sair): `v1.12.0`.

## Risco / efeitos colaterais

- **Fullscreen API negada pelo browser** (permissão ou contexto não-seguro): handler já tem `try/catch` — segue para `/congresso` sem fullscreen. Operador pode usar F11 do browser como fallback.
- **Sessão perdida em refresh**: aceito. Voltar para passo 0 com toda nova navegação. Se for um problema na operação real, persistir em sessionStorage fica para iteração futura.
- **Tokens hardcoded no shell**: quebra o tema-aware do app dentro de /congresso. Justificado (Datashow). Documentado.
- **Reuse dos componentes de resultado**: prop nova `large` é opcional e default `false` — não quebra os usos atuais (F4c continua igual).
- **Sem testes vitest**: F6 é puramente UI/integração de queries existentes. Sem lógica de negócio nova para isolar. Smoke manual cobre.
- **Bug do scroll do Layout**: já corrigido em commit `5c7ceed`. `/congresso` não usa Layout, então este problema não se aplica.
- **Acessar /congresso direto via URL** (sem passar pelo botão da topbar): vai pro shell mas sem fullscreen (sem user gesture). Aceito — operador pode acionar fullscreen pelo botão interno.
