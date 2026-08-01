import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    /**
     * Vários testes fazem `vi.resetModules()` + `await import(...)` para reler
     * envs, e alguns desses módulos arrastam grafos pesados (SDK do Google
     * Cloud no storage, site-publico nos boletins). Com a suíte inteira em
     * paralelo — ainda mais numa máquina ocupada — o transform desses imports
     * passa dos 5s padrão e o teste falha por TIMEOUT, não por lógica.
     *
     * O caso legítimo mais lento roda em ~3s, então 30s dá folga sem esconder
     * travamento de verdade.
     */
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
