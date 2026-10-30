# Contexto de build: raíz del repositorio. En la Fase 2 se agrega una etapa que compila la SPA con Vite.
FROM nginx:1.28-alpine
COPY infra/nginx/nginx.conf /etc/nginx/nginx.conf
COPY apps/web/public /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
