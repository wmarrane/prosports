# Estágio 1: build TypeScript
# node:24-alpine (npm 11) — node 20 entrou em maintenance/EOL (abr/2026).
# Obs.: node:22-alpine antigo quebrava com "npm error Exit handler never
# called" no npm ci (bug do npm já resolvido nas versões mais novas).
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN if grep -q "^model " prisma/schema.prisma 2>/dev/null; then npx prisma generate; fi
RUN npm run build

# Estágio 2: runtime mínimo
FROM node:24-alpine
# Prisma schema-engine precisa de openssl em runtime no Alpine.
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/templates ./templates
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
ENV PRISMA_QUERY_ENGINE_LIBRARY=/app/node_modules/.prisma/client/libquery_engine-linux-musl-openssl-3.0.x.so.node
EXPOSE 3000
CMD ["node", "dist/index.js"]
