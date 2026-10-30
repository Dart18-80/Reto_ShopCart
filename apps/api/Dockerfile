# Contexto de build: raíz del repositorio (necesita el lockfile del workspace).
FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/

FROM base AS build
RUN pnpm install --frozen-lockfile --filter @shopcart/api
COPY tsconfig.base.json ./
COPY apps/api/tsconfig.json apps/api/tsconfig.build.json apps/api/
COPY apps/api/src apps/api/src
RUN pnpm --filter @shopcart/api build

FROM base AS dependencias
RUN pnpm install --frozen-lockfile --prod --filter @shopcart/api

# Imagen final sin compilador, fuentes TypeScript ni pnpm.
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencias /app/node_modules ./node_modules
COPY --from=dependencias /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY apps/api/package.json apps/api/
USER node
WORKDIR /app/apps/api
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/v1/health || exit 1
# node como PID 1 recibe SIGTERM directamente: el apagado ordenado vive en server.ts.
CMD ["node", "dist/server.js"]
