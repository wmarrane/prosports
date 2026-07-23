# Competição escolar (Jeesp): subtítulo e município por modalidade — Design

**Data:** 2026-07-14
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Suportar competições do tipo escolar (ex.: Jeesp) onde o **subtítulo** e o **município** de um mesmo inscrito **variam por modalidade**. Ex.: "SREL Araçatuba" em Basquete Feminino 14 = subtítulo "Escola de Primeiro Grau" / município "Araçatuba - SP"; em Basquete Masculino 14 = subtítulo "Escola de Segundo Grau" / município "Campinas - SP".

Hoje `subtitulo` e `município` são atributos **globais do Participante** — o mesmo inscrito não pode ter valores diferentes por modalidade. A feature adiciona **overrides por inscrição** (participante × modalidade × evento), habilitados por um **parâmetro na competição**, exibidos em **todas** as visualizações. **Os demais tipos de competição permanecem inalterados** (comportamento atual quando o parâmetro está desligado).

## Decisões aprovadas

- **Parâmetro:** um toggle booleano na competição — `subtitulo_municipio_por_modalidade` (`@default(false)`). Reusa o `subtitulo_campos` existente para definir **o que** aparece e em que ordem.
- **Onde guardar:** overrides **na Inscrição** — `Inscricao.subtitulo String?` e `Inscricao.municipio_id Int?` (FK opcional a `Municipio`). Migração **aditiva** (colunas nullable). *(Alternativas descartadas: tabela 1:1 = join extra sem ganho; JSON = perde integridade do FK.)*
- **Regra de resolução (fallback):** para cada inscrição, o "participante efetivo" =
  - `subtitulo` = (toggle **e** `inscricao.subtitulo` não vazio) ? `inscricao.subtitulo` : `participante.subtitulo`
  - `municipio` = (toggle **e** `inscricao.municipio` presente) ? `inscricao.municipio` : `participante.municipio`
  - toggle **desligado** → idêntico a hoje (valores do participante).
- **Captura:** import de planilha **e** cadastro manual.
- **Exibição:** em **todos** os lugares (Modo Congresso, resultado do sorteio, site público, relatórios).
- **Fallback:** quando o toggle está ligado mas a inscrição não tem valor próprio, **cai no valor global do participante** (evita campos em branco; import parcial não quebra).

## Contexto (codebase)

- `Participante` tem `subtitulo String?`, `municipio_id Int` (obrigatório), `inspetoria_id?`, `delegacia_id?`. `Competicao` tem `subtitulo_campos String[]` e `considerar_anfitriao`. `Inscricao` liga `evento × modalidade × participante` (`@@unique([evento_id, modalidade_id, participante_id])`).
- `lib/compose-subtitulo.ts` (twins backend `backend/src/lib/` e frontend `frontend/src/lib/`): `composeSubtituloLine(participanteLike, campos)` junta os campos selecionados com ` | `. **Não muda.**
- Modo Congresso calcula o subtítulo **no cliente**: `CongressoStep*` chamam `composeSubtituloLine(i.participante, subtitulo_campos)` iterando sobre **inscrições** — logo, se a inscrição carregar os overrides, o cálculo do efetivo é natural.
- Site público: `site-publico.service.ts` monta o snapshot no backend com `subtituloFn(p) = composeSubtituloLine(p, campos)` (por participante) — precisará do efetivo por (modalidade × participante).
- Import de participantes (`participantes.service.ts`) já resolve município por nome/UF — reusar esse match no import de inscrições.

## Arquitetura

**Helper único de resolução** (twin backend + frontend, ao lado do `composeSubtituloLine`):
`atributosEfetivos(inscricao, porModalidade) → { subtitulo, municipio }`, montando um "participante-like efetivo" que é passado ao `composeSubtituloLine` existente. Fonte única da regra de fallback.

**A API de inscrições** passa a expor `subtitulo` e `municipio` (override) da inscrição e o flag `subtitulo_municipio_por_modalidade` da competição, para o front montar o efetivo.

## Decomposição em sub-projetos (cada um: spec/plano/impl, validado no dev)

### B1 — Fundação + captura
- **Schema/migração (aditiva):** `Competicao.subtitulo_municipio_por_modalidade`; `Inscricao.subtitulo`, `Inscricao.municipio_id` (+ relation nullable a `Municipio`).
- **Cadastro da competição (admin):** novo toggle no `CompeticaoForm`.
- **Overrides na inscrição:** service/controller aceitam e persistem `subtitulo`/`municipio_id`.
- **Import de inscrições:** com o toggle ligado, aceita 2 colunas opcionais (subtítulo e município/UF), resolve município por nome/UF (reuso), grava na inscrição. Toggle desligado → import inalterado.
- **Manual:** tela de inscrição da modalidade mostra os campos (subtítulo + município) quando o toggle está ligado; opcionais.
- **API:** endpoints de inscrição expõem os overrides + o flag da competição.
- *Resultado:* dados entram e são persistidos; ainda sem mudança de exibição.

### B2 — Exibição em todos os lugares
- **Helper `atributosEfetivos`** (backend + frontend).
- **Modo Congresso:** `CongressoStep*` usam o efetivo da inscrição em vez de `i.participante` cru.
- **Resultado do sorteio** (chaves/grupos/ordem): `participantesById` carrega subtítulo/município efetivo por modalidade.
- **Site público (snapshot):** backend calcula o efetivo por (modalidade × participante).
- **Relatórios (xlsx do congresso):** efetivo.

## Testes / Verificação (por sub-projeto)

- **B1:** unit da resolução de município no import (match nome/UF); service de inscrição persiste/retorna overrides; migração aditiva (inspecionar `migration.sql` — sem DROP); `tsc`/vitest backend verdes; build admin verde. Demo no dev: criar competição com toggle, importar/inserir inscrições com valores por modalidade, conferir persistência via API.
- **B2:** unit do `atributosEfetivos` (toggle on/off, override presente/ausente → fallback); Modo Congresso mostra valores por modalidade; snapshot do público com efetivo; relatórios; e **regressão**: competição com toggle **desligado** exibe exatamente como hoje. Demo no dev com o evento "Jeesp Mirim Etapa I".

## Fora de escopo
- Alterar o comportamento de competições com o toggle **desligado** (mantém 100% igual).
- Novos campos além de subtítulo/município variarem por modalidade (inspetoria/delegacia seguem globais).
- Um "tipo de competição" genérico (optou-se pelo toggle específico).

## Restrições globais
- Host Windows; ler antes de editar; caminhos absolutos; git identity inline; nunca `git add -A`.
- Backend: `npx tsc --noEmit` + `npx vitest run` dos módulos tocados; migração aditiva (revisar `migration.sql`). Frontend: `npm run build` (admin) e `npm run build:site` quando tocar o público.
- Validar no dev antes de promover; produção só com confirmação do Wagner (e Cloud SQL ligada — há migração).
