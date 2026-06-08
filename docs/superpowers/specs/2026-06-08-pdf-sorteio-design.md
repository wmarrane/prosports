# Imprimir PDF do sorteio (bloco Sorteio em Eventos) — Design

**Data:** 2026-06-08
**Status:** Aprovado (conteúdo completo) — aguardando revisão da spec

## Objetivo

Adicionar, no bloco **Sorteio** da tela de inscrições do evento
(`frontend/src/pages/eventos/EventoInscricoes.tsx`), um botão **PDF** que imprime
o sorteio da **modalidade selecionada** usando o print-to-PDF do navegador
(`window.print()`), sem biblioteca externa (custo zero, padrão já usado no Modo
Congresso).

## Escopo

- **Só a modalidade selecionada** (a que está aberta no bloco Sorteio).
- Botão aparece **apenas quando há sorteio** (`sorteioDaModalidade` existe) e a
  modalidade **não é** `especifico`.
- Fora de escopo (YAGNI): imprimir todas as modalidades de uma vez; PDF
  server-side; biblioteca de PDF.

## Conteúdo do PDF (nesta ordem)

1. **Cabeçalho com logo** Montana (`/montana/simbolo.png` ou `<LogoMontana>`).
2. **Dados:** nome do evento · modalidade · tipo · cidade/local/data · **seed**.
3. **O sorteio** (núcleo): `SorteioGrupos` / `SorteioChaves` / `SorteioOrdem`
   conforme `sorteioDaModalidade.tipo`, reusando os componentes já existentes e
   os mesmos `participantesById` / `campeoesByParticipanteId` / `subtituloLine` /
   `anfitriaoPid` já disponíveis na página.
4. **Campeões do ano anterior** (se houver) — pódio que semeou as cabeças.
5. **Inscritos** da modalidade (lista).

## Arquitetura

Componente de impressão dedicado, renderizado **escondido na tela** e visível
**só na impressão** — evita brigar com o layout/cores do bloco on-screen.

- **Novo componente** `frontend/src/pages/eventos/SorteioPrint.tsx`
  (ou inline em EventoInscricoes; preferir arquivo próprio por clareza).
  Props: `evento`, `modalidade` (nome+tipo), `sorteio`, `participantesById`,
  `campeoesByParticipanteId`, `subtituloLine`, `anfitriaoPid`, `inscricoes`,
  `campeoes`.
  Renderiza um container `<div className="sorteio-print">` com: cabeçalho (logo +
  dados + seed), o componente de sorteio, campeões e inscritos.

- **Botão PDF** no cabeçalho do card Sorteio (ao lado de "Re-sortear"/"Apagar"),
  `onClick={() => window.print()}`, ícone `Report`, classe `no-print`.

- **CSS de impressão** (novo bloco em `frontend/src/styles/...` ou App.css):
  ```css
  .sorteio-print { display: none; }            /* escondido na tela */
  @media print {
    body * { visibility: hidden !important; }
    .sorteio-print, .sorteio-print * { visibility: visible !important; }
    .sorteio-print {
      display: block !important;
      position: absolute; left: 0; top: 0; width: 100%; padding: 24px;
      background: #fff; color: #0f172a;
      /* força paleta clara independentemente do tema atual */
      --t1: #0f172a; --t2: #1e293b; --t3: #475569; --t4: #94a3b8;
      --card-bg: #fff; --card-bg-2: #f8fafc; --card-border: #e2e8f0;
      --warn: #b45309; --brand-500: #1061d8;
    }
    .no-print { display: none !important; }
  }
  ```
  As sobrescritas de variáveis CSS no escopo `.sorteio-print` garantem que os
  componentes de sorteio (que usam `var(--card-bg-2)`, `var(--t1)`, `var(--warn)`
  etc., inclusive via classes Tailwind `bg-[var(--...)]`) saiam **legíveis no
  papel** mesmo se o tema da tela estiver escuro.

## Casos de borda

- Sem sorteio na modalidade → botão PDF não aparece (e o `.sorteio-print` não é
  renderizado).
- Modalidade `especifico` → sem botão (não há sorteio).
- `chaves` muito grande → o navegador pagina; aceitável (mesma limitação do Modo
  Congresso).

## Testes

- Render: `renderToStaticMarkup`/RTL de `SorteioPrint` com um sorteio de fixture
  (grupos e chaves) gera HTML contendo o nome do evento, a seed e nomes de
  participantes.
- Manual: abrir EventoInscricoes com uma modalidade sorteada → clicar PDF →
  conferir no preview de impressão que sai só o bloco, com logo/dados/sorteio/
  campeões/inscritos e cores claras.

## Não-objetivos

- Não altera o backend.
- Não adiciona dependências.
