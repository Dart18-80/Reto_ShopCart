# ShopCart

En construcción: ver [docs/](./docs/).

## Requisitos

- Node.js 24 LTS o superior y pnpm 10.
- Docker Desktop. En Windows, con el backend de WSL2.

### Memoria para WSL2 (Windows)

SQL Server queda limitado a 2 GB, pero el entorno completo (SQL Server, Redis, dos réplicas de la API, nginx y, de forma opcional, observabilidad) necesita margen. Se recomienda asignar **10 GB** a WSL2 en `%UserProfile%\.wslconfig`:

```ini
[wsl2]
memory=10GB
```

Después ejecuta `wsl --shutdown` y vuelve a abrir Docker Desktop para que tome el cambio.

## Arranque (en construcción)

```bash
cp .env.example .env              # y cambia los valores marcados como EJEMPLO
docker compose up -d sqlserver redis
docker compose ps                 # ambos servicios deben quedar "healthy"
```
