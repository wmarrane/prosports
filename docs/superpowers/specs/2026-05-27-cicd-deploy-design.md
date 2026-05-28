# CI/CD & Deploy Automático — prosports

**Data:** 2026-05-27  
**Status:** Aprovado

---

## Visão Geral

Pipeline de CI/CD para o monorepo `prosports` com dois ambientes distintos:

| Branch | Ambiente | Infra |
|--------|----------|-------|
| `develop` | Local | Docker VM `192.168.56.113` + PostgreSQL `192.168.56.108` |
| `main` | Cloud | GCP Cloud Run (sob demanda) |

Deploy automático via **GitHub Actions** com **self-hosted runner** instalado na VM Docker para o ambiente `develop`. O branch `main` usa runner cloud do GitHub com deploy para GCP Cloud Run.

---

## Stack Tecnológica

**Frontend:** React 18 + TypeScript 5.6 + Vite 5.4 + TailwindCSS 4.3 + React Router 6 + React Query 5 + Zustand 5 + axios + lucide-react + recharts  
**Backend:** Node 22 + Express 4 + TypeScript 5.6 + Prisma 5.22 + Zod + JWT + Pino + ExcelJS + multer + node-cron  
**Banco:** PostgreSQL — VM `192.168.56.108`, banco `newprosports`  
**Cache/Rate-limit:** Redis 7-alpine (container no docker-compose)  
**Testes:** Vitest 2.1.9 + @testing-library/react  
**Infra:** Docker + docker-compose; nginx no container frontend faz proxy de `/api` para o backend

---

## Estrutura do Repositório

```
prosports/
├── .github/
│   └── workflows/
│       ├── deploy-develop.yml    # self-hosted runner → 192.168.56.113
│       └── deploy-main.yml       # GitHub runner → GCP Cloud Run
├── frontend/
│   ├── src/
│   ├── public/
│   ├── Dockerfile                # multi-stage: Vite build → nginx serve
│   ├── nginx.conf                # serve static + proxy /api → backend:3000
│   ├── package.json
│   └── vite.config.ts
├── backend/
│   ├── src/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── Dockerfile                # multi-stage: tsc build → runtime Node 22
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml            # ambiente develop (local)
├── docker-compose.prod.yml       # ambiente main (GCP) — detalhado em spec separado
├── .env.example                  # template de variáveis
├── .gitignore
└── package.json                  # scripts raiz: dev, build, test
```

---

## Docker Setup

### `docker-compose.yml` (develop)

```yaml
services:
  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    environment:
      - VITE_API_URL=/api

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    depends_on:
      - redis
    environment:
      - DATABASE_URL=${DATABASE_URL}   # injetado pelo pipeline via .env
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - NODE_ENV=development

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

### `frontend/Dockerfile`

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### `frontend/nginx.conf`

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  location /api/ {
    proxy_pass http://backend:3000/;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

### `backend/Dockerfile`

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

---

## GitHub Actions Workflows

### `deploy-develop.yml`

```yaml
name: Deploy → Develop (Local)

on:
  push:
    branches: [develop]

jobs:
  deploy:
    runs-on: self-hosted
    environment: develop

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Criar .env
        run: |
          cat > .env << EOF
          DATABASE_URL=${{ secrets.DATABASE_URL }}
          JWT_SECRET=${{ secrets.JWT_SECRET }}
          REDIS_URL=redis://redis:6379
          NODE_ENV=development
          EOF

      - name: Rodar migrations
        run: |
          cd backend
          npm ci
          npx prisma migrate deploy

      - name: Build e subir containers
        run: docker compose up -d --build

      - name: Limpar imagens antigas
        run: docker image prune -f
```

### `deploy-main.yml`

```yaml
name: Deploy → Main (GCP Cloud Run)

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Autenticar no GCP
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Configurar gcloud
        uses: google-github-actions/setup-gcloud@v2

      - name: Build e push imagens (Artifact Registry)
        run: |
          gcloud auth configure-docker ${{ secrets.GCP_REGION }}-docker.pkg.dev
          docker build -t ${{ secrets.GCP_REGION }}-docker.pkg.dev/${{ secrets.GCP_PROJECT }}/prosports/backend:${{ github.sha }} ./backend
          docker push ${{ secrets.GCP_REGION }}-docker.pkg.dev/${{ secrets.GCP_PROJECT }}/prosports/backend:${{ github.sha }}

      - name: Rodar migrations
        run: |
          cd backend
          npm ci
          DATABASE_URL=${{ secrets.PROD_DATABASE_URL }} npx prisma migrate deploy

      - name: Deploy no Cloud Run
        run: |
          gcloud run deploy prosports-backend \
            --image ${{ secrets.GCP_REGION }}-docker.pkg.dev/${{ secrets.GCP_PROJECT }}/prosports/backend:${{ github.sha }} \
            --region ${{ secrets.GCP_REGION }} \
            --set-env-vars DATABASE_URL=${{ secrets.PROD_DATABASE_URL }},JWT_SECRET=${{ secrets.PROD_JWT_SECRET }} \
            --allow-unauthenticated
```

---

## GitHub Secrets

| Secret | Ambiente | Descrição |
|--------|----------|-----------|
| `DATABASE_URL` | develop | `postgresql://user:pass@192.168.56.108:5432/newprosports` |
| `JWT_SECRET` | develop | Chave JWT local |
| `GCP_SA_KEY` | production | JSON da Service Account GCP |
| `GCP_PROJECT` | production | ID do projeto GCP |
| `GCP_REGION` | production | Ex: `us-central1` |
| `PROD_DATABASE_URL` | production | PostgreSQL em produção (GCP) |
| `PROD_JWT_SECRET` | production | Chave JWT produção |

---

## Self-hosted Runner (VM `192.168.56.113`)

### Pré-requisitos

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER

curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

### Instalação

```bash
mkdir ~/actions-runner && cd ~/actions-runner
curl -o actions-runner-linux-x64.tar.gz -L <URL_GERADA_PELO_GITHUB>
tar xzf actions-runner-linux-x64.tar.gz
./config.sh --url https://github.com/wmarrane/prosports --token <TOKEN_GERADO>
sudo ./svc.sh install
sudo ./svc.sh start
```

O runner aparecerá em **Settings → Actions → Runners** com status **Idle**.

---

## Conexão com GitHub e Branches

```bash
git remote add origin https://github.com/wmarrane/prosports.git

git checkout -b main
git add .
git commit -m "chore: initial project structure"
git push -u origin main

git checkout -b develop
git push -u origin develop
```

### Regras de proteção

| Branch | Regra |
|--------|-------|
| `main` | Require PR antes de merge; bloquear push direto |
| `develop` | Push direto permitido |

### Fluxo de trabalho

```
feature/xxx  →  develop  →  [deploy automático local]
develop      →  main     →  [deploy GCP, via PR aprovado]
```

---

## Decisões de Design

- **PostgreSQL externo ao compose:** a VM `192.168.56.108` é compartilhada e gerenciada separadamente; o banco `newprosports` é referenciado apenas via `DATABASE_URL`
- **Migrations antes do `docker compose up`:** garante schema atualizado antes do app subir, evitando erros de runtime
- **Runner inicia conexão de saída:** sem necessidade de abrir portas de entrada na VM privada
- **Environments separados no GitHub:** secrets de `develop` e `production` isolados, evitando vazamento entre pipelines
- **Multi-stage Dockerfiles:** imagens de produção mínimas, sem ferramentas de build
- **Frontend GCP fora de escopo:** o `deploy-main.yml` cobre apenas o backend (Cloud Run); deploy do frontend em produção (Cloud Storage + CDN ou segundo Cloud Run) será spec separado quando o ambiente GCP for provisionado
- **`docker-compose.prod.yml`:** estrutura reservada para uso futuro no GCP; não é necessário para o ambiente local
