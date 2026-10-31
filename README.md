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
docker compose up -d              # SQL Server, Redis, migrador, api-1, api-2 y nginx
docker compose ps                 # todo "healthy"; db-migrator "Exited (0)"
```

PowerShell (Windows):

```powershell
Copy-Item .env.example .env       # y cambia los valores marcados como EJEMPLO
docker compose up -d              # SQL Server, Redis, migrador, api-1, api-2 y nginx
docker compose ps                 # todo "healthy"; db-migrator "Exited (0)"
```

Todo se sirve en <http://localhost:8080>: `/api/*` va a las réplicas y `/` a la web. API: `http://localhost:8080/api/v1/health` · Swagger: `http://localhost:8080/api/docs`.

SQL Server y Redis solo se publican en `127.0.0.1`: son accesibles desde tu máquina (SSMS, Azure Data Studio, pruebas), no desde la red. nginx se publica en `WEB_IP` (por defecto `127.0.0.1`; con `0.0.0.0` queda visible en la red local).

Los contenedores viven en una subred fija (`RED_PREFIJO`, por defecto `172.28.10`, en `.env`) con una IP fija por servicio, y cada uno resuelve los nombres de los demás desde su `/etc/hosts`. Así, si un servicio está detenido, su nombre nunca se consulta al DNS del host (que podría devolver una IP pública). Si esa subred choca con otra red de tu máquina, cambia `RED_PREFIJO` y vuelve a levantar con `docker compose down && docker compose up -d`.

### Balanceo entre réplicas (demo)

```bash
for i in 1 2 3 4; do curl -s -o /dev/null -D - localhost:8080/api/v1/health | grep -i x-instancia; done
# X-Instancia alterna: api-1, api-2, api-1, api-2

docker compose stop api-1         # la tienda sigue respondiendo, todo desde api-2
docker compose start api-1        # nginx la reincorpora sola
```

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

### Datos demo

Las semillas cargan los catálogos fijos, los 22 departamentos y 340 municipios de Guatemala y un catálogo de ropa, calzado y accesorios (61 productos, 244 variantes, imágenes en `apps/web/public/static/productos/`). Cuentas de prueba:

| Correo                 | Contraseña      | Rol                                                             |
| ---------------------- | --------------- | --------------------------------------------------------------- |
| `admin@shopcart.gt`    | `Admin2026!`    | Administrador                                                   |
| `operador@shopcart.gt` | `Operador2026!` | Operador                                                        |
| `cliente@shopcart.gt`  | `Cliente2026!`  | Cliente                                                         |
| `cliente2@shopcart.gt` | `Cliente2026!`  | Cliente (para demostrar que un cliente no ve los datos de otro) |

La variante `DEMO-CONCURRENCIA` es la única con una sola unidad: sirve para la demo de compra simultánea (RF-06).

### API (desarrollo, desde el host)

Requiere SQL Server y Redis levantados y la base migrada:

```bash
pnpm --filter @shopcart/api build
pnpm --filter @shopcart/api start      # http://localhost:3000/api/v1/health · Swagger en /api/docs
```

### Pruebas

```bash
pnpm test                # unitarias: servicios y middlewares con puertos falsos, sin infraestructura
pnpm test:integracion    # contra SQL Server real (requiere `docker compose up -d sqlserver`)
```

`pnpm test:integracion` recrea la base `shopcart_test` desde cero en cada corrida (las tablas ledger no admiten `DELETE`), aplica todos los scripts y, solo en esa base, los SPs de `database/test/`. Las pruebas no escriben SQL: preparan sus datos con esos `SP_Pruebas_*`, y cada prueba crea datos únicos en lugar de borrar los de otras.

La API usa timeouts explícitos hacia SQL Server: `DB_TIMEOUT_CONEXION_MS` (por defecto 2000) y `DB_TIMEOUT_CONSULTA_MS` (por defecto 15000). Con la base caída, el health responde `503` en unos 2 s.

Redis exige contraseña (`requirepass`). Cada valor tiene una sola fuente en `.env` (`DB_HOST`, `DB_PORT`, `DB_USUARIO`, `DB_CONTRASENA`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_CONTRASENA`): Compose, el migrador y la API leen las mismas variables.

> **Licencia de SQL Server:** el entorno usa la edición **Developer** (`MSSQL_PID=Developer`), gratuita para desarrollo y pruebas pero **no licenciada para producción**. En producción se usaría Standard o Enterprise (o Express, con sus límites).
