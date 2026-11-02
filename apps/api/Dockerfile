# Contexto de build: raíz del repositorio (necesita el lockfile del workspace).
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
# "..." instala también las dependencias de workspace de la API (@shopcart/shared).
RUN pnpm install --frozen-lockfile --filter @shopcart/api...
COPY tsconfig.base.json ./
COPY packages/shared/tsconfig.json packages/shared/tsconfig.build.json packages/shared/
COPY packages/shared/src packages/shared/src
COPY apps/api/tsconfig.json apps/api/tsconfig.build.json apps/api/
COPY apps/api/src apps/api/src
# shared primero: la API compila contra su dist/ (tipos .d.ts), no contra su código fuente.
RUN pnpm --filter @shopcart/shared build && pnpm --filter @shopcart/api build
# Poda el workspace: solo la API con sus dependencias de producción; @shopcart/shared se copia como
# paquete (solo sus "files": dist/), no como enlace a packages/shared.
RUN pnpm deploy --filter @shopcart/api --prod --legacy /prod/api

# Imagen final: solo JavaScript compilado y dependencias de producción. Sin src/, TypeScript ni pnpm.
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /prod/api/package.json ./
COPY --from=build /prod/api/node_modules ./node_modules
COPY --from=build /prod/api/dist ./dist
# A-24: el punto de montaje del volumen de exportaciones. Docker copia su dueño (node) al volumen la primera vez.
RUN mkdir -p /var/lib/shopcart/exportaciones && chown node:node /var/lib/shopcart/exportaciones
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/v1/health || exit 1
# node como PID 1 recibe SIGTERM directamente: el apagado ordenado vive en server.ts.
CMD ["node", "dist/server.js"]
