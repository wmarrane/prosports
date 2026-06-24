# Deploy dev resiliente: remover `down` destrutivo — Design

**Data:** 2026-06-23
**Status:** Aprovado (aguardando revisão da spec)

## Problema

Incidente em 2026-06-23: o sistema prosports ficou **fora do ar no dev** (192.168.56.113) — nenhum container `prosports-*` existia, embora a VM estivesse ligada e os demais projetos rodando.

**Causa-raiz:** o workflow `deploy-develop.yml` faz, em **passos separados**:
1. `docker compose down --remove-orphans` (passo "Parar containers antigos") — isto **remove** os containers.
2. `docker compose up -d --build` (passo "Build e subir containers").

O runner self-hosted de dev caiu **entre** (1) e (2) — containers removidos e nunca recriados. O `restart: unless-stopped` (que **já existe** em todos os serviços de `docker-compose.yml` e `docker-compose.prod.yml`) **não recria container removido** (só reinicia container parado), por isso os outros projetos voltaram no reboot e o prosports não.

## Decisão

Eliminar a janela destrutiva: **remover o passo `down --remove-orphans`** e fazer a subida com `docker compose up -d --build --remove-orphans`. O `up` recria apenas os serviços cujo build/config mudou, remove órfãos e mantém os demais rodando — sem o intervalo em que tudo fica derrubado. Se um deploy for interrompido, o sistema não fica sem containers.

**Escopo:** apenas `deploy-develop.yml` (onde ocorreu o incidente). O `deploy-main` (prod) fica **fora de escopo** (decisão do usuário) — prod usa imagens pré-buildadas e raramente reinicia.

## Mudança (somente `.github/workflows/deploy-develop.yml`)

Estado atual (passos):
```yaml
      - name: Parar containers antigos
        run: docker compose down --remove-orphans || true

      - name: Build e subir containers
        run: docker compose up -d --build
```

Passa a ser (remover o passo "Parar containers antigos"; adicionar `--remove-orphans` ao `up`):
```yaml
      - name: Build e subir containers
        run: docker compose up -d --build --remove-orphans
```

Os demais passos permanecem inalterados — incluindo `docker system prune -f` ("Limpar networks/containers órfãos"), que remove apenas containers **parados**/imagens dangling/redes não usadas e **não** derruba containers em execução.

## Verificação

- O arquivo continua YAML válido; o passo "Parar containers antigos" some e o `up` ganha `--remove-orphans`.
- Pós-merge em develop, com o runner online: o deploy roda `up -d --build --remove-orphans`, recria o que mudou e os serviços respondem (`:8080`, `:3000/health`, `:8081`). Um deploy interrompido não deixa o sistema sem containers.
- Sem teste automatizado (mudança de workflow CI). Sem backend/migration/código de app.

## Fora de escopo

- `deploy-main.yml` (prod) — manter como está.
- Confiabilidade do runner self-hosted (problema operacional recorrente, tratado à parte iniciando/monitorando o serviço na VM).
- Restart-policy dos serviços — já é `unless-stopped`; nada a mudar.
