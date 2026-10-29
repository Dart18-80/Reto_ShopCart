# Contexto de build: raíz del repositorio (necesita el lockfile del workspace).
FROM node:24-alpine AS dependencias
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY database/migrator/package.json database/migrator/
RUN pnpm install --frozen-lockfile --prod --filter @shopcart/migrator

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencias /app/node_modules ./node_modules
COPY --from=dependencias /app/database/migrator/node_modules ./database/migrator/node_modules
COPY database/migrator/package.json database/migrator/
COPY database/migrator/src database/migrator/src
COPY database/migrator/sql database/migrator/sql
COPY database/migrations database/migrations
COPY database/programmability database/programmability
COPY database/seeds database/seeds
USER node
WORKDIR /app/database/migrator
# Node 24 ejecuta TypeScript directamente (type stripping): no hay paso de compilación.
CMD ["node", "src/index.ts"]
