# Barra de carregamento global — Design

**Data:** 2026-06-10
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Dar feedback visual de "processo em execução" em **todas as telas**, sem editar cada uma. Motivação: ao abrir um evento, os dados demoraram e, sem indicador, parecia que o sistema travou.

## Abordagem

Uma **barra de progresso global** no topo, ligada ao react-query, que aparece automaticamente em qualquer requisição/ação em andamento, em qualquer rota.

## Componente

`frontend/src/components/GlobalLoadingBar.tsx`:
- `const ativo = useIsFetching() + useIsMutating() > 0` (react-query).
- Estado `visivel` controlado por efeito com **delay anti-flicker** (~120ms): ao ficar `ativo`, agenda mostrar após 120ms; ao ficar inativo, esconde imediatamente (limpando o timer pendente). Evita piscar em respostas instantâneas/cacheadas.
- Renderiza uma barra fixa no topo (`position: fixed; top:0; left:0; width:100%; height:3px; z-index:9999`), cor `var(--brand-500)`, com **animação indeterminada** (gradiente deslizante via keyframes). Fade-out ao esconder.
- Quando não visível, não renderiza nada (ou opacity 0).

## Estilos

Em `frontend/src/styles/prosports-theme.css`: classe `.global-loading-bar` + keyframes `@keyframes glb-slide` (animação indeterminada). Cor via `var(--brand-500)`; funciona em light/dark.

## Montagem

Uma única vez em `frontend/src/App.tsx`, dentro do `ToastProvider`/`BrowserRouter` (App já está dentro do `QueryClientProvider` do `main.tsx`). Como é `position: fixed`, a posição na árvore não afeta o layout. Cobre todas as rotas: admin (Layout), Modo Congresso, mobile e login.

## Testes

- O componente usa hooks do react-query e o projeto não tem testing-library/jsdom → validação por `npm run build` (tsc) + verificação manual (abrir telas/ações e ver a barra durante o carregamento; confirmar que some ao terminar e não pisca em cargas instantâneas).

## Fora de escopo

- Padronizar/trocar os "Carregando..." textuais das telas (a barra é um reforço global; eles permanecem).
- Skeletons por tela.
- Backend / migration (nenhum).
