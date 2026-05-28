# Spec: Versão visível + Changelog

Data: 2026-05-28
Status: aprovado para implementação

## Objetivo

Exibir a versão do sistema no rodapé do sidebar e permitir que o usuário acompanhe o que mudou em cada release através de uma página `/novidades`. Acompanhar releases via `CHANGELOG.md` no repositório seguindo o padrão Keep a Changelog.

## Escopo

- Versão atual visível na UI (rodapé do sidebar) com short SHA do commit.
- Página `/novidades` listando todos os releases em formato timeline.
- Badge no sidebar quando há release novo que o usuário ainda não viu (estado por browser via `localStorage`).
- `CHANGELOG.md` no root do repositório, formato Keep a Changelog.
- Injeção da versão e do SHA em build time pelo Vite.

Fora de escopo:
- Auditoria de registros (quem mudou o quê) — projeto separado, brainstorm em outro spec.
- Endpoint backend para versão (não é necessário — tudo build-time).
- Modal automático no login (badge é suficiente).
- Persistência cross-device da "última versão vista" (localStorage é aceitável).

## Decisões de design

| # | Decisão | Justificativa |
|---|---|---|
| 1 | Fonte única da versão: `package.json` do root | Já existe e está em `1.0.0`. Convenção npm. Sem duplicação. |
| 2 | Versão + commit injetados pelo Vite em build time | Sem chamada de rede, sem chance de mismatch entre bundle e backend. |
| 3 | `CHANGELOG.md` no root, copiado para `frontend/public/` pelo plugin | Mantém o changelog versionado no git (devs editam no PR), mas servido como asset. |
| 4 | Formato Keep a Changelog | Estruturado, parseável sem dependência. Padrão da indústria. |
| 5 | Parser próprio (regex), sem `react-markdown` | Formato é regular; evita dep nova. |
| 6 | `localStorage` para "última versão vista" | YAGNI: usuários do sistema acessam normalmente do mesmo browser. |
| 7 | Sem badge no primeiro login | Evita ruído no primeiro uso; bumps subsequentes acionam normalmente. |

## Modelo de dados

Não há mudança no banco. Estado cliente-side em `localStorage`:

- Chave: `prosports:ultima-versao-vista`
- Valor: string da versão (ex.: `"1.1.0"`)

## Política de versão (SemVer)

`MAJOR.MINOR.PATCH`. Quem bumpa: o autor do PR ao fechar o ciclo.

- **MAJOR** — quebra de contrato (schema, API).
- **MINOR** — feature nova retrocompatível.
- **PATCH** — bugfix sem mudança de comportamento.

**Fluxo a cada release:**
1. Editar `package.json` do root → novo número de versão.
2. Adicionar bloco no topo do `CHANGELOG.md` com data + categorias.
3. Commit `chore(release): vX.Y.Z` (tag `git tag vX.Y.Z` opcional).

## CHANGELOG.md inicial

Seed do arquivo no root:

```md
# Changelog

Todos os releases notáveis deste projeto.
Formato: Keep a Changelog (https://keepachangelog.com/pt-BR/1.1.0/).
Versionamento: SemVer (https://semver.org/lang/pt-BR/).

## [1.1.0] - 2026-05-28

### Added
- Cadastro de Municípios com importação de CSV (IBGE).
- Autocomplete de município no formulário de Delegação.
- Versão visível no rodapé do sidebar com badge de novidades.

### Changed
- Delegação agora referencia município por FK (`municipio_id`).

## [1.0.0] - 2026-05-27

### Added
- Autenticação com JWT (admin/delegação/viewer).
- Cadastro de Delegações, Modalidades e Categorias.
```

`package.json` (root) bumpa para `1.1.0` como parte deste ciclo.

## Frontend

### Estrutura

```
frontend/
  src/
    lib/
      version.ts          # APP_VERSION, APP_COMMIT, APP_BUILT_AT
      changelog.ts        # parse(md) → Release[]
      use-changelog.ts    # hook fetch + parse
      use-novidades.ts    # hook badge state
    pages/
      Novidades.tsx       # timeline de releases
    components/
      Layout.tsx          # adiciona footer no sidebar (modificar)
    vite-env.d.ts         # declare const __APP_VERSION__ etc. (modificar)
  vite.config.ts          # define + copy plugin (modificar)
  App.tsx                 # rota /novidades (modificar)
```

### `lib/version.ts`

```ts
export const APP_VERSION = __APP_VERSION__
export const APP_COMMIT = __APP_COMMIT__
export const APP_BUILT_AT = __APP_BUILT_AT__
```

### `lib/changelog.ts`

Tipos e parser:

```ts
export type ChangelogSection = 'Added' | 'Changed' | 'Fixed' | 'Removed'

export type Release = {
  version: string         // "1.1.0"
  date: string            // "2026-05-28"
  sections: Partial<Record<ChangelogSection, string[]>>
}

export function parseChangelog(md: string): Release[]
```

Regras do parser:
- Procura linhas `## [x.y.z] - YYYY-MM-DD` para começar cada release.
- Dentro de cada release, procura `### <Categoria>` (somente as 4 categorias suportadas).
- Bullets `- item` viram strings na seção correspondente.
- Ignora qualquer outra linha (linhas em branco, headers de nível 1, parágrafos introdutórios antes do primeiro release).
- Retorna na ordem que aparecem no arquivo (mais recente primeiro, por convenção do formato).

### `lib/use-changelog.ts`

Hook React Query que faz `fetch('/CHANGELOG.md')` e parseia uma vez. Cache padrão do React Query (`staleTime: Infinity` é apropriado — o arquivo só muda em deploy).

### `lib/use-novidades.ts`

```ts
export function useNovidades(): {
  temNovidade: boolean
  marcarComoVisto: () => void
}
```

Comportamento:
- Lê `localStorage['prosports:ultima-versao-vista']`.
- Se a chave não existe, escreve `APP_VERSION` imediatamente (primeiro login não mostra badge) e retorna `temNovidade: false`.
- Se a chave existe e é diferente de `APP_VERSION`, retorna `temNovidade: true`.
- `marcarComoVisto()` escreve `APP_VERSION` no localStorage e atualiza o estado para `false`.

### `pages/Novidades.tsx`

- Header: versão atual + commit + data de build em texto pequeno.
- Lista de releases (de `use-changelog`) renderizada como timeline:
  - Card por release: `v{version} — {date}` no topo.
  - Para cada categoria não vazia: subtítulo + lista de bullets.
- `useEffect` no mount chama `marcarComoVisto()` para zerar o badge.
- Loading state simples e mensagem de erro se o fetch falhar.

### `components/Layout.tsx`

Adicionar no rodapé do sidebar, abaixo do botão "Sair":

```tsx
<NavLink to="/novidades" className="...">
  v{APP_VERSION} ({APP_COMMIT})
  {temNovidade && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-indigo-500" />}
</NavLink>
```

Estilo discreto (texto pequeno, cinza), hover destaca. Badge é um dot indigo.

### `App.tsx`

Adicionar rota dentro do `<Layout />`:
```tsx
<Route path="/novidades" element={<Novidades />} />
```

## Build (Vite)

### `vite.config.ts` (modificar)

Adicionar:
- Helper `getVersion()` lendo `../package.json`.
- Helper `getCommit()` rodando `git rev-parse --short HEAD` (fallback `"unknown"` se git falhar).
- Plugin `copy-changelog` no hook `buildStart`: copia `../CHANGELOG.md` para `public/CHANGELOG.md`.
- `define`: `__APP_VERSION__`, `__APP_COMMIT__`, `__APP_BUILT_AT__` (todos como `JSON.stringify(...)`).

Preservar o resto da config existente.

### `vite-env.d.ts` (modificar)

Adicionar declarações para o TS reconhecer as globals.

### `.gitignore`

Adicionar `frontend/public/CHANGELOG.md` (gerado pelo plugin a cada build; não versionar para evitar conflitos).

## Operação

- **Dev (`npm run dev:frontend`):** plugin roda no `buildStart`, copia o CHANGELOG, dev server serve `/CHANGELOG.md`. Versão e commit refletem o estado atual do checkout.
- **Build (`npm run build:frontend`):** mesma coisa + bundle final com as consts injetadas literalmente.
- **CI/CD:** já tem acesso ao `.git` (precisa para `git rev-parse`). Caso a pipeline rode em diretório sem `.git`, o fallback `"unknown"` evita quebra.

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Dev esquece de atualizar CHANGELOG | Não bloqueia tecnicamente. Convenção do PR: parte do "definition of done". |
| `git rev-parse` falha no build | Fallback retorna `"unknown"`; build não quebra. |
| Usuário troca de browser e perde "última versão vista" | Aceitável: vê o badge uma vez; basta abrir `/novidades`. |
| Parser não cobre algum formato de bullet | Parser é simples; documentar no spec que apenas `- ` no início da linha conta. Devs seguem o template. |
| `frontend/public/CHANGELOG.md` versionado por engano | `.gitignore` documentado. |
