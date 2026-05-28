# CI/CD & Deploy Automático — prosports — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configurar o monorepo prosports com Docker, GitHub Actions e self-hosted runner para deploy automático no ambiente local (develop) e GCP Cloud Run (main).

**Architecture:** Monorepo com `frontend/` (React + Vite + nginx) e `backend/` (Node 22 + Express + Prisma). O branch `develop` faz deploy automático via self-hosted runner na VM `192.168.56.113`. O branch `main` faz deploy no GCP Cloud Run via runner cloud do GitHub Actions.

**Tech Stack:** Node 22, TypeScript 5.6, React 18, Vite 5.4, Express 4, Prisma 5.22, PostgreSQL, Redis 7-alpine, Docker, docker-compose, nginx, GitHub Actions.

---

## Arquivos do Plano

| Arquivo | Ação |
|---------|------|
| `backend/src/index.ts` | mover de `src/index.ts` |
| `backend/package.json` | mover de `package.json` raiz |
| `backend/tsconfig.json` | mover de `tsconfig.json` raiz |
| `backend/Dockerfile` | criar |
| `backend/prisma/schema.prisma` | criar |
| `frontend/` | scaffold via Vite |
| `frontend/Dockerfile` | criar |
| `frontend/nginx.conf` | criar |
| `docker-compose.yml` | criar |
| `docker-compose.prod.yml` | criar (placeholder) |
| `.env.example` | criar |
| `.gitignore` | atualizar |
| `package.json` (raiz) | atualizar (scripts raiz) |
| `.github/workflows/deploy-develop.yml` | criar |
| `.github/workflows/deploy-main.yml` | criar |

---

## Task 1: Reestruturar monorepo — mover backend para `backend/`

**Files:**
- Create: `backend/src/index.ts`
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Modify: `package.json` (raiz)
- Delete: `src/index.ts`, `tsconfig.json` (raiz)

- [ ] **Step 1: Criar pasta `backend/src/` e mover `src/index.ts`**

```powershell
New-Item -ItemType Directory -Force backend\src
Move-Item src\index.ts backend\src\index.ts
Remove-Item -Recurse src
```

- [ ] **Step 2: Criar `backend/package.json`**

```json
{
  "name": "prosports-backend",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "ts-node src/index.ts",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "express": "^4.19.2",
    "@prisma/client": "^5.22.0",
    "zod": "^3.23.8",
    "jsonwebtoken": "^9.0.2",
    "pino": "^9.4.0",
    "exceljs": "^4.4.0",
    "multer": "^1.4.5-lts.1",
    "node-cron": "^3.0.3",
    "redis": "^4.7.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "prisma": "^5.22.0",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/multer": "^1.4.11",
    "@types/node": "^22.0.0",
    "ts-node": "^10.9.2",
    "vitest": "^2.1.9"
  }
}
```

- [ ] **Step 3: Criar `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "commonjs",
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Remover `tsconfig.json` da raiz (agora está em `backend/`)**

```powershell
Remove-Item tsconfig.json
```

- [ ] **Step 5: Atualizar `package.json` raiz com scripts de conveniência**

Substituir conteúdo de `package.json` (raiz):

```json
{
  "name": "prosports",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev:backend": "cd backend && npm run dev",
    "dev:frontend": "cd frontend && npm run dev",
    "build:backend": "cd backend && npm run build",
    "build:frontend": "cd frontend && npm run build",
    "test:backend": "cd backend && npm test",
    "test:frontend": "cd frontend && npm test"
  }
}
```

- [ ] **Step 6: Instalar dependências do backend**

```powershell
cd backend
npm install
cd ..
```

Expected: `node_modules/` criado em `backend/`, sem erros.

- [ ] **Step 7: Verificar build TypeScript do backend**

```powershell
cd backend
npm run build
cd ..
```

Expected: pasta `backend/dist/` criada com `index.js`.

- [ ] **Step 8: Commit**

```powershell
# Desstagia os arquivos antigos (src/ e tsconfig.json ainda não foram commitados — estão só staged)
git restore --staged src/ tsconfig.json
# Adiciona tudo: backend/ com os novos arquivos, package.json atualizado
git add backend/ package.json
git commit -m "chore: restructure monorepo — move backend to backend/"
```

---

## Task 2: Scaffold frontend com Vite + React + TypeScript

**Files:**
- Create: `frontend/` (gerado pelo Vite)

- [ ] **Step 1: Criar projeto Vite na pasta `frontend/`**

```powershell
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

Expected: pasta `frontend/` com estrutura React + TypeScript padrão do Vite.

- [ ] **Step 2: Instalar dependências da stack**

```powershell
cd frontend
npm install react-router-dom@6 @tanstack/react-query@5 zustand@5 axios lucide-react recharts
npm install -D tailwindcss@4 @tailwindcss/vite autoprefixer
cd ..
```

Expected: sem erros de instalação.

- [ ] **Step 3: Verificar build do frontend**

```powershell
cd frontend
npm run build
cd ..
```

Expected: pasta `frontend/dist/` criada com `index.html` e assets.

- [ ] **Step 4: Commit**

```powershell
git add frontend/
git commit -m "chore: scaffold frontend with Vite + React + TypeScript"
```

---

## Task 3: Criar schema Prisma inicial

**Files:**
- Create: `backend/prisma/schema.prisma`

- [ ] **Step 1: Criar `backend/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

- [ ] **Step 2: Rodar `prisma generate` para verificar**

```powershell
cd backend
npx prisma generate
cd ..
```

Expected: `Generated Prisma Client` sem erros.

- [ ] **Step 3: Commit**

```powershell
git add backend/prisma/
git commit -m "chore: add initial Prisma schema"
```

---

## Task 4: Criar `backend/Dockerfile` multi-stage

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`

- [ ] **Step 1: Criar `backend/.dockerignore`**

```
node_modules
dist
.env
*.log
```

- [ ] **Step 2: Criar `backend/Dockerfile`**

```dockerfile
# Estágio 1: build TypeScript
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# Estágio 2: runtime mínimo
FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

- [ ] **Step 3: Verificar que o build Docker funciona**

```powershell
docker build -t prosports-backend:test ./backend
```

Expected: `Successfully built` sem erros.

- [ ] **Step 4: Limpar imagem de teste**

```powershell
docker rmi prosports-backend:test
```

- [ ] **Step 5: Commit**

```powershell
git add backend/Dockerfile backend/.dockerignore
git commit -m "chore: add backend multi-stage Dockerfile"
```

---

## Task 5: Criar `frontend/nginx.conf` e `frontend/Dockerfile`

**Files:**
- Create: `frontend/nginx.conf`
- Create: `frontend/Dockerfile`
- Create: `frontend/.dockerignore`

- [ ] **Step 1: Criar `frontend/nginx.conf`**

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://backend:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 2: Criar `frontend/.dockerignore`**

```
node_modules
dist
.env
*.log
```

- [ ] **Step 3: Criar `frontend/Dockerfile`**

```dockerfile
# Estágio 1: build Vite
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Estágio 2: nginx serve
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] **Step 4: Verificar que o build Docker funciona**

```powershell
docker build -t prosports-frontend:test ./frontend
```

Expected: `Successfully built` sem erros.

- [ ] **Step 5: Limpar imagem de teste**

```powershell
docker rmi prosports-frontend:test
```

- [ ] **Step 6: Commit**

```powershell
git add frontend/nginx.conf frontend/Dockerfile frontend/.dockerignore
git commit -m "chore: add frontend Dockerfile with nginx proxy"
```

---

## Task 6: Criar `docker-compose.yml` e `.env.example`

**Files:**
- Create: `docker-compose.yml`
- Create: `docker-compose.prod.yml`
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Criar `.env.example`**

```env
# Backend
DATABASE_URL=postgresql://prosports:SENHA@192.168.56.108:5432/newprosports
REDIS_URL=redis://redis:6379
JWT_SECRET=troque-por-um-segredo-forte
NODE_ENV=development

# Frontend (build time)
VITE_API_URL=/api
```

- [ ] **Step 2: Criar `docker-compose.yml`**

```yaml
services:
  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    depends_on:
      - redis
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
      - NODE_ENV=${NODE_ENV:-development}
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  redis_data:
```

- [ ] **Step 3: Criar `docker-compose.prod.yml` (placeholder GCP)**

```yaml
# Placeholder para deploy GCP — configurado em spec separado
# Referencia imagens do Artifact Registry em vez de builds locais
services:
  backend:
    image: ${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT}/prosports/backend:${IMAGE_TAG}
    environment:
      - DATABASE_URL=${PROD_DATABASE_URL}
      - JWT_SECRET=${PROD_JWT_SECRET}
      - NODE_ENV=production
```

- [ ] **Step 4: Atualizar `.gitignore`**

```gitignore
# Dependências
node_modules/
backend/node_modules/
frontend/node_modules/

# Build
dist/
backend/dist/
frontend/dist/

# Ambiente
.env
.env.local
.env.*.local

# Logs
*.log
logs/

# OS
.DS_Store
Thumbs.db

# IDE
.idea/
.vscode/

# Docker
.dockerignore
```

- [ ] **Step 5: Verificar que o docker-compose valida sem erros**

Criar um `.env` temporário para teste:

```powershell
Copy-Item .env.example .env
```

Editar `.env` e preencher `DATABASE_URL` com:
```
DATABASE_URL=postgresql://prosports:erp0192@192.168.56.108:5432/newprosports
```

```powershell
docker compose config
```

Expected: configuração YAML expandida sem erros de validação.

- [ ] **Step 6: Commit**

```powershell
git add docker-compose.yml docker-compose.prod.yml .env.example .gitignore
git commit -m "chore: add docker-compose and environment template"
```

---

## Task 7: Criar GitHub Actions — `deploy-develop.yml`

**Files:**
- Create: `.github/workflows/deploy-develop.yml`

- [ ] **Step 1: Criar pasta `.github/workflows/`**

```powershell
New-Item -ItemType Directory -Force .github\workflows
```

- [ ] **Step 2: Criar `.github/workflows/deploy-develop.yml`**

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
          REDIS_URL=redis://redis:6379
          JWT_SECRET=${{ secrets.JWT_SECRET }}
          NODE_ENV=development
          EOF

      - name: Instalar dependências do backend
        run: cd backend && npm ci

      - name: Rodar migrations Prisma
        run: cd backend && DATABASE_URL=${{ secrets.DATABASE_URL }} npx prisma migrate deploy

      - name: Build e subir containers
        run: docker compose up -d --build

      - name: Limpar imagens antigas
        run: docker image prune -f
```

- [ ] **Step 3: Commit**

```powershell
git add .github/
git commit -m "ci: add deploy-develop workflow for self-hosted runner"
```

---

## Task 8: Criar GitHub Actions — `deploy-main.yml`

**Files:**
- Create: `.github/workflows/deploy-main.yml`

- [ ] **Step 1: Criar `.github/workflows/deploy-main.yml`**

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

      - name: Configurar Docker para Artifact Registry
        run: gcloud auth configure-docker ${{ secrets.GCP_REGION }}-docker.pkg.dev

      - name: Build e push imagem backend
        run: |
          docker build \
            -t ${{ secrets.GCP_REGION }}-docker.pkg.dev/${{ secrets.GCP_PROJECT }}/prosports/backend:${{ github.sha }} \
            ./backend
          docker push \
            ${{ secrets.GCP_REGION }}-docker.pkg.dev/${{ secrets.GCP_PROJECT }}/prosports/backend:${{ github.sha }}

      - name: Instalar dependências e rodar migrations
        run: |
          cd backend
          npm ci
          DATABASE_URL=${{ secrets.PROD_DATABASE_URL }} npx prisma migrate deploy

      - name: Deploy no Cloud Run
        run: |
          gcloud run deploy prosports-backend \
            --image ${{ secrets.GCP_REGION }}-docker.pkg.dev/${{ secrets.GCP_PROJECT }}/prosports/backend:${{ github.sha }} \
            --region ${{ secrets.GCP_REGION }} \
            --set-env-vars "DATABASE_URL=${{ secrets.PROD_DATABASE_URL }},JWT_SECRET=${{ secrets.PROD_JWT_SECRET }},NODE_ENV=production" \
            --allow-unauthenticated \
            --platform managed
```

- [ ] **Step 2: Commit**

```powershell
git add .github/workflows/deploy-main.yml
git commit -m "ci: add deploy-main workflow for GCP Cloud Run"
```

---

## Task 9: Conectar ao GitHub e configurar branches

**Pré-requisito:** repositório `https://github.com/wmarrane/prosports` deve existir no GitHub (crie em github.com/new se ainda não existir).

- [ ] **Step 1: Adicionar remote origin**

```powershell
git remote add origin https://github.com/wmarrane/prosports.git
```

- [ ] **Step 2: Renomear branch atual para `main` e fazer push**

```powershell
git branch -M main
git push -u origin main
```

Expected: branch `main` aparece em `https://github.com/wmarrane/prosports`.

- [ ] **Step 3: Criar e fazer push do branch `develop`**

```powershell
git checkout -b develop
git push -u origin develop
```

Expected: branch `develop` aparece no GitHub.

- [ ] **Step 4: Proteger branch `main` no GitHub**

No GitHub: **Settings → Branches → Add branch protection rule**

- Branch name pattern: `main`
- Marcar: "Require a pull request before merging"
- Marcar: "Do not allow bypassing the above settings"
- Salvar

- [ ] **Step 5: Verificar branches no GitHub**

```powershell
git remote -v
git branch -a
```

Expected:
```
origin  https://github.com/wmarrane/prosports.git (fetch)
origin  https://github.com/wmarrane/prosports.git (push)
remotes/origin/main
remotes/origin/develop
```

---

## Task 10: Configurar GitHub Secrets

No GitHub: **Settings → Secrets and variables → Actions**

- [ ] **Step 1: Criar environment `develop`**

**Settings → Environments → New environment** → nome: `develop`

Adicionar os seguintes secrets no environment `develop`:

| Nome | Valor |
|------|-------|
| `DATABASE_URL` | `postgresql://prosports:erp0192@192.168.56.108:5432/newprosports` |
| `JWT_SECRET` | (gerar: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |

- [ ] **Step 2: Criar environment `production`**

**Settings → Environments → New environment** → nome: `production`

Adicionar os seguintes secrets no environment `production`:

| Nome | Valor |
|------|-------|
| `GCP_SA_KEY` | JSON da Service Account GCP (configurar quando GCP for provisionado) |
| `GCP_PROJECT` | ID do projeto GCP |
| `GCP_REGION` | Ex: `us-central1` |
| `PROD_DATABASE_URL` | PostgreSQL de produção no GCP |
| `PROD_JWT_SECRET` | (gerar igual ao develop, valor diferente) |

> **Nota:** secrets do environment `production` podem ser deixados como placeholder por enquanto. O workflow `deploy-main.yml` só roda quando há push em `main`, que requer PR aprovado.

---

## Task 11: Instalar self-hosted runner na VM `192.168.56.113`

**Executar via SSH na VM `192.168.56.113`.**

- [ ] **Step 1: Instalar Docker + Docker Compose na VM**

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin curl
sudo usermod -aG docker $USER
newgrp docker
```

Verificar:
```bash
docker --version
docker compose version
```

Expected: versões impressas sem erro.

- [ ] **Step 2: Instalar Node 22 na VM**

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version
```

Expected: `v22.x.x`

- [ ] **Step 3: Obter token do runner no GitHub**

No GitHub: **Settings → Actions → Runners → New self-hosted runner**
- OS: Linux
- Architecture: x64

Copiar o token gerado (válido por 1 hora).

- [ ] **Step 4: Baixar e configurar o runner na VM**

```bash
mkdir ~/actions-runner && cd ~/actions-runner

# URL e token são gerados pelo GitHub em Settings → Actions → Runners → New self-hosted runner
# Copie os valores exatos da tela do GitHub — o token expira em 1 hora
curl -o actions-runner-linux-x64.tar.gz -L <URL_GERADA_PELO_GITHUB>
tar xzf actions-runner-linux-x64.tar.gz

# Registrar o runner
./config.sh \
  --url https://github.com/wmarrane/prosports \
  --token <TOKEN_GERADO_PELO_GITHUB> \
  --name prosports-local-runner \
  --labels self-hosted \
  --unattended
```

Expected: `Runner successfully added` e `Runner settings saved.`

- [ ] **Step 5: Instalar como serviço systemd**

```bash
sudo ./svc.sh install
sudo ./svc.sh start
sudo ./svc.sh status
```

Expected: `active (running)`

- [ ] **Step 6: Verificar runner no GitHub**

No GitHub: **Settings → Actions → Runners**

Expected: `prosports-local-runner` com status **Idle**.

---

## Task 12: Validar pipeline end-to-end

- [ ] **Step 1: Fazer uma alteração no branch `develop` e push**

```powershell
git checkout develop
# Editar backend/src/index.ts: adicionar console.log('Server starting...')
git add backend/src/index.ts
git commit -m "test: trigger develop deploy pipeline"
git push origin develop
```

- [ ] **Step 2: Acompanhar o pipeline no GitHub**

No GitHub: **Actions → Deploy → Develop (Local)**

Verificar que todos os steps passam:
- Checkout ✓
- Criar .env ✓
- Instalar dependências ✓
- Rodar migrations ✓
- Build e subir containers ✓
- Limpar imagens ✓

- [ ] **Step 3: Verificar containers rodando na VM**

```bash
# SSH na VM 192.168.56.113
docker compose ps
```

Expected:
```
NAME                STATUS
prosports-frontend  Up
prosports-backend   Up
prosports-redis     Up
```

- [ ] **Step 4: Verificar acesso à aplicação**

```bash
curl http://192.168.56.113
```

Expected: HTML do frontend servido pelo nginx.

```bash
curl http://192.168.56.113/api/
```

Expected: resposta JSON do backend (ou 404 de rota não definida — confirma que o proxy nginx → backend funciona).

---

## Referência de Secrets

| Secret | Ambiente | Valor |
|--------|----------|-------|
| `DATABASE_URL` | develop | `postgresql://prosports:erp0192@192.168.56.108:5432/newprosports` |
| `JWT_SECRET` | develop | gerado com `crypto.randomBytes(32).toString('hex')` |
| `GCP_SA_KEY` | production | JSON Service Account (configurar ao provisionar GCP) |
| `GCP_PROJECT` | production | ID projeto GCP |
| `GCP_REGION` | production | região GCP (ex: `us-central1`) |
| `PROD_DATABASE_URL` | production | PostgreSQL GCP |
| `PROD_JWT_SECRET` | production | gerado separadamente |
