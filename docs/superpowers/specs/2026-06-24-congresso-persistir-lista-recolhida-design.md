# Modo Congresso — persistir estado recolhido/expandido da lista — Design

**Data:** 2026-06-24
**Status:** Aprovado (aguardando revisão da spec)

## Problema

Na etapa Modalidade, o botão recolhe/expande a lista, mas o estado **não persiste**: `listaAberta` é `useState(true)` local, e a etapa **remonta** ao navegar entre modalidades/etapas do congresso → volta a expandida. O usuário quer que, ao recolher, **permaneça recolhida**, e só expanda ao clicar de novo.

## Decisão

Persistir o estado em **localStorage** (preferência **global** do Modo Congresso — vale para qualquer evento/competição), espelhando o padrão de `frontend/src/lib/congresso-vistas.ts`. Default na ausência de valor: **expandida**.

## Mudança (somente `frontend/src/pages/congresso/CongressoStepModalidade.tsx`)

- Definir a chave (no topo do módulo, junto das outras consts):
  ```ts
  const LISTA_KEY = 'prosports.congresso.lista-aberta'
  ```
- Init lazy do estado (substituindo `const [listaAberta, setListaAberta] = useState(true)`):
  ```ts
  const [listaAberta, setListaAberta] = useState<boolean>(() => {
    try { return localStorage.getItem(LISTA_KEY) !== 'false' } catch { return true }
  })
  ```
  (Default expandida: só o valor exato `'false'` recolhe.)
- Persistir ao alternar — o `onClick` do toggle passa a:
  ```tsx
  onClick={() => setListaAberta(v => {
    const nv = !v
    try { localStorage.setItem(LISTA_KEY, String(nv)) } catch { /* storage indisponível */ }
    return nv
  })}
  ```

Nenhuma outra mudança (markup, CSS, classe `cw-md--recolhido` etc. permanecem).

## Testes / Verificação

- `npm run build` (frontend) sem erros.
- Manual: recolher a lista → trocar de modalidade / sair e voltar à etapa Modalidade → continua **recolhida**; clicar no toggle → expande e persiste; recarregar a página → mantém a última preferência.
- Sem teste unitário (estado de UI + localStorage). Sem backend/migration.

## Fora de escopo

- Persistência por evento (decisão: global).
- Animação de transição.
- Sincronizar a preferência entre dispositivos/usuários (é local do navegador).
