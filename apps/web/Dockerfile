# Contexto de build: raíz del repositorio (necesita el lockfile del workspace).
# Versión exacta y digest: se actualiza a propósito (README, «Actualizar las imágenes»), nunca con un pull.
FROM node:24.22.2-alpine3.24@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
# "..." instala también las dependencias de workspace de la web (@shopcart/shared).
RUN pnpm install --frozen-lockfile --filter @shopcart/web...
COPY tsconfig.base.json ./
COPY packages/shared/tsconfig.json packages/shared/tsconfig.build.json packages/shared/
COPY packages/shared/src packages/shared/src
COPY apps/web apps/web
RUN pnpm --filter @shopcart/shared build && pnpm --filter @shopcart/web build

# A-03: el mismo nginx sirve la SPA (y /static) y balancea la API: un solo origen.
FROM nginx:1.28.3-alpine3.23@sha256:a8b39bd9cf0f83869a2162827a0caf6137ddf759d50a171451b335cecc87d236
COPY infra/nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
