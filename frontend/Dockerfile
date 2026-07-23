# Estágio 1: build Vite
# node:24-alpine (npm 11) — node 20 entrou em maintenance/EOL (abr/2026).
# Obs.: node:22-alpine antigo quebrava com "npm error Exit handler never
# called" no npm ci (bug do npm já resolvido nas versões mais novas).
FROM node:24-alpine AS builder
ARG APP_COMMIT=unknown
ENV APP_COMMIT=$APP_COMMIT
WORKDIR /app
# Resiliência de rede no build (VM com rede/DNS instável pós-restart):
# retries + timeouts maiores e menos conexões paralelas evitam ETIMEDOUT no npm ci.
ENV NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_FETCH_TIMEOUT=600000 \
    NPM_CONFIG_MAXSOCKETS=3
COPY frontend/package*.json ./
# O package-lock.json é gerado no Windows; `npm ci` omite o binário opcional
# linux-musl do lightningcss (bug de optional deps), quebrando o Tailwind v4.
# Instala o binário casando a versão do lightningcss já instalado.
RUN npm ci && \
    npm install --no-save "lightningcss-linux-x64-musl@$(node -p "require('lightningcss/package.json').version")"
COPY frontend/ ./
# Arquivos do repo root usados pelo vite.config.ts
# (getVersion lê /package.json; copy-changelog plugin lê /CHANGELOG.md)
COPY package.json /package.json
COPY CHANGELOG.md /CHANGELOG.md
RUN npm run build

# Estágio 2: nginx serve
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
