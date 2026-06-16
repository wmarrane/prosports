# Exportar HTML: lista de cabeças com o grupo de cada uma — Design

**Data:** 2026-06-16
**Status:** Aprovado (aguardando revisão da spec)

## Problema

No relatório "Exportar HTML" do evento, para modalidades de **grupos**, não há uma lista mostrando em qual grupo cada **cabeça** foi colocada. O usuário quer ver, conforme as regras de cabeça:

```
Cabeças
1. Lençóis Paulista - Grupo A
2. Fulano - Grupo B
3. Cidade Anfitriã - Grupo C
```

## Contexto

- O "Exportar HTML" é **100% frontend**: `frontend/src/pages/eventos/EventoInscricoes.tsx` monta o documento renderizando `SorteioPrintContent` (de `frontend/src/pages/eventos/SorteioPrint.tsx`) por modalidade sorteada. O mesmo `SorteioPrintContent` é usado no "Imprimir" da tela.
- Sorteio de grupos é **determinístico** (`backend/src/modules/sorteios/engine.ts` `drawGroups`): a cabeça do grupo G é o **1º participante** de `resultado.grupos[G].participantes`, e `grupos[G].letra` é "A", "B", … As cabeças saem de **campeões do ano anterior** (por posição) + **regra do anfitrião** (`applyAnfitriaoRule`: anfitrião vai ao grupo C com 3 grupos, ou D com 4+). Logo, a posição lida do resultado já reflete a regra do anfitrião.
- `SorteioPrintContent` já recebe tudo o que é preciso: `resultado` (`GruposResultado`), `participantesById`, `campeoesByParticipanteId`, `anfitriaoPid`.

## Decisão

Derivar a lista de cabeças **do próprio resultado** (sem dados novos, sem backend): para cada grupo na ordem, o 1º participante é cabeça se for **campeão** (`campeoesByParticipanteId.has(pid)`) **ou** o **anfitrião** (`pid === anfitriaoPid`). Isso espelha exatamente como o engine monta as cabeças (campeões + anfitrião nos primeiros grupos).

## Mudança (somente `frontend/src/pages/eventos/SorteioPrint.tsx`)

Em `SorteioPrintContent`, para `p.modalidadeTipo === 'grupos' && p.resultado`, antes do `<SorteioGrupos>`, renderizar uma seção "Cabeças".

Lógica de montagem (dentro do componente):
```tsx
const cabecas = p.modalidadeTipo === 'grupos' && p.resultado
  ? (p.resultado as { grupos: { letra: string; participantes: number[] }[] }).grupos
      .map(g => ({ pid: g.participantes[0], letra: g.letra }))
      .filter(g => g.pid != null && (p.campeoesByParticipanteId.has(g.pid) || g.pid === p.anfitriaoPid))
      .map((g, i) => ({ ordem: i + 1, nome: p.participantesById.get(g.pid)?.nome ?? '—', letra: g.letra }))
  : []
```

Render (estilo coerente com as seções "Campeões do ano anterior"/"Inscritos"; usa `<ol>` para o número explícito "1., 2., …" e separador "-" como no exemplo do usuário):
```tsx
{cabecas.length > 0 && (
  <div style={{ marginTop: 12 }}>
    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Cabeças</div>
    <ol style={{ margin: 0, paddingLeft: 18, color: '#1e293b', fontSize: 12 }}>
      {cabecas.map(c => <li key={c.ordem}>{c.nome} - Grupo {c.letra}</li>)}
    </ol>
  </div>
)}
```
Posição: imediatamente **antes** do bloco `{p.modalidadeTipo === 'grupos' && p.resultado && (<SorteioGrupos .../>)}`.

## Casos / tratamento

- **Sem cabeças** (sem campeões inscritos e sem anfitrião considerado) → `cabecas.length === 0` → seção não aparece.
- **Mais grupos que cabeças** → grupos cujo 1º participante não é campeão/anfitrião são ignorados (não são cabeças).
- **Só grupos**: chaves e ordem_entrada não recebem a seção (a noção de "grupo" não se aplica; fora de escopo).
- Aparecerá também no "Imprimir" da tela (mesmo componente) — comportamento consistente e desejado.

## Testes / Verificação

- `npm run build` (frontend). Sem teste unitário dedicado (render estático do relatório); verificação manual: exportar HTML de um evento com modalidade de grupos sorteada e conferir a seção "Cabeças" com "Nome - Grupo X" na ordem A, B, C…, incluindo o anfitrião no grupo C/D quando aplicável.
- Sem backend/migration.

## Fora de escopo

- Chaves (cabeças com "1ª/2ª/3ª/4ª cabeça") e ordem_entrada.
- Mostrar cabeças "previstas" para modalidades **não** sorteadas (o relatório é dos sorteios realizados).
- Alterar o engine, a regra do anfitrião ou o cálculo de cabeças.
- Mudar o banner de cabeças do congresso (`CongressoStepSorteio`).
