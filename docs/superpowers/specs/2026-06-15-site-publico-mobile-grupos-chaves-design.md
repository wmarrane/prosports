# Site público mobile: grupos e chaves legíveis e roláveis — Design

**Data:** 2026-06-15
**Status:** Aprovado (aguardando revisão da spec)

## Problema

Na página de evento do site público, ao acessar pelo celular, grupos e chaves ficam com péssima visualização e "as barras de rolagem não estão ativas". Verificado no evento publicado (`https://newprosports-publico.web.app/evento-9.html`) em viewport de 375px:

- **Grupos:** a grade resolve para uma coluna de **360px** dentro de um container de **289px**, com `overflow: visible`. Como `body { overflow-x: hidden }` (site.css:10) corta o transbordo, os cards de grupo ficam **cortados à direita e sem como rolar**.
- **Chaves (`BracketTree`):** o wrapper já tem `overflow-x: auto` e **é rolável por toque** (clientW 289 / scrollW até 972). Mas a árvore é grande (canvas até 940px, cards de 260px com tipografia `large`), exigindo muito arrasto, sem dica visual de rolagem; e brackets de um único jogo (canvas 260px) rolam à toa em vez de caber.

## Restrição técnica

O site público é **HTML 100% estático** (`frontend/scripts/build-site-publico.tsx` via `renderToStaticMarkup`, sem JS no cliente — só `/site-bundle.css`). Logo, **a responsividade é exclusivamente por CSS**; não há como trocar layout/medidas por viewport em runtime via JS. As posições do `BracketTree` são px absolutos calculados no build, então a única forma CSS de compactar a árvore sem desalinhar os conectores é uma **escala uniforme** (`zoom`/`transform`).

## Decisões

1. **Grupos: reflow responsivo.** Trocar a coluna fixa por uma que nunca ultrapasse a largura da tela, reflowando para 1 coluna no celular. Legível, sem rolagem.
2. **Chaves: compactar + manter rolagem.** Reduzir a árvore no mobile (escala uniforme) para caber mais e ficar legível; manter `overflow-x: auto` + rolagem por toque para chaves que ainda passem da largura.
3. **Folga de leitura no mobile:** reduzir o padding do corpo do card no celular.

## Mudanças por arquivo

### `frontend/src/components/sorteio-result/SorteioGrupos.tsx` (compartilhado com admin)
A grade usa, em modo `large`, `minmax(360px, 1fr)` (linha ~31, via `minCol`). Trocar a coluna para usar `min(<minCol>px, 100%)`:

```tsx
// antes
<div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${minCol}px, 1fr))`, gap }}>
// depois
<div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(min(${minCol}px, 100%), 1fr))`, gap }}>
```

`min(360px, 100%)` = 360px quando o container ≥ 360px (desktop inalterado) e = 100% quando menor (celular: 1 coluna que cabe). Benefício colateral seguro no admin (preview inline, `minCol` 240, também deixa de transbordar em painéis estreitos). Sem mudança visual em telas largas.

### `frontend/src/components/sorteio-result/BracketTree.tsx` (compartilhado com admin)
Hoje o wrapper externo e o canvas usam apenas estilos inline. Adicionar `className` para permitir o ajuste por media query, **sem remover os estilos inline existentes**:

- Wrapper externo (linha ~258): adicionar `className="bracket-scroll"`.
- Canvas interno (linha ~259): adicionar `className="bracket-canvas"`.

Nenhuma mudança de medida/lógica no componente — só ganchos de classe. O admin não é afetado porque o ajuste fica numa media query do CSS do site público.

### `frontend/src/site-publico/site.css`
Adicionar um bloco mobile (`@media (max-width: 720px)`) que:

1. **Compacta a árvore de chaves** com escala uniforme:
```css
@media (max-width: 720px) {
  .bracket-canvas { zoom: 0.72; }
}
```
`zoom` reflowa o box (a largura ocupada e o `scrollWidth` acompanham a escala — sem espaço morto), e escala coerentemente cards + SVG dos conectores. Brackets pequenos passam a caber; grandes continuam roláveis pelo `overflow-x: auto` do `.bracket-scroll`. **O fator (0.72) é calibrado na verificação** olhando legibilidade × quanto cabe; se `zoom` apresentar problema em algum navegador alvo, o fallback é `transform: scale(...)` com wrapper dimensionado.

2. **Garante rolagem suave por toque** no wrapper:
```css
.bracket-scroll { -webkit-overflow-scrolling: touch; }
```

3. **Reduz o padding do corpo do card no mobile** (hoje fixo em 22px):
```css
@media (max-width: 720px) {
  .mod-body { padding: 14px; gap: 16px; }
}
```

4. **Listas de inscritos/campeões:** as grades usam `minmax(220px, 1fr)` (site.css:309) e transbordam em telas bem estreitas. Trocar por `minmax(min(220px, 100%), 1fr)`.

## Verificação

- `npm run build` (frontend; `tsc -b && vite build`).
- Servir o `dist-site` localmente (ou re-publicar) e abrir `evento-9.html` em viewport mobile (Playwright, ~375px). Conferir:
  - Grupos: reflow para 1 coluna, sem corte, sem rolagem horizontal.
  - Chaves pequenas: cabem sem rolar; chaves grandes: arrastam horizontalmente até o fim.
  - Tipografia das chaves legível após a escala (calibrar o fator).
- Conferir no desktop (≥ 720px) que nada mudou (grupos a 360px, chaves em tamanho `large`).

## Efeito do snapshot

São mudanças de frontend/CSS do site público. O site é estático: as páginas só passam a refletir o novo CSS quando o build do site rodar. O `site-bundle.css` é regenerado no build; **re-publicar o evento** (ou re-disparar o build do site) aplica as mudanças. Sem backend/migration.

## Fora de escopo

- Redesenhar o bracket ou mudar a lógica de layout/sorteio.
- Tornar o site público uma SPA hidratada (continua estático).
- Ajustes de mobile em outras telas do site público além da página de evento.
- Dica visual elaborada de rolagem (fade/seta) — fora do mínimo; a escala já faz a maioria caber e os grandes mostram corte no canto indicando mais conteúdo.
