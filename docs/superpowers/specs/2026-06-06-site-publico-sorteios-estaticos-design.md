# Site público estático + gerador de páginas de sorteio — Design

**Data:** 2026-06-06
**Status:** Aprovado para plano de implementação

## Objetivo

Publicar um **site institucional público** (Montana Eventos) e transformar cada
**evento sorteado** numa **página HTML estática**, servida do **Firebase Hosting
free tier**, de modo que a consulta pública **não toque o banco de dados** —
reduzindo o custo de runtime a **zero**. O site é o rosto público; o botão
**Entrar** leva à tela de login da plataforma ProSports (painel admin já
existente).

## Princípios

- **Evento sorteado é imutável.** Gera-se HTML uma vez (no publish), não a cada acesso.
- **Reprodutível/auditável.** A `seed` oficial do sorteio é exibida e o resultado é o já gravado pelo `engine.ts` (nunca re-sorteia).
- **DRY de renderização.** O bracket/grupos do site público são os **mesmos componentes React** do painel.
- **Custo zero.** GitHub Actions (free) + Firebase Hosting (Spark) + um único read de DB por geração (nunca por visitante).

## Decisões fechadas (brainstorming)

| Tema | Decisão |
|---|---|
| Gatilho de publicação | Botão **"Publicar evento"** no admin (controle editorial) |
| Hospedagem | **Segundo site Firebase** no mesmo projeto; domínio **www.eventosmontana.com.br**; admin segue em `newprosports.web.app` |
| Fonte de dados na build | **Snapshot JSON imutável** congelado no publish; build lê snapshots, não o DB |
| Renderização | **SSG reusando componentes React** (`renderToStaticMarkup`) |
| "Entrar" | Aponta para `https://newprosports.web.app/login` |

---

## Arquitetura

```
[Admin SPA]  →  "Publicar evento"  →  POST /eventos/:id/publicar
                                          │
                                          ├─ monta + congela SNAPSHOT JSON imutável
                                          │   (evento + modalidades + inscritos + campeões
                                          │    + resultado + seed)
                                          ├─ commita snapshot via GitHub API
                                          │   em public-site/snapshots/evento-<id>.json
                                          └─ dispara repository_dispatch (GitHub)
                                                   │
                                          [GitHub Action: build-site-publico]
                                                   │  checkout → lê snapshots (sem DB)
                                                   │  SSG renderiza institucional + 1 .html/evento
                                                   ▼
                                          firebase deploy --only hosting:publico
                                                   ▼
                                          www.eventosmontana.com.br  (HTML estático)
```

---

## Componentes

### 1. Backend — módulo `site-publico`

Local: `backend/src/modules/site-publico/`

- **`POST /eventos/:id/publicar`** (auth admin):
  1. Monta o snapshot (ver contrato) a partir de evento + modalidades + inscrições + campeões + sorteios já gravados.
  2. Commita `public-site/snapshots/evento-<id>.json` via GitHub Contents API (PUT, com o `sha` se já existir).
  3. Dispara `repository_dispatch` (event_type `publicar-site`).
  4. Marca `Evento.site_publicado_em = now()`.
- **`POST /eventos/:id/despublicar`** (auth admin):
  1. Remove o arquivo de snapshot via GitHub Contents API (DELETE).
  2. Dispara `repository_dispatch`.
  3. Limpa `Evento.site_publicado_em = null`.
- **Migração Prisma:** adiciona `site_publicado_em DateTime?` em `Evento`.
- **Config:** `GITHUB_PAT` (fine-grained, escopo `contents:write` + `dispatch` no repo `wmarrane/prosports`), `GITHUB_REPO`, como secrets de produção.

### 2. Snapshot store

- Arquivos `public-site/snapshots/evento-<id>.json` versionados no repo (trilha de auditoria; build 100% offline do DB).
- Listagem dos publicados = listar o diretório no build.

### 3. SSG — pacote `public-site/`

Local: `public-site/` (novo, com `package.json` + Vite SSR próprios).

- Importa componentes de sorteio de `frontend/src/components/sorteio-result/` + tokens (`tokens.css`, `prosports-theme.css`).
- Telas institucionais (Início/Eventos/Sobre, nav, hero, cards, footer, `site.css`) **portadas do handoff para componentes React**.
- Script de build:
  1. Lê todos os snapshots de `public-site/snapshots/`.
  2. Renderiza via `renderToStaticMarkup`:
     - `index.html` (Início: hero, pilares, plataforma, eventos em destaque, CTA login).
     - `eventos.html` (eventos agrupados por ano, contadores).
     - `sobre.html` (estático).
     - `evento-<id>.html` por evento publicado.
  3. Emite em `public-site/dist/`.
- Mantém mecanismos de escala do handoff: agrupamento por categoria, trilha lateral (`≥8` e `≥2` categorias), acordeão `<details>` (aberto se `≤10`), busca/filtro (`≥8`), lazy-render via `<template>` (`>10` modalidades).
- Estados sem sorteio: render "aguardando sorteio".

### 4. CI — `build-site-publico.yml`

- Disparo: `repository_dispatch` (type `publicar-site`) + `workflow_dispatch`.
- Passos: checkout → setup Node 24 → `npm ci` (frontend + public-site) → build SSG → auth GCP via WIF (Firebase) → `firebase deploy --only hosting:publico`.

### 5. Hosting

- `firebase.json` ganha **segundo target** `publico` (`public: public-site/dist`), sem o rewrite SPA (`**→index.html`); usa 404 estático.
- `.firebaserc` mapeia target `publico` ao site.
- Custom domain `www.eventosmontana.com.br` adicionado no console Firebase + registros DNS no registrar (passo manual de checklist).

---

## Contrato do snapshot

```ts
type Participante = { name: string; club: string; rank?: number }
type Campeao      = { pos: 1|2|3; name: string; club: string; ano: number }

type ModalidadeSnap = {
  id: string
  nome: string                 // "Faixa Roxa · -76kg"
  grupo?: string               // categoria p/ agrupar
  tipo: "chaves" | "grupos" | "ordem" | "especifico"
  status: "rascunho"|"inscricoes"|"pronto"|"sorteado"|"parcial"
  seed?: string                // sorteio.seed (auditoria)
  pool: Participante[]         // inscritos confirmados
  campeoes?: Campeao[]         // pódio do ano anterior
  campAno?: number
  resultado?: unknown          // JSON já gravado pelo engine (slots/matchesGraph | grupos | ordem)
}

type EventoSnap = {
  id: string
  nome: string; competicao: string; esporte: string
  cidade: string; local: string; data: string  // ISO
  organizador: string
  status: "rascunho"|"inscricoes"|"pronto"|"sorteado"
  publicadoEm: string                            // ISO
  modalidades: ModalidadeSnap[]
}
```

> O `resultado` vem direto do banco (já produzido por `engine.ts`), garantindo
> que o site reflita exatamente o sorteio oficial — mesma seed, mesmas chaves.

---

## Casos de borda

- **Re-publicar:** sobrescreve o snapshot (PUT com `sha`); rebuild completo do site.
- **Despublicar:** remove snapshot + rebuild; o evento some das listas.
- **Modalidade sem sorteio:** estado "aguardando sorteio".
- **Eventos grandes (60+ modalidades):** lazy-render + acordeão fechado mantêm a página leve.
- **Privacidade:** publicar expõe nomes/clubes de inscritos + campeões + chaveamento (propósito do site; evento esportivo público). Decisão aceita.
- **Segurança:** PAT fine-grained mínimo (contents + dispatch), secret de produção; nunca no frontend.

---

## Testes

- **Backend:**
  - Unit do montador de snapshot: evento/modalidades/sorteio → contrato correto (inclui seed, pool, campeões, resultado).
  - Endpoint publicar/despublicar com GitHub API mockado: commita/remove arquivo certo, dispara dispatch, atualiza `site_publicado_em`.
- **SSG:**
  - Render por `tipo` (`chaves`/`grupos`/`ordem`/`especifico`/"aguardando") → HTML não-vazio com a seed correta.
  - Snapshot test do HTML de um evento de fixture.
- **Smoke:** build do `public-site` a partir de snapshots de fixture roda sem erro e emite o nº esperado de arquivos.

---

## Plano em blocos (sequencial)

1. **Backend:** migração `site_publicado_em` + módulo `site-publico` (snapshot builder, endpoints publicar/despublicar, GitHub API client) + botão "Publicar" no admin.
2. **SSG:** pacote `public-site/` reusando componentes React + telas institucionais + render por tipo + mecanismos de escala.
3. **Pipeline:** workflow `build-site-publico.yml` + segundo target Firebase + custom domain (checklist DNS).

---

## Checklist de produção

1. Criar segundo site Firebase (target `publico`) no projeto `newprosports`.
2. Adicionar custom domain `www.eventosmontana.com.br` + DNS no registrar.
3. Gerar PAT fine-grained e cadastrar `GITHUB_PAT`/`GITHUB_REPO` como secrets de produção.
4. Trocar `logo-montana.png` pelo vetor oficial; preencher placeholders de imagem do handoff.
5. Implementar menu mobile (handoff só esconde links < 860px).
