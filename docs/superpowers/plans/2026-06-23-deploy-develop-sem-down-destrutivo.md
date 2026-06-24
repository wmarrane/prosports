# Deploy dev resiliente: remover `down` destrutivo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o deploy de dev resiliente: remover o `docker compose down --remove-orphans` separado e subir com `docker compose up -d --build --remove-orphans`, evitando a janela em que os containers ficam removidos e não recriados.

**Architecture:** Mudança de um único passo no workflow `deploy-develop.yml`. Sem código de app, sem backend/migration.

**Tech Stack:** GitHub Actions (YAML); Docker Compose.

**Spec:** `docs/superpowers/specs/2026-06-23-deploy-develop-sem-down-destrutivo-design.md`

## Global Constraints

- Escopo: **apenas** `.github/workflows/deploy-develop.yml`. Não tocar `deploy-main.yml` nem os compose files.
- Git identity não configurada → commit com `-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`; caminhos absolutos com `git -C`. Windows host; ler o arquivo antes de editar.

---

### Task 1: Remover o `down` destrutivo do deploy-develop

**Files:**
- Modify: `.github/workflows/deploy-develop.yml`

Estado atual (dois passos consecutivos):
```yaml
      - name: Parar containers antigos
        run: docker compose down --remove-orphans || true

      - name: Build e subir containers
        run: docker compose up -d --build
```

- [ ] **Step 1: Editar os passos**

Remover por completo o passo "Parar containers antigos" e adicionar `--remove-orphans` ao `up`, ficando apenas:
```yaml
      - name: Build e subir containers
        run: docker compose up -d --build --remove-orphans
```
Não alterar nenhum outro passo (Checkout, Criar .env, npm ci, migrations, `docker image prune -f`, `docker builder prune`, `docker system prune -f` permanecem como estão).

- [ ] **Step 2: Validar o YAML**

Run: `cd "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" && python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy-develop.yml', encoding='utf-8')); print('YAML OK')"`
Expected: imprime `YAML OK` (sem exceção).

- [ ] **Step 3: Conferir o diff**

Run: `git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" diff .github/workflows/deploy-develop.yml`
Expected: o passo "Parar containers antigos" foi removido; a linha do `up` agora termina com `--build --remove-orphans`; nenhuma outra mudança.

- [ ] **Step 4: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add .github/workflows/deploy-develop.yml
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "ci(deploy-develop): remove down destrutivo; up -d --build --remove-orphans"
```

---

## Notas finais

- Sem teste automatizado (workflow CI). A validação real ocorre no próximo deploy de dev (com o runner online): `up -d --build --remove-orphans` recria o que mudou e os serviços respondem (`:8080`, `:3000/health`, `:8081`); um deploy interrompido não deixa o sistema sem containers.
- Promoção `develop` → `main` não é necessária para este fix (ele afeta só o workflow de dev, que roda a partir do `develop`).
