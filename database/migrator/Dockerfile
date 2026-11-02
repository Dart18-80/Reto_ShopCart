# Contexto de build: raíz del repositorio (necesita el lockfile del workspace).
# Versión exacta y digest: se actualiza a propósito (README, «Actualizar las imágenes»), nunca con un pull.
FROM node:24.22.2-alpine3.24@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS dependencias
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY database/migrator/package.json database/migrator/
RUN pnpm install --frozen-lockfile --prod --filter @shopcart/migrator

FROM node:24.22.2-alpine3.24@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85
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
COPY database/test database/test
USER node
WORKDIR /app/database/migrator
# Node 24 ejecuta TypeScript directamente (type stripping): no hay paso de compilación.
CMD ["node", "src/index.ts"]
