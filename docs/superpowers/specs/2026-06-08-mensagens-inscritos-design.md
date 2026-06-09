# Mensagens personalizadas por modalidade (por nº de inscritos) — Design

**Data:** 2026-06-08
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Permitir configurar, no cadastro da modalidade (tipos **Grupo** e **Chaves**), mensagens personalizadas associadas a faixas de nº de participantes. Na tela "Inscritos" do **Modo Congresso**, quando o nº de inscritos casa com uma faixa, a mensagem é exibida abaixo da lista (caixa alta, negrito, fonte grande). Cada regra pode marcar **"pular sorteio"**, fazendo o botão Próxima voltar para a tela de Modalidade em vez de ir ao Sorteio.

## Escopo

- Configuração disponível **somente para modalidades tipo `grupos` e `chaves`**.
- Faixas e textos **definidos pelo usuário** (não fixas). Cada modalidade tem uma lista ordenada de regras.
- **Fora de escopo:** tipos `especifico`/`ordem_entrada` (sem card de mensagens); mensagens por evento (são por modalidade, reutilizadas em todos os eventos).

## Modelo de dados

Nova coluna em `Modalidade`:

```prisma
mensagens_inscritos Json @default("[]")
```

Conteúdo: lista ordenada de regras
```ts
type MensagemInscritos = {
  min: number          // inteiro >= 1 (obrigatório)
  max: number | null   // inteiro >= min, ou null = sem limite superior
  mensagem: string     // texto exibido
  pular_sorteio: boolean
}
```

- Valor único (ex.: exatamente 2) → `min === max`.
- "6 ou mais" → `min: 6, max: null`.
- Migration: `ALTER TABLE "Modalidade" ADD COLUMN "mensagens_inscritos" JSONB NOT NULL DEFAULT '[]';` (criada manualmente, aplicada pelo deploy — ver memória de migrations).

## Função pura (testável)

`frontend/src/lib/mensagens-inscritos.ts`:

```ts
export type MensagemInscritos = { min: number; max: number | null; mensagem: string; pular_sorteio: boolean }

export function matchMensagem(regras: MensagemInscritos[], n: number): MensagemInscritos | null
```
- Retorna a **primeira** regra (na ordem da lista) onde `n >= min && (max == null || n <= max)`; senão `null`.
- Limites **inclusivos**.

## Backend (API)

- `backend/prisma/schema.prisma`: campo `mensagens_inscritos Json @default("[]")`.
- `modalidades.controller.ts` (zod): aceitar
  ```ts
  mensagens_inscritos: z.array(z.object({
    min: z.number().int().min(1),
    max: z.number().int().min(1).nullable(),
    mensagem: z.string(),
    pular_sorteio: z.boolean(),
  })).optional()
  ```
- `modalidades.service.ts`: incluir `mensagens_inscritos` nos tipos de `criar`/`editar` (repassado direto ao Prisma).

## Frontend

### Tipo
`frontend/src/types/modalidade.ts`: `Modalidade` ganha `mensagens_inscritos: MensagemInscritos[]` (reusando o tipo de `lib/mensagens-inscritos.ts` ou um espelho). `services/modalidades.ts`: `ModalidadePayload` ganha `mensagens_inscritos?: MensagemInscritos[]`.

### Cadastro (`ModalidadeForm.tsx`)
- Estado `mensagens: MensagemInscritos[]` (carrega de `existing.mensagens_inscritos ?? []`; default `[]` em nova).
- Card **"Mensagens por nº de inscritos"**, visível **somente** quando `tipoSelecionado?.tipo === 'grupos' || === 'chaves'`.
- Editor de lista repetível: cada linha tem **De** (input number, obrigatório), **Até** (input number, opcional → vazio = sem limite), **Mensagem** (textarea), checkbox **"Pular sorteio"**, botão **remover**. Botão **"Adicionar mensagem"** acrescenta linha vazia (`{ min: 1, max: null, mensagem: '', pular_sorteio: false }`).
- No submit: envia `mensagens_inscritos: mensagens` no payload (filtrando linhas com `mensagem` vazia e normalizando `max` vazio → `null`).
- Observação: se o tipo for trocado para um que não suporta (ex.: ordem_entrada), o card some; o valor pode permanecer salvo mas não é exibido nem aplicado.

### Exibição (`CongressoStepParticipantes.tsx`)
- `N = inscricoes.length` (já disponível).
- `regra = matchMensagem(modalidade?.mensagens_inscritos ?? [], N)`.
- Se `regra`: render **abaixo da lista de participantes** um bloco de destaque com `regra.mensagem` em **CAIXA ALTA, negrito, fonte grande** (ex.: `text-transform: uppercase; font-weight: 800; font-size: clamp(20px, 2.4vw, 32px)`), com bom contraste (card/banner theme-aware).

### Navegação (`CongressoStepParticipantes` + `ModoCongresso`)
- O callback `onNext` passa a aceitar `(opts?: { pularSorteio?: boolean }) => void`.
- No clique de Próxima: `onNext({ pularSorteio: regra?.pular_sorteio === true })`.
- `ModoCongresso.nextAfterParticipantes(opts)`: se `opts?.pularSorteio` → `voltarParaModalidade()`; senão mantém a lógica atual (especifico → voltarParaModalidade; demais → step 'sorteio').

## Testes

- `frontend/src/lib/mensagens-inscritos.test.ts` (Vitest puro):
  - primeira regra que casa vence (ordem importa).
  - `max: null` casa para qualquer `n >= min`.
  - valor único (`min===max`) casa só no exato.
  - limites inclusivos (`n===min`, `n===max`).
  - nenhum match → `null`.
- `backend/src/modules/modalidades/modalidades.service.test.ts`: `criar`/`editar` repassam `mensagens_inscritos` ao Prisma.

## Fora de escopo

- Validação de sobreposição de faixas (comportamento: primeira-que-casa vence; sem aviso de overlap).
- Reordenação por drag-and-drop (ordem = ordem de inserção; remover/adicionar basta).
