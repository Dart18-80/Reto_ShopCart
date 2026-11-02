# Contexto de build: raíz del repositorio. En la Fase 2 se agrega una etapa que compila la SPA con Vite.
# Versión exacta y digest: se actualiza a propósito (README, «Actualizar las imágenes»), nunca con un pull.
FROM nginx:1.28.3-alpine3.23@sha256:a8b39bd9cf0f83869a2162827a0caf6137ddf759d50a171451b335cecc87d236
COPY infra/nginx/nginx.conf /etc/nginx/nginx.conf
COPY apps/web/public /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
