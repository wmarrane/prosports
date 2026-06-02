# Estágio 1: build Vite
# node:22-alpine atual quebra com "npm error Exit handler never called"
# durante npm ci no runner (bug do npm com network/dns nessa imagem).
# Mantemos 20-alpine LTS estável.
FROM node:20-alpine AS builder
ARG APP_COMMIT=unknown
ENV APP_COMMIT=$APP_COMMIT
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
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
