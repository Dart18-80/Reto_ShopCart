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

Bash (Linux, macOS, Git Bash):

```bash
cp .env.example .env              # y cambia los valores marcados como EJEMPLO
docker compose up -d sqlserver redis
docker compose ps                 # ambos servicios deben quedar "healthy"
```

PowerShell (Windows):

```powershell
Copy-Item .env.example .env       # y cambia los valores marcados como EJEMPLO
docker compose up -d sqlserver redis
docker compose ps                 # ambos servicios deben quedar "healthy"
```

SQL Server y Redis solo se publican en `127.0.0.1`: son accesibles desde tu máquina (SSMS, Azure Data Studio, pruebas), no desde la red.

> **Licencia de SQL Server:** el entorno usa la edición **Developer** (`MSSQL_PID=Developer`), gratuita para desarrollo y pruebas pero **no licenciada para producción**. En producción se usaría Standard o Enterprise (o Express, con sus límites).
