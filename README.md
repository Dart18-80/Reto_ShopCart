# ShopCart

Tienda en línea de una cadena guatemalteca de ropa, calzado y accesorios: catálogo con variantes, carrito de invitado y de cliente, cupones, checkout con pasarela de pago simulada, pedidos con ciclo de vida, inventario con kardex, devoluciones, bitácora y dashboard.

**Fase 1 (esta entrega):** backend completo (Express 5 + TypeScript + SQL Server 2022) con dos réplicas detrás de nginx. El frontend es la Fase 2.

| Documento                                                        | Contenido                                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [docs/enunciado-shopcart.md](docs/enunciado-shopcart.md)         | El enunciado oficial del reto                                                        |
| [docs/00-vision-y-contexto.md](docs/00-vision-y-contexto.md)     | Decisiones de negocio (`N-xx`), no funcionales (`RNF-xx`) y generales (`D-xx`)       |
| [docs/01-arquitectura.md](docs/01-arquitectura.md)               | Arquitectura (`A-xx`), flujos críticos, errores y API                                |
| [docs/02-modelo-datos.md](docs/02-modelo-datos.md)               | Tablas, constraints, índices, SPs, vistas, funciones y códigos de error (`M-xx`)     |
| [docs/03-backlog.md](docs/03-backlog.md)                         | Historias, criterios de aceptación y tablero                                         |
| [docs/04-verificacion-fase-1.md](docs/04-verificacion-fase-1.md) | Checklist de penalizaciones y la prueba que demuestra cada criterio de RF-01 a RF-09 |

---

## 1. Instalación desde cero

### Requisitos

- **Docker Desktop** (en Windows, con el backend de WSL2) con **Compose v2** (el comando `docker compose`, no el antiguo `docker-compose`), y **Git**. Probado con Docker Engine 27.0 y Compose 2.28.
- Para correr las pruebas desde el host: **Node.js 24 LTS** y **pnpm 10** (`corepack enable` lo activa).
- **Memoria:** mínimo **4 GB asignados a Docker** (SQL Server exige 2 GB y no arranca con menos). Uso medido con el entorno en reposo: ~1.9 GB (SQL Server 1.7 GB, cada réplica de la API ~90 MB, Redis y nginx ~10 MB cada uno). Para construir las imágenes y correr las pruebas a la vez hace falta más margen (en Windows, la recomendación para WSL2 de abajo).
- **Disco:** unos 3 GB para las imágenes (SQL Server ocupa 1.7 GB) más la base.
- **Mac con Apple Silicon (M1 o posterior):** la imagen de SQL Server solo existe para `amd64`. En Docker Desktop, activa **Settings → General → "Use Rosetta for x86_64/amd64 emulation on Apple Silicon"** antes del primer `docker compose up`. Sin Rosetta, SQL Server se cae al arrancar. Con la emulación, el primer arranque y las consultas son más lentos que en una máquina x86.

**Memoria para WSL2 (Windows).** SQL Server queda limitado a 2 GB, pero el entorno completo (SQL Server, Redis, dos réplicas de la API y nginx) necesita margen. Se recomienda asignar **10 GB** a WSL2 en `%UserProfile%\.wslconfig`, y después ejecutar `wsl --shutdown` y volver a abrir Docker Desktop:

```ini
[wsl2]
memory=10GB
```

### Levantar el entorno

Bash (Linux, macOS, Git Bash):

```bash
git clone <url-del-repositorio> shopcart && cd shopcart
cp .env.example .env              # los valores de ejemplo funcionan en local; cámbialos fuera de tu máquina
docker compose up -d              # SQL Server, Redis, migrador, api-1, api-2 y nginx
docker compose ps                 # todo "healthy"; db-migrator "Exited (0)"
```

PowerShell (Windows):

```powershell
git clone <url-del-repositorio> shopcart; cd shopcart
Copy-Item .env.example .env       # los valores de ejemplo funcionan en local; cámbialos fuera de tu máquina
docker compose up -d              # SQL Server, Redis, migrador, api-1, api-2 y nginx
docker compose ps                 # todo "healthy"; db-migrator "Exited (0)"
```

El primer arranque descarga las imágenes y construye la API y la web. El migrador crea la base y los logins, y aplica todos los scripts de `database/`, incluidos los datos demo. Cuando termina, las réplicas quedan `healthy`.

- **Con las imágenes base ya descargadas:** unos **2 minutos** desde un clon nuevo, construcción incluida (medido en dos ensayos: 92 s y 118 s).
- **La primera vez en una máquina:** se suman unos 2 GB de descarga (SQL Server, Node, nginx y Redis); con 50 Mbps son unos 5 minutos más.

| URL                                           | Qué es                                                |
| --------------------------------------------- | ----------------------------------------------------- |
| <http://localhost:8080/api/docs>              | Swagger (OpenAPI 3.1 generado desde los esquemas Zod) |
| <http://localhost:8080/api/v1/health>         | Estado de la réplica, de SQL Server y de Redis        |
| <http://localhost:8080/api/docs/openapi.json> | El documento OpenAPI                                  |

> En Windows, `localhost` se resuelve primero a IPv6 (`::1`) y nginx escucha en `127.0.0.1`: cada petición de un script paga unos 200 ms de reintento. Para medir tiempos, usa `http://127.0.0.1:8080` (la API responde en menos de 20 ms).

Para empezar de cero (borra la base): `docker compose down -v && docker compose up -d`.

Redis corre con el usuario `redis`, no como root. Un entorno levantado antes de ese cambio puede tener en `/data` un `dump.rdb` de root que impide arrancar a Redis. Se recrea sin perder nada importante, porque Redis solo guarda lo que se puede perder: `docker compose rm -sfv redis && docker compose up -d redis`.

### Variables de entorno

Cada valor tiene una sola fuente en `.env`: Compose, el migrador y la API leen las mismas variables (`.env.example` documenta cada una). `.env` está en `.gitignore`: el repositorio no tiene credenciales reales.

**Puertos del host.** Si alguno está ocupado, cámbialo en `.env` y vuelve a levantar con `docker compose up -d`:

| Puerto | Servicio                              | Variable en `.env` | Publicado en                     |
| ------ | ------------------------------------- | ------------------ | -------------------------------- |
| 8080   | nginx: la tienda, la API y Swagger    | `WEB_PUERTO`       | `WEB_IP` (por defecto 127.0.0.1) |
| 1433   | SQL Server (SSMS y las pruebas)       | `DB_PORT`          | 127.0.0.1                        |
| 6379   | Redis (las pruebas)                   | `REDIS_PORT`       | 127.0.0.1                        |
| 3000   | La API (solo dentro de la red Docker) | `PUERTO`           | no se publica                    |

Con otro `WEB_PUERTO`, las URLs pasan a `http://localhost:<WEB_PUERTO>`, y las pruebas de entorno y de concurrencia la leen de `SHOPCART_URL`. `DB_PORT` y `REDIS_PORT` cambian el puerto dentro y fuera del contenedor a la vez, y la API y el migrador leen las mismas variables.

SQL Server y Redis solo se publican en `127.0.0.1` (accesibles desde tu máquina para SSMS o las pruebas, no desde la red). nginx se publica en `WEB_IP` (por defecto `127.0.0.1`). Los contenedores viven en una subred fija (`RED_PREFIJO`, por defecto `172.28.10`) con una IP por servicio; si choca con otra red de tu máquina, cámbiala y vuelve a levantar.

> **Licencia de SQL Server:** el entorno usa la edición **Developer** (`MSSQL_PID=Developer`), gratuita para desarrollo y pruebas pero **no licenciada para producción**.

**Actualizar SQL Server (a propósito).** La imagen está fijada en `docker-compose.yml` al CU que pasó todas las suites: `2022-CU27-GDR1-ubuntu-22.04` (16.0.4305.5), con su digest. Así un `docker compose pull` no cambia el motor. Para pasar a otro CU:

1. Elige la etiqueta en <https://mcr.microsoft.com/v2/mssql/server/tags/list> (por ejemplo `2022-CU28-ubuntu-22.04`) y obtén su digest con `docker pull mcr.microsoft.com/mssql/server:<etiqueta>` y `docker image inspect --format '{{index .RepoDigests 0}}' mcr.microsoft.com/mssql/server:<etiqueta>`.
2. Reemplaza la etiqueta y el `@sha256:…` en el servicio `sqlserver`.
3. Corre `docker compose up -d` (la base sigue en su volumen), `pnpm test:integracion`, `pnpm test:concurrencia` y `pnpm test:entorno`, y haz el commit solo con todo en verde.

---

## 2. Credenciales de prueba

| Correo                                                      | Contraseña          | Rol                                                             |
| ----------------------------------------------------------- | ------------------- | --------------------------------------------------------------- |
| `admin@shopcart.gt`                                         | `Admin2026!`        | Administrador                                                   |
| `operador@shopcart.gt`                                      | `Operador2026!`     | Operador                                                        |
| `cliente@shopcart.gt`                                       | `Cliente2026!`      | Cliente                                                         |
| `cliente2@shopcart.gt`                                      | `Cliente2026!`      | Cliente (para demostrar que un cliente no ve los datos de otro) |
| `demo001@shopcart.gt` … `demo200@shopcart.gt`               | `Demo2026!`         | Clientes de los datos demo, con pedidos                         |
| `concurrencia01@shopcart.gt` … `concurrencia20@shopcart.gt` | `Concurrencia2026!` | Clientes de `pnpm test:concurrencia`                            |

**Tarjetas de la pasarela simulada** (cualquier CVV de 3 dígitos y una fecha de vencimiento futura):

| Número                | Resultado                                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `4242424242424242`    | Aprobada                                                                                                                                                           |
| `4000000000000002`    | Rechazada: `402 PAGO_RECHAZADO` (fondos insuficientes), con los intentos restantes                                                                                 |
| `4000000000000119`    | La pasarela autoriza, pero la respuesta "se pierde": `504 PAGO_SIN_CONFIRMAR`. Reintentar con la **misma** `Idempotency-Key` confirma el pago sin cobrar dos veces |
| Una fecha vencida     | `400 VALIDACION_FALLIDA`                                                                                                                                           |
| Cualquier otro número | Rechazada: `402 PAGO_RECHAZADO` (la tarjeta no es válida)                                                                                                          |

**Cupones demo**, uno por cada mensaje de rechazo de RF-05: `DEMO10` (vigente, 10 %), `DEMOVENCIDO`, `DEMOFUTURO`, `DEMOINACTIVO`, `DEMOAGOTADO`, `DEMOUNAVEZ` (ya usado por `cliente@shopcart.gt`), `DEMOMINIMO` y `DEMOCATEGORIA`.

**Datos demo.** Las semillas cargan los catálogos fijos, los 22 departamentos y 340 municipios de Guatemala, un catálogo de 61 productos y 244 variantes (imágenes en `apps/web/public/static/productos/`) y, con `S006`, unos 200 clientes con 1,500 pedidos en los últimos 90 días (cancelaciones y devoluciones incluidas) y carritos abandonados: el dashboard tiene datos desde el primer arranque. La variante `DEMO-CONCURRENCIA` es la única con una sola unidad, para la demo de compra simultánea.

---

## 3. Flujo de compra en Swagger, paso a paso

Abre <http://localhost:8080/api/docs>. En cada paso: **Try it out** → completa → **Execute**.

1. **Crear la cuenta.** `POST /api/v1/auth/registro`:
   ```json
   { "correo": "ana@ejemplo.gt", "contrasena": "Ensayo2026!", "nombre": "Ana Pérez" }
   ```
   Responde `201` con `datos.accessToken`. Cópialo, pulsa **Authorize** (arriba a la derecha), pégalo en `bearer` y pulsa **Authorize**. (Con una cuenta existente, `POST /api/v1/auth/login` con `correo` y `contrasena`).
2. **Elegir un producto.** `GET /api/v1/productos` → toma un `idProducto`. `GET /api/v1/productos/{id}` → toma el `idVariante` de una variante con `estadoExistencia` distinto de `Agotado`.
3. **Agregarlo al carrito.** `POST /api/v1/carrito/lineas` con `{ "idVariante": 14, "cantidad": 1 }`. Opcional: `PUT /api/v1/carrito/cupon` con `{ "codigo": "DEMO10" }`, o con `DEMOVENCIDO` para ver un rechazo.
4. **Método de envío.** `GET /api/v1/envios/metodos` → `datos.metodos[].idMetodoEnvio` (1 Estándar, 2 Express) y cuánto falta para el envío gratis.
5. **Dirección.** `GET /api/v1/departamentos` → `GET /api/v1/departamentos/{id}/municipios` → `POST /api/v1/direcciones`:
   ```json
   {
     "nombreRecibe": "Ana Pérez",
     "telefonoRecibe": "55551234",
     "idMunicipio": 1,
     "direccionLinea": "5a avenida 10-20, zona 1"
   }
   ```
   Responde `201` con `datos.idDireccion`.
6. **Iniciar el pago.** `POST /api/v1/checkout/sesion` con `{ "idDireccion": 1, "idMetodoEnvio": 1 }`. Responde `201` con el total congelado, y las unidades quedan reservadas hasta `expiraEn` (15 minutos).
7. **Pagar con la respuesta perdida (4000…0119).** `POST /api/v1/checkout/sesion/pagos`. En `idempotency-key` pon un UUID nuevo (en PowerShell, `[guid]::NewGuid()`; en Bash, `uuidgen`) y **anótalo**:
   ```json
   {
     "numeroTarjeta": "4000000000000119",
     "mesVencimiento": 12,
     "anioVencimiento": 2030,
     "cvv": "123"
   }
   ```
   Responde `504 PAGO_SIN_CONFIRMAR`: la pasarela autorizó, pero la API no recibió la respuesta.
8. **Reintentar con la misma llave.** Pulsa **Execute** otra vez, sin cambiar la `idempotency-key` ni el cuerpo. Responde `201` con el pedido (`SC-…`, estado `Pagado`): la pasarela devolvió la misma autorización, se creó el pedido y se capturó un solo cobro. Un tercer envío con la misma llave responde `200` con el mismo pedido. (Con `4242424242424242` y una llave nueva, el paso 7 responde `201` directamente).
9. **Ver el pedido.** `GET /api/v1/pedidos` y `GET /api/v1/pedidos/{id}`, con el desglose de IVA, la dirección, la tarjeta (solo la marca y los últimos 4 dígitos) y el historial de estados.
10. **Opcional:** `POST /api/v1/pedidos/{id}/cancelar` con `{ "motivo": "Ya no lo necesito" }` → `Cancelado`, la existencia vuelve al kardex y el reembolso queda `Completado`. Inicia sesión como `admin@shopcart.gt` para recorrer `GET /api/v1/dashboard/resumen`, `GET /api/v1/bitacora` o `GET /api/v1/admin/pedidos`.

**Para ver el aislamiento entre clientes (RF-01):** con el token de `cliente2@shopcart.gt`, `GET /api/v1/pedidos/{id}` de un pedido de otro cliente responde `404`, igual que uno inexistente.

---

## 4. Decisiones técnicas

| Decisión                                                                                                                                                                                                    | Por qué                                                                                                                     | Detalle                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Monolito modular** (Express 5 + TypeScript strict): `routes → controller → service → repository` por módulo, fronteras verificadas con ESLint                                                             | RF-06 exige una transacción que cruza pedidos, inventario y cupones; los microservicios la complicarían sin beneficio       | [A-01](docs/01-arquitectura.md), [A-20](docs/01-arquitectura.md)                                        |
| **Sin SQL en el backend:** el repositorio solo llama a `ejecutarSP` con tipos SQL explícitos; el login de la API solo tiene `EXECUTE`                                                                       | Penalización directa del enunciado y defensa contra inyección: ni siquiera un bug puede leer una tabla                      | [A-02](docs/01-arquitectura.md), [A-18](docs/01-arquitectura.md), [02 §5](docs/02-modelo-datos.md)      |
| **La base protege las invariantes:** stock, reservas, límites de cupón, transiciones, devoluciones e idempotencia viven en SPs con `UPDLOCK`, `CHECK` y `UNIQUE`; el servicio orquesta y da mensajes claros | Una regla en el servicio no resiste dos peticiones simultáneas en dos réplicas                                              | [A-02](docs/01-arquitectura.md), [A-05](docs/01-arquitectura.md), [A-13](docs/01-arquitectura.md)       |
| **Dos réplicas stateless detrás de nginx**; los jobs corren en las réplicas con `sp_getapplock`                                                                                                             | Escala horizontal y tolerancia a la caída de una réplica; Redis solo guarda lo que se puede perder                          | [RNF-2](docs/00-vision-y-contexto.md), [A-03](docs/01-arquitectura.md), [A-04](docs/01-arquitectura.md) |
| **Pago idempotente con arrendamiento y token de fencing:** `Idempotency-Key` + intento registrado antes de llamar a la pasarela; la pasarela nunca se llama dentro de una transacción                       | Doble clic, timeouts y una réplica que muere a mitad del pago terminan en un solo pedido y un solo cobro                    | [N-03](docs/00-vision-y-contexto.md), [01 §6.2](docs/01-arquitectura.md)                                |
| **Pasarela simulada como adaptador** del puerto `PasarelaPago`, con estado propio en SQL Server                                                                                                             | Una pasarela real sería otro adaptador sin tocar el checkout; idempotente aunque el reintento caiga en la otra réplica      | [N-03](docs/00-vision-y-contexto.md)                                                                    |
| **Tablas ledger append-only** (`Bitacora`, `MovimientoKardex`, `HistorialEstadoPedido`)                                                                                                                     | El motor rechaza `UPDATE` y `DELETE` incluso a un administrador                                                             | [M-01](docs/02-modelo-datos.md)                                                                         |
| **Migrador propio** `V###` + `R__` + `S###` con checksum                                                                                                                                                    | Sin Java en la imagen; un script aplicado no se puede editar en silencio                                                    | [A-09](docs/01-arquitectura.md)                                                                         |
| **Zod para validar y generar OpenAPI**; dinero con `decimal.js` y como texto en JSON (`"149.90"`)                                                                                                           | Un solo esquema para validar y documentar; nunca `number` para dinero                                                       | [A-08](docs/01-arquitectura.md), [A-21](docs/01-arquitectura.md)                                        |
| **JWT de 15 min + refresh opaco en cookie httpOnly** con rotación por familia y detección de reúso                                                                                                          | Un refresh robado se detecta al reusarse y revoca la familia                                                                | [A-07](docs/01-arquitectura.md)                                                                         |
| **Fechas en UTC + `FechaPagoLocal`** (Guatemala, UTC−6)                                                                                                                                                     | Los reportes agrupan por el día local sin `AT TIME ZONE` en cada consulta                                                   | [A-12](docs/01-arquitectura.md)                                                                         |
| **Caché de reportes con invalidación por versión** (Redis, en el servicio): cada escritura que cambia lo que leen los reportes incrementa la versión después de su commit                                   | Sin borrar claves ni coordinar réplicas; con Redis caído se lee la base                                                     | [A-11 y 01 §9](docs/01-arquitectura.md)                                                                 |
| **Exportación asíncrona a Excel y PDF** con la cola en SQL Server, consumida por las dos réplicas en competencia, y archivos en un volumen compartido                                                       | Un reporte grande no bloquea la réplica; la cola no se pierde (RNF-2) y el archivo de una réplica se descarga desde la otra | [A-24](docs/01-arquitectura.md)                                                                         |

### Decisiones de negocio (las que el enunciado deja abiertas)

| Tema                     | Postura                                                                                                                                 | Detalle                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| ¿Cuándo nace el pedido?  | Solo cuando el pago se confirma; antes hay carrito y sesión de pago                                                                     | [N-01](docs/00-vision-y-contexto.md)                                       |
| Congelamiento de precio  | El carrito garantiza el precio 3 días; la sesión de pago congela precio y descuento                                                     | [N-02](docs/00-vision-y-contexto.md)                                       |
| Existencia               | El carrito valida pero no reserva; la sesión de pago reserva 15 minutos; el stock sale del kardex al confirmar el pago                  | [N-06](docs/00-vision-y-contexto.md), [N-07](docs/00-vision-y-contexto.md) |
| Ciclo de vida del pedido | §5; las devoluciones derivan el estado a partir de lo devuelto                                                                          | [N-08](docs/00-vision-y-contexto.md)                                       |
| Cancelación              | Cliente u Operador desde `Pagado` o `EnPreparacion`, con motivo; reintegra stock y reembolsa (o anula si el cobro no se capturó)        | [N-09](docs/00-vision-y-contexto.md)                                       |
| Devoluciones             | Las registra el Operador hasta 30 días después de la entrega, por línea; reembolso proporcional, el envío no se reembolsa               | [N-10](docs/00-vision-y-contexto.md)                                       |
| Qué es una venta         | Pedido no cancelado en su fecha de pago local, neto de descuento, con IVA y sin envío; las devoluciones restan en su propia fecha       | [N-11](docs/00-vision-y-contexto.md)                                       |
| Cupones                  | Aplicados en el carrito como vista previa y comprometidos en la sesión de pago; límites total y por cliente con contadores bajo bloqueo | [N-12](docs/00-vision-y-contexto.md)                                       |
| Carrito abandonado       | Activo con productos y 24 horas sin cambios (configurable)                                                                              | [N-13](docs/00-vision-y-contexto.md)                                       |
| Envío                    | Estándar y Express con tarifa fija configurable y monto para envío gratis                                                               | [N-04](docs/00-vision-y-contexto.md)                                       |
| IVA                      | Precios con IVA incluido; el desglose se calcula sobre el total del pedido                                                              | [N-18](docs/00-vision-y-contexto.md)                                       |

**Definiciones de los reportes** (`/api/v1/dashboard/*`, solo Admin). Todos agregan sobre una única definición de venta (`VW_Dashboard_HechosVenta`):

- **Venta:** un pedido no cancelado, contado en su día de pago de Guatemala (`FechaPagoLocal`, UTC−6).
- **Monto de ventas:** productos neto de descuento, con IVA incluido y **sin envío**; el envío se reporta aparte.
- **Devoluciones:** se restan en el día en que ocurren, no en el de la venta, así un periodo ya reportado no cambia; las ventas netas de un día pueden ser negativas.
- **Ticket promedio:** monto neto de ventas / número de pedidos del periodo.
- **Carrito abandonado:** se cuenta en el día de su última actividad, con el monto potencial perdido a precio vigente.
- Sin rango (`desde`, `hasta`), los reportes muestran los últimos 30 días.
- Los reportes salen de una caché de 60 s que se invalida con cada pedido, cancelación, devolución, cambio de carrito o de precio (la lista completa en [01 §9](docs/01-arquitectura.md)).

**Exportar un reporte (Admin).** `POST /api/v1/admin/reportes/{reporte}/exportaciones` con `{ "formato": "xlsx", "filtros": { "desde": "2026-10-01", "hasta": "2026-10-31" } }` (o `"pdf"`) responde `202` con `Location`. `GET /api/v1/admin/exportaciones/{id}` muestra el estado (con `Retry-After` mientras no termina) y, cuando está `Completada`, `GET /api/v1/admin/exportaciones/{id}/archivo` descarga el archivo. Una solicitud igual vigente devuelve la misma; cada Admin puede tener 3 en curso; los archivos vencen a las 24 h.

---

## 5. Diagrama de estados del pedido

```mermaid
stateDiagram-v2
    [*] --> Pagado : pago confirmado (Cliente)
    Pagado --> EnPreparacion : Operador / Admin
    EnPreparacion --> Despachado : Operador / Admin
    Despachado --> Entregado : Operador / Admin
    Pagado --> Cancelado : Cliente / Operador / Admin, con motivo
    EnPreparacion --> Cancelado : Cliente / Operador / Admin, con motivo
    Entregado --> DevueltoParcial : devolución de parte (Operador / Admin)
    Entregado --> Devuelto : devolución de todo (Operador / Admin)
    DevueltoParcial --> Devuelto : devolución del resto
    Cancelado --> [*]
    Devuelto --> [*]
```

Las transiciones viven en la tabla `TransicionEstadoPedido` (por rol) y en el mapa `pedidos.transiciones.ts`. Una prueba compara las dos, y el trigger `TR_Pedidos_ValidarTransicion` rechaza cualquier cambio fuera de la tabla, aunque se escriba directo en la base. Cada cambio queda en `HistorialEstadoPedido` (append-only) con quién, cuándo y el motivo. `DevueltoParcial` y `Devuelto` los deriva solo el SP de devoluciones a partir de lo devuelto.

---

## 6. Diagrama entidad-relación

Vista general de las entidades y sus relaciones. Las columnas, los tipos, las constraints y los índices de cada tabla están en [docs/02-modelo-datos.md](docs/02-modelo-datos.md) (§2 por áreas y §3 tabla por tabla). Los diagramas en imagen, generados desde [docs/diagramas/fuentes/](docs/diagramas/fuentes/):

- [Arquitectura y despliegue](docs/diagramas/arquitectura.svg): réplicas, nginx, SQL Server, Redis, el volumen de exportaciones, las tareas periódicas y los puertos con sus adaptadores.
- Modelo por áreas: [A · usuarios, catálogo e inventario](docs/diagramas/modelo-datos-area-a.svg), [B · carrito, cupones, checkout y pasarela simulada](docs/diagramas/modelo-datos-area-b.svg), [C · pedidos, devoluciones, bitácora, exportaciones y sistema](docs/diagramas/modelo-datos-area-c.svg).

```mermaid
erDiagram
    Rol ||--o{ Usuario : "tiene"
    Usuario ||--o{ RefreshToken : "inicia sesión"
    Usuario ||--o{ Direccion : "registra"
    Departamento ||--o{ Municipio : "contiene"
    Municipio ||--o{ Direccion : "ubica"

    Categoria ||--o{ Producto : "agrupa"
    Producto ||--o{ ImagenProducto : "muestra"
    Producto ||--|{ Variante : "se vende como"
    Atributo ||--o{ ValorAtributo : "define"
    ValorAtributo ||--o{ VarianteValorAtributo : "se usa en"
    Variante ||--|{ VarianteValorAtributo : "se describe con"
    Variante ||--|{ PrecioVariante : "tiene versiones de"
    TipoMovimiento ||--o{ MovimientoKardex : "clasifica"
    Variante ||--o{ MovimientoKardex : "registra"

    Usuario ||--o{ Carrito : "posee"
    Carrito ||--o{ LineaCarrito : "contiene"
    Variante ||--o{ LineaCarrito : "se agrega en"
    PrecioVariante ||--o{ LineaCarrito : "garantiza"
    Cupon |o--o{ Carrito : "se aplica a"
    Categoria |o--o{ Cupon : "restringe"
    Cupon ||--o{ UsoCupon : "se consume en"

    Carrito ||--o{ SesionCheckout : "origina"
    MetodoEnvio ||--o{ SesionCheckout : "se elige en"
    SesionCheckout ||--|{ LineaSesionCheckout : "congela"
    SesionCheckout ||--|{ Reserva : "aparta"
    Variante ||--o{ Reserva : "se reserva"
    SesionCheckout ||--o{ IntentoPago : "registra"

    SesionCheckout ||--o| Pedido : "se convierte en"
    IntentoPago ||--o| Pedido : "paga"
    Usuario ||--o{ Pedido : "compra"
    EstadoPedido ||--o{ Pedido : "está en"
    EstadoPedido ||--o{ TransicionEstadoPedido : "origen y destino"
    Rol ||--o{ TransicionEstadoPedido : "autoriza"
    Pedido ||--|{ DetallePedido : "contiene"
    Variante ||--o{ DetallePedido : "se vendió en"
    Pedido ||--|{ HistorialEstadoPedido : "registra"
    Pedido ||--o{ Devolucion : "recibe"
    Devolucion ||--|{ DetalleDevolucion : "detalla"
    DetallePedido ||--o{ DetalleDevolucion : "se devuelve en"
    Pedido ||--o{ Reembolso : "genera"
    Pedido ||--o{ MovimientoKardex : "referencia"

    Usuario ||--o{ Bitacora : "actúa"
    Usuario ||--o{ SolicitudIdempotente : "repite con la misma llave"
    Usuario ||--o{ SolicitudExportacion : "pide"
    EstadoExportacion ||--o{ SolicitudExportacion : "está en"
    PasarelaAutorizacion ||--o{ PasarelaReembolso : "se reembolsa en"
```

Además: `ParametroSistema` (configuración tipada de una sola fila) y `HistorialMigracion` (los scripts aplicados por el migrador, con su checksum). `PasarelaAutorizacion` y `PasarelaReembolso` son las tablas propias de la pasarela simulada: simulan la base de un sistema externo y no tienen FK hacia el checkout.

**Nomenclatura del enunciado:** `SP_Modulo_Proceso`, `VW_Modulo_Proceso`, `FU_Modulo_Proceso`, PK `IDTabla`; extensión propia `TR_`, `PK_`, `FK_`, `UQ_`, `CK_`, `DF_`, `IX_`, `UX_`. Montos `DECIMAL(12,2)`, porcentajes `DECIMAL(5,2)`, fechas `DATETIME2(3)` en UTC; nunca `FLOAT`, `REAL` ni `MONEY`.

---

## 7. Pruebas

Desde el host, con el entorno levantado (`docker compose up -d`):

```bash
pnpm install             # una vez
pnpm lint && pnpm typecheck
pnpm test                # unitarias: servicios y middlewares con puertos falsos, sin infraestructura
pnpm test:integracion    # contra SQL Server real: recrea la base shopcart_test en cada corrida
pnpm test:concurrencia   # RNF-3: 20 clientes a la vez contra http://localhost:8080 (las dos réplicas)
pnpm test:entorno        # seguridad HTTP en respuestas reales de nginx (pausa SQL Server unos 15 s)
```

- **Integración:** `pnpm test:integracion` recrea `shopcart_test` desde cero (las tablas ledger no admiten `DELETE`), aplica todos los scripts y, solo en esa base, los SPs de `database/test/`. Las pruebas no escriben SQL: preparan sus datos con esos `SP_Pruebas_*` y cada una crea datos únicos. Nunca tocan la base `ShopCart` del entorno.
- **Concurrencia:** escenario 1, la última unidad de una variante: 1 pedido y 19 × `409 STOCK_INSUFICIENTE`. Escenario 2, el último uso de un cupón: 1 pedido y 19 × `422 CUPON_AGOTADO`. Verifica además la existencia final, la conciliación de inventario vacía, el contador del cupón y que respondieron las dos réplicas. Crea sus propios datos con la API, así que se puede repetir sin reiniciar nada; como cada corrida inicia sesión una vez por cliente y el login admite 5 intentos por minuto por IP y correo (A-07), no conviene repetirla más de unas 4 veces por minuto. Otra URL con `SHOPCART_URL`.

**Balanceo y tolerancia a fallas (demo):**

```bash
for i in 1 2 3 4; do curl -s -o /dev/null -D - http://127.0.0.1:8080/api/v1/health | grep -i x-instancia; done
# X-Instancia alterna: api-1, api-2, api-1, api-2
docker compose stop api-1         # la tienda sigue respondiendo, todo desde api-2
docker compose start api-1        # nginx la reincorpora sola
```

**Migraciones.** `db-migrator` aplica `migrations/V###` → `programmability/R__*` → `seeds/S###` y termina. Tras agregar scripts: `docker compose up -d --build db-migrator`. Un `V###` o `S###` aplicado **no se edita**: si cambia, el migrador falla; se crea el siguiente número.

**La API fuera de Docker** (con SQL Server y Redis levantados y la base migrada): `pnpm --filter @shopcart/api build && pnpm --filter @shopcart/api start` → <http://localhost:3000/api/docs>. La API usa timeouts explícitos hacia SQL Server (`DB_TIMEOUT_CONEXION_MS`, por defecto 2000; `DB_TIMEOUT_CONSULTA_MS`, por defecto 15000): con la base caída, el health responde `503` en unos 2 s.

---

## 8. Mejoras documentadas

Lo que queda fuera de la Fase 1, a propósito y con su lugar en el plan ([docs/03-backlog.md](docs/03-backlog.md) §4):

- **Fase 2 · Frontend:** SPA con Vite + React + TypeScript (tienda, backoffice y dashboard con gráficas), renovación transparente del token y estados de carga, vacío y error.
- **Correo** (avisar que una exportación terminó y recuperar la contraseña, N-15): un puerto `Notificador` con Mailpit en desarrollo. Queda fuera de la Fase 1 porque requiere un servidor SMTP.
- **Dashboard en tiempo real (SSE):** con dos réplicas, el evento que ocurre en una tiene que llegar a los clientes conectados a la otra, así que necesita un canal de avisos entre ellas (Redis pub/sub o el outbox de la base). Mientras tanto, el dashboard consulta y la caché lo hace barato.
- **Carga pesada:** el generador de datos demo con 50,000 pedidos sobre una base nueva (el número de pedidos es un parámetro), para medir los reportes y el filtro de carritos abandonados, que hoy no usa un índice.
- **Observabilidad** con OpenTelemetry y Grafana LGTM ([RNF-4](docs/00-vision-y-contexto.md)).
- **Revisión manual de pagos:** un intento con pedido cuya autorización ya no existe en la pasarela queda `EnRevision` y un reembolso que agota sus 5 intentos queda `Fallido` en la lista del Admin (`GET /api/v1/admin/reembolsos`, con reintento). La Fase 2 les dará pantalla.
- **Pasarela real:** otro adaptador del puerto `PasarelaPago`, sin tocar el checkout.
- **Kubernetes** queda diferido ([D-04](docs/00-vision-y-contexto.md)); el diseño stateless ya lo permite.
- **Producción:** SQL Server Standard o Enterprise en lugar de Developer, HTTPS en nginx y secretos fuera de `.env`.
