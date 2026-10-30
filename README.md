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

### Migraciones de base de datos

`db-migrator` crea la base, los logins y aplica los scripts de `database/` en orden `migrations/V###` → `programmability/R__*` → `seeds/S###`. Se ejecuta solo y termina:

```bash
docker compose up -d --build db-migrator   # tras agregar o cambiar scripts
docker compose logs db-migrator
```

Base de pruebas (`shopcart_test`), con Compose o desde el host:

```bash
docker compose run --rm -e DB_NOMBRE=shopcart_test db-migrator
DB_NOMBRE=shopcart_test pnpm db:migrar                    # Bash
```

```powershell
$env:DB_NOMBRE = 'shopcart_test'; pnpm db:migrar; Remove-Item Env:DB_NOMBRE   # PowerShell
```

Un `V###` o `S###` ya aplicado **no se edita**: si cambia, el migrador falla. Se crea un script nuevo con el siguiente número.

### API (desarrollo, desde el host)

Requiere SQL Server y Redis levantados y la base migrada:

```bash
pnpm --filter @shopcart/api build
pnpm --filter @shopcart/api start      # http://localhost:3000/api/v1/health · Swagger en /api/docs
pnpm test                               # pruebas unitarias
```

Redis exige contraseña (`requirepass`). Cada valor tiene una sola fuente en `.env` (`DB_HOST`, `DB_PORT`, `DB_USUARIO`, `DB_CONTRASENA`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_CONTRASENA`): Compose, el migrador y la API leen las mismas variables.

> **Licencia de SQL Server:** el entorno usa la edición **Developer** (`MSSQL_PID=Developer`), gratuita para desarrollo y pruebas pero **no licenciada para producción**. En producción se usaría Standard o Enterprise (o Express, con sus límites).
