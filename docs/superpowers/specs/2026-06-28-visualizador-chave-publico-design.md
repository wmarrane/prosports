# Visualizador de chave no site público (B1) — Design

**Data:** 2026-06-28
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Sub-projeto **B1** (de dois — B2 = redesign mobile da página, separado): um **visualizador de chave** (mata-mata) no site público, conforme `personaladmin/handoff/design_handoff_evento_mobile/` (parte `BracketView`/`bracket.jsx`). Resolve a dor "chave ilegível no celular": substitui a leitura difícil da chave por um overlay com duas visões — **Por fase** (abas por rodada, ideal no toque) e **Chaveamento** (árvore com scroll horizontal).

Funciona em **celular e desktop**, independente do B2.

## Decisões aprovadas

- **Sem vencedores/campeão/pódio.** O sistema é de **sorteio**, não de resultados: o `matchesGraph` define a estrutura (quem joga quem, byes, avanço via `V:`/`L:`), mas não há vencedores gravados. Omitir a faixa de campeão (`.em-champ`) e o destaque de vencedor. Mostrar a chave sorteada.
- **Reusar o `BracketTree` existente** para a visão "Chaveamento".
- **Interatividade via `<script>` inline** (o site público é SSG puro, sem React no cliente — mesmo padrão do filtro de boletins / botão compartilhar).

## Contexto (codebase)

- Site público: SSG React (`renderToStaticMarkup` → HTML estático). **Sem runtime React no cliente**; interações usam `<script dangerouslySetInnerHTML>` (ex.: filtro de boletins, compartilhar, filtro da listagem).
- Dados de chave (no snapshot, por modalidade `tipo==='chaves'`, `status==='sorteado'`): `resultado = { size, slots: (number|null)[], byePositions?: number[], matchesGraph: { final, thirdPlace, matches: [{ id, round, top, bottom }] } }`. Refs em `top`/`bottom`: `P<n>` (posição → `slots[n-1]`), `V:<id>` (vencedor do jogo), `L:<id>` (perdedor do jogo), `BYE`. A modalidade também traz `participantes[] {id,nome,subtitulo}` e `cabecasPids: number[]`.
- Render atual de chave: `frontend/src/components/sorteio-result/SorteioChaves.tsx` → delega a `BracketTree` (`./BracketTree`) quando há `matchesGraph`. **`BracketTree` já é usado no site público hoje** (via `site-publico/components/ModalidadeSorteio.tsx`), logo é seguro reusar (Tailwind/tokens já funcionam no build público).
- `BracketTree` props: `matchesGraph, slots, participantesById: Map<number,Participante>, campeoesByParticipanteId?, anfitriaoPid?, large?, subtituloLine?, onMatchClick?, cabecasPids?`.
- Tipos: `ChavesResultado`/`MatchesGraph` em `frontend/src/types/sorteio.ts`.

## Componente — `BracketView` (`frontend/src/site-publico/components/BracketView.tsx`)

Renderizado a HTML estático por modalidade elegível. Recebe a `SnapModalidade` (ou os campos derivados) e o nome do evento. Estrutura (overlay `.em-bracket-ov`, escondido por padrão; aberto pelo script):

- **Cabeçalho**: título da modalidade + botão fechar.
- **Alternância de visão** (`.em-vtog`): botões "Por fase" | "Chaveamento" com `data-view`. Por padrão "Por fase" visível.
- **Visão "Por fase"** (`data-pane="fase"`): 
  - Abas (`.em-rtabs`): uma por `round` presente (ordenado), rótulo derivado: se nº de jogos "reais" da rodada (excluindo byes) = 1 → "Final"; 2 → "Semifinal"; 4 → "Quartas"; 8 → "Oitavas"; senão "Nª Rodada". Marca a aba da **última rodada (Final)** como ativa por padrão. Cada aba/painel com `data-round`.
  - Para cada rodada, os cards (`.em-mt`): resolvem `top`/`bottom` → nome do participante (`P<n>`→`slots[n-1]`→`participantesById`), com selo de cabeça quando o pid ∈ `cabecasPids`; ou rótulo "Vencedor <id>" (`V:`), "Perdedor <id>" (`L:`), "BYE". O card cujo `id===matchesGraph.final` recebe rótulo "Final"; `id===thirdPlace` → "Disputa de 3º" (`.em-mt-ph`). **Sem** destaque de vencedor.
  - Chips de **byes** (`.em-byes`) na 1ª rodada: participantes de `byePositions` (→ `slots` → nome).
- **Visão "Chaveamento"** (`data-pane="arvore"`, escondida por padrão): `<BracketTree matchesGraph slots participantesById cabecasPids />` dentro de um container com scroll horizontal (`.em-tree` ou wrapper).
- Mapa `participantesById` montado de `modalidade.participantes`.

### Resolução de refs (helper puro, testável)
`resolveRef(ref, slots, participantesById) → { nome?: string; label?: string; pid?: number }`: `P<n>`→participante de `slots[n-1]`; `V:<id>`→`{label:'Vencedor '+id}`; `L:<id>`→`{label:'Perdedor '+id}`; `BYE`→`{label:'BYE'}`. (Extrair para um util pequeno, ex.: `lib/bracket.ts`, com teste unitário.)

## Ponto de entrada (na `EventoPage` atual)

Para cada modalidade `tipo==='chaves' && status==='sorteado'` com `resultado.matchesGraph`, adicionar um botão **"Ver chave"** dentro do corpo da modalidade (`.mod-body`), com `data-bracket="mod-<id>"`. Renderizar o `BracketView` correspondente (overlay com `id="bracket-<id>"`). O conteúdo inline atual (`ModalidadeSorteio`) permanece. Um `<script>` inline liga: clique no botão → mostra o overlay; botão fechar / Esc / clique no backdrop → esconde; cliques na alternância de visão → trocam `data-pane` ativo; cliques nas abas → trocam `data-round` ativo. Sem dados de usuário interpolados no script.

## CSS

Portar o subconjunto `.em-*` do visualizador de `personaladmin/handoff/design_handoff_evento_mobile/evento-mobile.css` para `frontend/src/site-publico/site.css`: overlay (`.em-bracket-ov`), `.em-vtog`, `.em-rtabs`/`.em-rtab`, `.em-byes`, `.em-mt`/`.em-mt-ph`, e o necessário para o container da árvore. **Manter o prefixo `.em-*`** (seguro contra o CSS global do site — ver nota do handoff sobre `.ph`). **Omitir** `.em-champ` (sem campeão). Reusar tokens; sem cores novas. (As classes da própria `EventoMobile` — app bar/hero/catbar etc. — NÃO entram aqui; são do B2.)

## Testes / Verificação

- `cd frontend && npm run build:site` sem erros; `npx vitest run src/site-publico` verde.
- **Helper `resolveRef`** (unit): `P`, `V:`, `L:`, `BYE`.
- **`BracketView`** (`renderToStaticMarkup`): resolve nomes via slots; mostra rótulos "Vencedor/Perdedor" para `V:`/`L:`; abas por rodada com a Final ativa; chips de byes; **não** renderiza faixa de campeão; presença do toggle de visão e do `BracketTree` (Chaveamento).
- **`EventoPage`**: botão "Ver chave" aparece só em modalidades `chaves`+`sorteado` com `matchesGraph`; o `<script>` de controle do overlay está presente.
- **Demo (screenshots) antes do merge na develop**: overlay "Por fase" (abas, byes) e "Chaveamento" (árvore) em desktop e mobile, usando um evento real com chave (ex.: Judô do `evento-1`).

## Fora de escopo
- Vencedores/campeão/pódio (sem dados de resultado).
- B2: redesign mobile da página (app bar, hero, navegação de esportes, busca) — projeto separado.
- Visualizador para **grupos** (handoff cita como próximo passo).
- Versão "porta a matemática de margens do protótipo" para a árvore (reusamos o `BracketTree`).

## Restrições globais
- Host Windows; ler antes de editar; caminhos absolutos. Git identity inline (`-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`).
- Validar com `npm run build:site`. Reusar tokens/classes/componentes; sem cores novas; classes do bracket sempre `.em-*`. Nunca `git add -A`.
- Demo antes da develop; promoção a prod só com confirmação do Wagner.
