# Arquitetura de Desenvolvimento — prosports_v2

**Data:** 2026-05-28
**Status:** Aprovado

---

## Visão Geral

Ambiente de desenvolvimento onde o notebook local executa apenas o servidor Vite (frontend hot-reload), enquanto todos os serviços de backend rodam em Docker na VM dedicada.

**Constraint:** Nenhuma instalação de serviços (Redis, PostgreSQL, Docker) é permitida no notebook-wagner.

---

## Topologia

```
notebook-wagner (Windows 11)
  └── Vite dev server :5173
        └── proxy /api → http://192.168.56.113:3000

VM 192.168.56.113 (Ubuntu 24.04 LTS, Docker via snap)
  ├── prosports-frontend-1  :8080  nginx serve (build prod)
  ├── prosports-backend-1   :3000  Node 22 + Express + Prisma
  └── prosports-redis-1     :6379  Redis 7-alpine

VM 192.168.56.108
  └── PostgreSQL :5432  banco newprosports
```

---

## Dois Modos de Acesso

| Modo | URL | Quando usar |
|------|-----|-------------|
| **Dev** (hot-reload) | `http://localhost:5173` | Desenvolvimento ativo no notebook |
| **Staging/prod-like** | `http://192.168.56.113:8080` | Validar build final; acesso de outros dispositivos |

Em modo dev, o Vite faz proxy de `/api/*` → `http://192.168.56.113:3000/*`, eliminando problemas de CORS no desenvolvimento.

---

## Deploy Automático

Push no branch `develop` aciona o GitHub Actions runner instalado na VM:

```
git push develop
  → GitHub Actions (self-hosted runner @ 192.168.56.113)
      → npm ci + prisma migrate deploy
      → docker compose down --remove-orphans
      → docker compose up -d --build
      → docker image prune -f
```

O runner está registrado como serviço systemd e inicia automaticamente com a VM.

---

## Variáveis de Ambiente

O arquivo `.env` é **gerado pelo workflow** a partir de GitHub Secrets — não é commitado no git.

| Variável | Valor no develop | Fonte |
|----------|-----------------|-------|
| `DATABASE_URL` | `postgresql://...@192.168.56.108:5432/newprosports` | GitHub Secret |
| `REDIS_URL` | `redis://redis:6379` | Hardcoded no compose |
| `JWT_SECRET` | valor aleatório seguro | GitHub Secret |
| `NODE_ENV` | `development` | Hardcoded no compose |
| `CORS_ORIGINS` | `http://192.168.56.113:8080,http://localhost:8080,http://localhost:5173` | Workflow |

---

## Configurações Críticas do Docker

### `docker-compose.yml` — pontos chave

- `REDIS_URL` hardcoded como `redis://redis:6379` (nome do serviço interno), não herdado do `.env`
- `CORS_ORIGINS` passado via `${CORS_ORIGINS}` do `.env` gerado pelo workflow
- Frontend exposto na porta `8080` (evita conflito com r2p na porta `80`)

### `backend/Dockerfile` — runtime stage

```dockerfile
ENV PRISMA_QUERY_ENGINE_LIBRARY=/app/node_modules/.prisma/client/libquery_engine-linux-musl-openssl-3.0.x.so.node
```

Alpine 3.17+ usa OpenSSL 3.x. O Prisma auto-detecta `linux-musl` em runtime e tenta carregar `libssl.so.1.1` (ausente). A variável força o engine correto (`linux-musl-openssl-3.0.x`).

### `backend/prisma/schema.prisma` — generator

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}
```

Garante que o engine `linux-musl-openssl-3.0.x` seja gerado no `docker build`.

---

## `.gitignore` — o que é excluído

```
node_modules/       # dependências
backend/dist/       # build TypeScript (gerado em Docker)
frontend/dist/      # build Vite (gerado em Docker)
.env                # gerado pelo workflow, contém secrets
.idea/              # IDE
.playwright-mcp/    # artefatos de testes browser
.superpowers/       # artefatos internos de brainstorming
```

---

## Decisões de Design

- **PostgreSQL externo ao compose:** gerenciado separadamente na VM `192.168.56.108`; referenciado apenas via `DATABASE_URL`
- **Redis no compose:** incluso no `docker-compose.yml` como serviço interno; não exposto fora da VM em produção futura
- **Migrations antes do `up`:** `prisma migrate deploy` roda antes do `docker compose up`, garantindo schema atualizado antes da API subir
- **`dist/` não commitado:** o build TypeScript é gerado dentro do Docker; commitar `dist/` causaria o backend rodar código desatualizado (bug que existia antes desta revisão)
- **Frontend porta 8080:** evita conflito com o projeto `r2p` que usa a porta `80` na mesma VM
- **CORS inclui IP da VM:** browsers acessando `http://192.168.56.113:8080` enviam `Origin: http://192.168.56.113:8080`; sem isso, o middleware rejeitava com 500
