# Reskin de Boletins (admin + site público) — Design

**Data:** 2026-06-27
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Aplicar o design hi-fi do handoff aos Boletins, em duas pontas:
1. **Admin** — substituir o formulário cru atual (`EventoBoletins.tsx`) por um **painel** com lista de boletins estilizada e **modal "Publicar boletim"**.
2. **Site público** — substituir a seção atual (chips de filtro) por **"Boletins & documentos"**: destaque do último boletim + lista agrupada por tipo.

Escopo aprovado: **visual + alinhar o conjunto de tipos** ao design. **Fora de escopo:** status Publicado/Rascunho, contagem de páginas do PDF, registro em auditoria.

**Fonte pixel-perfect (abrir e reproduzir):** `personaladmin/handoff/design_handoff_boletins/` — `Boletins-admin.html`, `Boletins-publico.html`, `README.md`. CSS de referência: `tokens.css`, `prosports-theme.css`, `site.css` (já existentes no codebase — reusar, não reinventar).

## Contexto (codebase)

- Design system já presente: `frontend/src/styles/tokens.css` + `frontend/src/styles/prosports-theme.css` (importados em `frontend/src/main.tsx`). Classes disponíveis: `.card .btn .btn-primary .btn-ghost .btn-lg .badge .b-accent .b-warn .b-brand .b-success .b-violet .eyebrow .sec-title .dot`. **Faltam** (adicionar): `.b-neutral`, `.ibtn-sm`, `.sep`, e as classes de boletim/modal/doc.
- Site público usa `frontend/src/site-publico/site.css` (`.section .sec-head .sec-eyebrow .btn .btn-lg`). Faltam `.doc-*`. O site público é SSG (renderToStaticMarkup) — ícones podem ser `lucide-react` (renderizam SVG no build) ou SVG inline; usar `lucide-react`.
- Backend boletins (já no ar em develop): model `Boletim { numero, titulo, categoria(enum CategoriaBoletim), data_publicacao, filename, object_key, public_url, size_bytes, content_type }`; rotas ADMIN `GET/POST/DELETE /eventos/:eventoId/boletins`; snapshot carrega `boletins: { numero, titulo, categoria, data, url }[]`.
- Admin: `frontend/src/pages/eventos/EventoBoletins.tsx` (form cru), serviço `frontend/src/services/boletins.ts`. Público: `frontend/src/site-publico/pages/EventoPage.tsx` (seção atual com chips).
- Dados: dev tem **0 boletins**; prod **não** tem a feature. Trocar o enum é sem migração de dados.

## Mudanças

### 1. Tipos de boletim (enum)

Trocar `enum CategoriaBoletim` (`backend/prisma/schema.prisma`) de `Resultados/Comunicado/Tabela/Regulamento/Outros` para:

```prisma
enum CategoriaBoletim {
  Oficial
  Regulamento
  Resultados
  Convocacao
  ComunicadoErrata
}
```

- Migration Prisma (sem dados a migrar). Em dev aplicar com a cautela usual (abortar se propor reset/drift destrutivo).
- `backend/src/modules/boletins/boletins.controller.ts`: atualizar o `z.enum([...])` para os 5 valores acima.
- Frontend: um mapa único `categoria → { label, badgeClass }` reusado no admin e no público:
  - `Oficial` → label "Oficial", badge `b-brand`
  - `Regulamento` → "Regulamento", `b-violet`
  - `Resultados` → "Resultados", `b-success`
  - `Convocacao` → "Convocação", `b-warn`
  - `ComunicadoErrata` → "Comunicado / Errata", `b-neutral`
  - Local sugerido: `frontend/src/lib/boletim-categorias.ts` (export do array de opções {value,label,badgeClass,swatch} + helper de lookup), importado por `EventoBoletins.tsx` e `EventoPage.tsx`.

### 2. Admin — `EventoBoletins.tsx` (recriar) + CSS

Reproduzir `Boletins-admin.html` (Opção B). Estrutura:
- Painel `.card` com `.bol-head`: tile de ícone (`file-text`, `var(--grad-brand)`) + eyebrow "DOCUMENTOS DO EVENTO" + `.sec-title` "Boletins" + contagem ("N publicados") + botão **"Publicar boletim"** (`.btn .btn-primary`, ícone `plus`) à direita.
- `.bol-list` com `.bol-row` por boletim: selo `.pdf` (38×46), `Nº {numero}` (mono), título, meta (`.sep`-separados): **badge de tipo** + data (`toLocaleDateString('pt-BR', { timeZone: 'UTC' })`) + tamanho (formatado de `size_bytes`). Ações `.acts`: **Baixar** (`download`, link `public_url`) + kebab (`more-horizontal`) com **Remover** (chama `boletinsService.remover`).
- Estado vazio `.bol-empty` (ícone + "Nenhum boletim publicado" + CTA "Publicar primeiro boletim" que abre o modal).
- **Modal "Publicar boletim"** (estado `modalOpen`): overlay (`rgba(8,12,21,.46)` + blur) + cartão 460px; head `.mh` (tile + título + subtítulo com nome do evento + X), body `.mb` (Número+Título grid `110px 1fr`; Tipo **dropdown custom com swatches** `.fake-select`/`.type-menu` + Data `<input type="date">`; **dropzone** `.bol-drop` → `.file-chip` ao escolher PDF, valida `application/pdf` e ≤ `MAX_PDF_BYTES`), foot `.mf` ("🔒 Registrado em auditoria" — texto decorativo apenas + Cancelar + Publicar). Fecha por X/Cancelar/overlay/**Esc**. Ao publicar com sucesso: fecha, **toast** "Boletim publicado", recarrega a lista.
- Ícones: `lucide-react` (`FileText, Plus, Download, Check, Calendar, ChevronDown, MoreHorizontal, X`).
- CSS novo em `frontend/src/styles/boletins.css` (importado no `main.tsx`): portar de `Boletins-admin.html` as classes `.bol-head .bol-list .bol-row .pdf .pdf.draft? (omitir) .acts .ibtn-sm .sep .b-neutral` + modal `.mh .mb .mf .lg-input .fake-select .type-menu .bol-drop .file-chip .req` + toast. Usar tokens existentes (sem cores novas além das do selo PDF e `.b-neutral`/swatches do design).

### 3. Site público — `EventoPage.tsx` seção "Boletins & documentos" + `site.css`

Reproduzir `Boletins-publico.html`. Substituir a seção atual de boletins (remover os chips de filtro e o `<script>` de filtro) por:
- `<section class="section">` com `.sec-head` (eyebrow "ACOMPANHE" + `<h2>` "Boletins & documentos" + parágrafo).
- `.doc-layout` (grid `380px 1fr`, colapsa 1 coluna ≤940px):
  - **Destaque** `.doc-feature` (sticky desktop; estático ≤940px): flag "● ÚLTIMO BOLETIM", selo PDF grande (88×108), badge de tipo, título, meta (data + tamanho), botão **"Baixar PDF"** (`.btn .btn-primary .btn-lg`, `download`). É o boletim de maior data.
  - **Lista** `.doc-list`: agrupada por tipo (`.doc-group-lbl` "OFICIAIS/RESULTADOS/…") com `.doc-card`s (selo PDF 44×54, número, título, meta = badge tipo + data + tamanho, botão `.dl` "Baixar"). Botão Baixar full-width ≤560px.
- Ordenação: por data desc; o primeiro vira destaque, o restante na lista agrupado por tipo. Some a seção inteira se `boletins.length === 0` (manter o guard `evento.boletins ?? []`).
- Datas em UTC (`{ timeZone: 'UTC' }`). CSS novo em `site.css`: `.doc-layout .doc-feature .doc-list .doc-group-lbl .doc-card .dl .b-neutral` + responsivo `@media (max-width:940px)` e `≤560px`. Reveal: não prender com `animation … both` (estado base visível), conforme README.

## Testes / Verificação

- `npx prisma migrate dev` (enum) sem reset destrutivo; `tsc --noEmit` backend.
- `cd frontend && npm run build` (admin) e `npm run build:site` (público) sem erros.
- Atualizar/ajustar `frontend/src/site-publico/EventoPage-boletins.test.tsx` para o novo markup (seção "Boletins & documentos", destaque + cards; some quando vazio).
- Manual: admin → painel estilizado; "Publicar boletim" abre modal; dropdown de tipo com swatches; dropzone aceita PDF; publicar insere na lista + toast; remover funciona. Público (mobile incluso): destaque do último + lista agrupada por tipo; "Baixar" abre o PDF; ≤940px 1 coluna; ≤560px botão full-width.
- Alvos de toque ≥44px; testar ~360–414px.

## Fora de escopo

- Status Publicado/Rascunho e workflow de rascunho.
- Contagem de páginas do PDF.
- Registro real em auditoria (o texto "Registrado em auditoria" é decorativo nesta entrega).
- Editar boletim (mantém criar/remover).
- Menu mobile do nav do site (`nav-links` ocultos ≤860px já é comportamento do site.css).

## Restrições globais

- Host Windows; ler arquivos antes de editar; caminhos absolutos.
- Git identity inline (`-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`).
- Validar com `npm run build` / `npm run build:site` (CI usa `tsc -b && vite build`).
- Reusar tokens/classes do design system existente; não inventar cores/componentes.
- Demonstração (screenshots) antes do merge na develop; promoção a prod só com confirmação do Wagner.
