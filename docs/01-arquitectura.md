# ShopCart — Arquitectura del sistema

> Etapa 2 del proceso. Se basa en las decisiones confirmadas de [`00-vision-y-contexto.md`](./00-vision-y-contexto.md) (D-xx, RNF-xx, N-xx).
> Las decisiones de arquitectura (`A-xx`) fueron **confirmadas por el PO el 29 oct** (sección 13). A-02, A-04 y A-13 se analizaron en detalle.
> El modelo de datos detallado está en [`02-modelo-datos.md`](./02-modelo-datos.md).

---

## 1. Resumen

ShopCart es un **monolito modular** en Node.js/Express que se despliega como **dos réplicas stateless** detrás de nginx. **SQL Server** es la fuente de verdad, con todo el acceso mediante stored procedures, y **Redis** guarda solo estado que se puede perder. Las reglas críticas (stock, reservas, límites de cupón, transiciones de estado, idempotencia) están protegidas **en la base de datos**. La API orquesta los casos de uso, valida las entradas, habla con la pasarela de pago simulada y emite telemetría con OpenTelemetry.

**Principios que guían todas las decisiones:**

1. **La base de datos protege los invariantes y el servicio orquesta los casos de uso** (A-02).
2. **Si Redis o la observabilidad fallan, el sistema se degrada pero nunca queda inconsistente** (RNF-2, RNF-4).
3. **Nada que el cliente envíe decide a qué datos accede**: la identidad sale del token y cada SP la verifica (RF-01).
4. **Toda operación que mueve dinero o stock es atómica e idempotente** (RF-06, N-03).

---

## 2. Requerimientos (resumen)

| Tipo | Fuente | Puntos clave para el diseño |
|---|---|---|
| Funcionales | RF-01 a RF-09 y N-01 a N-19 | Checkout con reservas de 15 min, precio garantizado 3 días, pedido atómico, ciclo de vida con devoluciones, kardex inmutable, bitácora inmutable |
| Rendimiento | RNF-1 | < 1 s en listados y reportes con la semilla; el diseño asume volumen alto (script de 50k pedidos) |
| Escalabilidad | RNF-2 | API stateless, 2 réplicas, Redis para estado volátil |
| Concurrencia | RNF-3 | 20 checkouts simultáneos sobre la última unidad → exactamente 1 éxito; lo mismo para un cupón con 1 uso |
| Observabilidad | RNF-4 | Logs y trazas con OpenTelemetry hacia Grafana LGTM (perfil opcional) |
| Restricciones | Enunciado | SQL Server 2019+, solo SPs, Express + TS strict, React + TS, 15 días, una persona, Docker Compose en Windows (16 GB) |

---

## 3. Vista de componentes y despliegue

![Arquitectura y despliegue](./diagramas/arquitectura.svg)

Versión en texto:

```
                          ┌──────────────────────────────────────────────────────────┐
                          │                 Docker Compose (shopcart)                │
                          │                                                          │
  Navegador ──HTTP:8080──►│  ┌──────────────┐   /api/*    ┌─────────┐                │
  (React SPA)             │  │    web       │──round-────►│  api-1  │──┐             │
                          │  │   (nginx)    │   robin     └─────────┘  │  mssql      │
                          │  │ - SPA build  │             ┌─────────┐  ├──────────►┌───────────┐
                          │  │ - /static    │────────────►│  api-2  │──┤  (tedious) │ sqlserver │
                          │  │ - proxy /api │             └─────────┘  │            │   2022    │
                          │  └──────────────┘                  │       │            └─────▲─────┘
                          │                                    │ ioredis              │ one-shot
                          │                              ┌─────▼─────┐   ┌──────────────┴──┐
                          │                              │   redis   │   │   db-migrator   │
                          │                              └───────────┘   │ (scripts .sql)  │
                          │                                              └─────────────────┘
                          │  ── perfil "observability" (opcional) ─────────────────────────
                          │   api-1 / api-2 ──OTLP──► ┌─────────────────────────────┐
                          │                           │ otel-lgtm (Grafana :3001,   │
                          │                           │ Loki, Tempo, Prometheus)    │
                          │                           └─────────────────────────────┘
                          └──────────────────────────────────────────────────────────┘
```

| Servicio | Imagen | Rol | Healthcheck | Depende de |
|---|---|---|---|---|
| `sqlserver` | `mcr.microsoft.com/mssql/server:2022-latest` | Fuente de verdad | `sqlcmd -Q "SELECT 1"` | — |
| `db-migrator` | Propia (Node + scripts) | Ejecuta los scripts numerados y termina | — (one-shot) | `sqlserver` saludable |
| `redis` | `redis:7-alpine` | Rate limiting, versión de sesión por usuario y caché de reportes | `redis-cli ping` | — |
| `api-1`, `api-2` | Propia (`apps/api`) | API REST; misma imagen y misma configuración salvo `INSTANCIA_ID` | `GET /api/v1/health` | Migrador completado, `redis` saludable |
| `web` | Propia (nginx + build de `apps/web`) | **Balanceador de carga** (`upstream` round-robin hacia `api-1` y `api-2`, con `max_fails=3 fail_timeout=10s`) y servidor de la SPA y `/static` | `GET /` | `api-1`, `api-2` |
| `otel-lgtm` | `grafana/otel-lgtm` | Logs, trazas y métricas | — | Perfil `observability` |

**Notas de despliegue:**

- **Un solo origen** (`http://localhost:8080`): la SPA y la API se sirven desde el mismo host, así que las cookies funcionan sin trucos de CORS: `refresh` con `SameSite=Strict` y `carrito_invitado` con `SameSite=Lax` (httpOnly, `Secure` y `Path=/api/v1`). CORS se configura igualmente con una lista explícita de orígenes (requisito del enunciado) para el servidor de desarrollo de Vite.
- **nginx es el balanceador de carga.** Si una réplica deja de responder, nginx la marca como caída y envía todo el tráfico a la otra. **Escenario de demo:** `docker compose stop api-1` → la tienda sigue funcionando y el header `X-Instancia` muestra que todo lo atiende `api-2`. **Punto único de falla reconocido:** con un solo nginx, si nginx cae, cae todo. En producción se resuelve con un Ingress Controller con réplicas (Kubernetes) o un balanceador administrado (por ejemplo, ALB de AWS).
- **Health (`GET /api/v1/health`):** responde `200` cuando la réplica puede atender, con `redis: "degradado"` si solo falta Redis (RNF-2: se sigue vendiendo), y `503` cuando la base no responde, para que el healthcheck de Docker y nginx saquen la réplica. Es pública: solo devuelve estados; la versión y la hora de SQL Server van al log.
- **Redis está detrás de la API, no delante.** Toda petición llega a la API, que valida el token y el rol. Redis evita ir a SQL Server, no evita pasar por el backend. No se usa la caché HTTP de nginx (`proxy_cache`): saltaría la autenticación y no permite la invalidación por eventos que exige el extra (sección 9).
- **Réplicas explícitas** (`api-1`, `api-2`) en lugar de `deploy.replicas`: nginx resuelve los nombres al arrancar, y así cada respuesta lleva el header `X-Instancia`, que permite demostrar el balanceo en la defensa.
- **Arranque con un solo comando:** `docker compose up -d`. El orden lo garantizan `depends_on` con `condition: service_healthy` y `service_completed_successfully`.
- **RAM estimada:** SQL Server 2 GB (limitado con `MSSQL_MEMORY_LIMIT_MB`), cada API ~150 MB, Redis ~30 MB, nginx ~10 MB, LGTM ~700 MB. Total: ~3.5 GB con observabilidad.
- **Camino a Kubernetes (D-04):** cada servicio se traduce a un `Deployment` (las APIs con `replicas: 2` y un HPA), el migrador a un `Job` y SQL Server/Redis a `StatefulSet`. No requiere cambios en el código.

---

## 4. Arquitectura del backend

### 4.1 Monolito modular (A-01)

Un solo proceso desplegable, dividido internamente en **módulos por dominio** con fronteras explícitas.

**Por qué no microservicios:** el checkout debe crear pedido, detalle, kardex y uso de cupón **en una sola transacción** (RF-06). Con microservicios, eso exigiría sagas y compensaciones distribuidas en un reto de 15 días hecho por una persona. El monolito modular obtiene la separación de responsabilidades sin el costo distribuido, y deja un camino de extracción: el candidato natural sería **Reportes**, que solo lee.

### 4.2 Módulos

| Módulo | Responsabilidad | Prefijo de SP | RF |
|---|---|---|---|
| `auth` | Registro, login, refresh con rotación, logout, revocación | `SP_Auth_*` | RF-01 |
| `usuarios` | Gestión de usuarios internos, perfil, cambio de contraseña | `SP_Usuarios_*` | RF-01 |
| `direcciones` | Direcciones del cliente y catálogo de departamentos/municipios | `SP_Direcciones_*` | RF-06 |
| `catalogo` | Categorías, productos, variantes, atributos, precios versionados, búsqueda | `SP_Catalogo_*` | RF-02 |
| `inventario` | Entradas, ajustes, kardex, conciliación, existencia de bodega | `SP_Inventario_*` | RF-03 |
| `carrito` | Carrito de cliente e invitado, garantía de precio, fusión, estado de líneas | `SP_Carrito_*` | RF-04 |
| `cupones` | CRUD de cupones, validación y cálculo del descuento | `SP_Cupones_*` | RF-05 |
| `envios` | Métodos de envío y configuración del envío gratis | `SP_Envios_*` | N-04 |
| `checkout` | Sesión de checkout, reservas, intentos de pago, pasarela | `SP_Checkout_*` | RF-06 |
| `pedidos` | Ciclo de vida, cancelación, devoluciones, reembolsos | `SP_Pedidos_*` | RF-07 |
| `reportes` | Dashboard y listados | `SP_Dashboard_*` | RF-08 |
| `bitacora` | Consulta de la bitácora | `SP_Bitacora_*` | RF-09 |
| `configuracion` | Parámetros del sistema (plazos y umbrales) | `SP_Configuracion_*` | N-02, N-04, N-06, N-13 |
| `sistema` | Salud de la réplica (`GET /api/v1/health`) y contexto del actor para los triggers (`SP_Sistema_EstablecerContexto`) | `SP_Sistema_*` | RNF-2, A-18 |

### 4.3 Estructura interna de cada módulo

```
src/modules/<modulo>/
  <modulo>.routes.ts        # rutas Express: método, path, middlewares (auth, rol, validación)
  <modulo>.controller.ts    # traduce HTTP ↔ caso de uso; sin lógica de negocio
  <modulo>.service.ts       # casos de uso: orquesta, aplica reglas, llama repositorios y puertos
  <modulo>.repository.ts    # SOLO invoca SPs mediante ejecutarSP(); mapea resultados a tipos
  <modulo>.schemas.ts       # esquemas Zod de entrada y salida (también generan OpenAPI)
  <modulo>.types.ts         # tipos del dominio del módulo
  <modulo>.errors.ts        # solo si el módulo tiene errores propios fuera del catálogo central
  index.ts                  # API pública del módulo (lo único que otros módulos importan)
```

**Reglas de dependencia:**

- `routes → controller → service → repository`. Nunca al revés.
- Un módulo **solo** usa a otro a través de su `index.ts` (su servicio público), nunca su repositorio. Un lint (`eslint-plugin-boundaries` o `no-restricted-imports`) lo hace cumplir.
- Los servicios dependen de **puertos** (interfaces) para todo lo externo: `PasarelaPago`, `Cache`, `VersionesSesion` y `Reloj`. Los adaptadores se inyectan en `app.ts`. Esto permite probar los servicios sin infraestructura.

### 4.4 Infraestructura compartida (`src/shared`)

| Pieza | Qué hace |
|---|---|
| `config/` | Lee las variables de entorno y **las valida con Zod al arrancar**; si falta una, el proceso no inicia |
| `db/` | Pool de `mssql` y helper `ejecutarSP<T>(nombre, parametros)` con **parámetros tipados obligatorios**: agrega los parámetros estándar del actor (A-18), traduce los errores de SQL (A-06, A-19) y reintenta ante deadlocks |
| `errors/` | `AppError` (código, mensaje, status, detalles), mapeo de errores de negocio de SQL (50000–59999) a HTTP y middleware central de errores |
| `http/` | Middlewares: `requestId`, `autenticar`, `autorizar(roles)`, `rateLimit`, `idempotencia`; envoltorio tipado `manejar(esquemas, handler)` que valida la entrada con Zod en el controlador (A-20); formato estándar de respuesta y paginación |
| `observability/` | SDK de OpenTelemetry (http, express, tedious, ioredis), logger pino con `traceId`/`spanId` y **redacción** de datos sensibles |
| `jobs/` | Planificador interno de tareas periódicas (sección 8) |
| `adapters/` | `PasarelaSimulada`, `CacheRedis`, `VersionesSesionRedis` |

### 4.5 Dónde vive la lógica de negocio (A-02)

Es una pregunta segura en la defensa, porque el enunciado pide que los **servicios** tengan la lógica de negocio y, a la vez, que **las reglas críticas se protejan en la base de datos**. La regla de reparto:

| Capa | Responsabilidad | Ejemplos |
|---|---|---|
| **Servicio** | Orquestar el caso de uso, validar precondiciones con mensajes claros, coordinar sistemas externos y decidir el flujo | Decidir si reutilizar la sesión de checkout; llamar a autorizar → crear pedido → capturar, y anular si falla; invalidar la caché; resolver el carrito desde la cookie o el token |
| **Stored procedure** | Garantizar invariantes de datos de forma **atómica y concurrente**: lo que no puede quedar mal aunque dos peticiones lleguen al mismo tiempo | Reservar stock con bloqueo; respetar el límite del cupón; validar la transición de estado; crear el pedido en una transacción; escribir el kardex |
| **Constraint o trigger** | Última línea de defensa ante cualquier escritura, incluso manual | `CHECK (ExistenciaFisica >= 0)`, `CHECK (CantidadDevuelta <= Cantidad)`, trigger de transiciones, bitácora inmutable |

**Ejemplo con el cupón:** el servicio valida y devuelve "te faltan Q80 para el mínimo" (mensaje claro, sin bloquear nada). El SP de reserva vuelve a validar bajo bloqueo, porque entre ambos pasos otro cliente pudo usar el último uso. El `CHECK` del contador garantiza que, aunque hubiera un error en el SP, la base rechace exceder el límite.

### 4.6 Errores (A-06)

- Los SPs señalan errores de negocio con `THROW <número>, <mensaje>, 1`. Hay un rango por módulo (detalle en `02-modelo-datos.md`, sección 8).
- `ejecutarSP` reconoce el rango y lo convierte en `AppError` con su código estable, por ejemplo `50301 → 409 STOCK_INSUFICIENTE`. Cualquier otro error de SQL se registra completo y se responde `500` sin detalles internos.
- **Formato único de error:**

```json
{
  "error": {
    "codigo": "CUPON_MINIMO_NO_ALCANZADO",
    "mensaje": "El cupón requiere una compra mínima de Q300.00. Te faltan Q80.00.",
    "detalles": { "minimo": "300.00", "faltante": "80.00" },
    "requestId": "8f1c2e9a-…"
  }
}
```

| Situación | HTTP |
|---|---|
| Validación de esquema (Zod) | 400 |
| Sin token o token expirado o inválido | 401 |
| Rol sin permiso | 403 |
| Recurso inexistente **o de otro cliente** | 404 |
| Conflicto de estado (transición inválida, pago en proceso, concurrencia optimista) | 409 |
| Regla de negocio incumplida (stock, cupón, plazo de devolución) | 409 o 422 (definido por código en el catálogo) |
| Llave de idempotencia reutilizada con otro contenido | 422 |
| Pago rechazado por la pasarela | 402 |
| Rate limit | 429 |
| Error inesperado | 500 |

---

## 5. Diseño de la API

### 5.1 Convenciones

- Base `/api/v1`, JSON, nombres en español y `camelCase` en los cuerpos.
- **Paginación del lado del servidor:** `?pagina=1&tamano=20&orden=fecha&direccion=desc`, con `tamano` máximo de 100 y `orden` validado contra una lista blanca por endpoint. Respuesta:

```json
{ "datos": [ … ], "paginacion": { "pagina": 1, "tamano": 20, "total": 1532, "totalPaginas": 77 } }
```

- **Montos como texto decimal** (`"149.90"`) en JSON para no perder precisión con `number`. Internamente se usa `decimal.js` en el backend.
- **Documentación OpenAPI 3.1** generada desde los esquemas Zod (`@asteasolutions/zod-to-openapi`), servida en `/api/docs`. Hay una sola fuente de verdad para la validación y la documentación (A-08).
- Header `X-Request-Id` en todas las respuestas, y `X-Instancia` para mostrar qué réplica atendió.

### 5.2 Recursos principales

| Módulo | Endpoints (resumen) | Roles |
|---|---|---|
| auth | `POST /auth/registro`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` | Público / autenticado |
| usuarios | `GET/PATCH /usuarios/me`, `POST /usuarios/me/contrasena`; `GET/POST /usuarios`, `PATCH /usuarios/:id`, `POST /usuarios/:id/desactivar` y `/activar` | Cliente, Operador y Admin (`/me`) / Admin |
| direcciones | `GET/POST /direcciones`, `PATCH/DELETE /direcciones/:id`; `GET /departamentos`, `GET /departamentos/:id/municipios` | Cliente / público |
| catalogo | `GET /productos` (búsqueda y filtros), `GET /productos/:id`, `GET /categorias`; administración: `POST/PATCH/DELETE /admin/productos…`, `/admin/variantes…`, `/admin/categorias…`, `/admin/atributos…`, `PUT /admin/variantes/:id/precio` | Público / Admin |
| inventario | `POST /inventario/entradas`, `POST /inventario/ajustes`, `GET /inventario/kardex?variante=`, `GET /inventario/existencias`, `GET /inventario/conciliacion` | Operador, Admin |
| carrito | `GET /carrito`, `POST /carrito/lineas`, `PATCH /carrito/lineas/:idLinea`, `DELETE /carrito/lineas/:idLinea`, `POST /carrito/avisos/vistos`, `PUT /carrito/cupon`, `DELETE /carrito/cupon` | Invitado, Cliente |
| envios | `GET /envios/metodos`; `PUT /admin/envios/metodos/:id` | Público / Admin |
| cupones | `GET/POST /admin/cupones`, `GET/PATCH /admin/cupones/:id`, `POST /admin/cupones/:id/activar`, `POST /admin/cupones/:id/desactivar` | Admin |
| checkout | `POST /checkout/sesion` (iniciar pago), `GET /checkout/sesion`, `DELETE /checkout/sesion`, `POST /checkout/sesion/pagos` (**`Idempotency-Key`**) | Cliente |
| pedidos | `GET /pedidos`, `GET /pedidos/:id` (propios), `POST /pedidos/:id/cancelar`; gestión: `GET /admin/pedidos`, `POST /admin/pedidos/:id/estado`, `POST /admin/pedidos/:id/devoluciones`, `GET /admin/reembolsos?estado=Fallido`, `POST /admin/reembolsos/:id/reintentar` | Cliente / Operador, Admin |
| reportes | `GET /dashboard/ventas?agrupacion=dia\|semana\|mes&desde&hasta`, `/dashboard/ventas-por-categoria`, `/dashboard/top-productos`, `/dashboard/carritos-abandonados`, `/dashboard/resumen` | Admin |
| bitacora | `GET /bitacora?modulo=&entidad=&desde&hasta` | Admin |
| configuracion | `GET /admin/configuracion`, `PATCH /admin/configuracion` | Admin |
| sistema | `GET /health` (verifica la BD mediante un SP y Redis), `GET /docs` | Público |

**Aislamiento entre clientes (RF-01):** los endpoints del cliente **nunca reciben el `IDUsuario`**, porque sale del token. Los SPs del cliente reciben `@IDUsuario` y filtran con él (`WHERE IDPedido = @IDPedido AND IDUsuario = @IDUsuario`). Un recurso ajeno responde `404`, igual que uno inexistente. El carrito no expone su ID (N-05).

### 5.3 Autenticación (A-07)

```
Login ──► access JWT (15 min, en memoria del frontend; header Authorization: Bearer)
      └─► refresh token (opaco, 7 días, cookie httpOnly + Secure + SameSite=Strict, Path=/api/v1/auth)
            guardado como hash SHA-256 en RefreshToken, agrupado por IDFamilia

POST /auth/refresh:
  token válido y no usado  ──► se marca como usado, se emite uno nuevo de la misma familia (rotación)
  token ya usado (reúso)   ──► se REVOCA TODA LA FAMILIA → 401 (posible robo del token)
  usuario inactivo         ──► 401

Cada petición autenticada:
  versión del token < versión vigente en Redis ──► 401 (desactivado, otro rol u otra contraseña)
```

- El access token se firma con `HS256` y un secreto del `.env`, y lleva `sub` (IDUsuario), `rol`, `jti` y `versionSesion`.
- **Versión de sesión (N-15):** `Usuario.VersionSesion` sube en la misma transacción que desactiva al usuario, le cambia el rol o le cambia la contraseña; el SP la devuelve. El login y el refresh la leen de la base y la ponen en el token. Después del commit, el servicio publica en Redis la versión vigente con un TTL de 15 min + 1 min de margen (solo puede subir), y `autenticar` rechaza con `401` todo token con una versión menor. Sin clave en Redis rige la ventana del access token: o no hubo cambios recientes, o Redis no responde (N-15). Reactivar no baja la versión.
- **Cambio de contraseña:** la sesión que lo pide recibe un access token y un refresh nuevos con la versión nueva; las demás pierden sus refresh tokens (revocados en el SP) y sus access tokens (versión anterior).
- **Rate limiting** (`rate-limiter-flexible` sobre Redis, compartido entre réplicas): login con 5 intentos por minuto por IP + correo, registro con 3 por minuto por IP, cambio de contraseña con 5 por minuto por usuario y creación de carritos de invitado con 20 por minuto por IP. Si Redis no está disponible, se cae a un limitador en memoria por réplica y la API no se bloquea.

---

## 6. Flujos críticos

### 6.1 Iniciar pago — `POST /checkout/sesion`

```
Cliente        API (CheckoutService)                       SQL Server
  │ POST /checkout/sesion {idDireccion, idMetodoEnvio}         │
  │──────────────►│ valida esquema y rol Cliente               │
  │               │ EXEC SP_Checkout_IniciarSesion ───────────►│ BEGIN TRAN
  │               │                                            │  ¿Sesión activa con el mismo HashContenido? → la devuelve (idempotente)
  │               │                                            │  ¿Sesión activa distinta? → la cancela y libera sus reservas
  │               │                                            │  Valida líneas (todas Disponible; si no → THROW con detalle)
  │               │                                            │  Bloquea variantes en orden de IDVariante (UPDLOCK, ROWLOCK)
  │               │                                            │  Disponible = Física − Reservas vigentes ≥ Cantidad, para TODAS
  │               │                                            │  INSERT Reserva × línea (vence en 15 min)
  │               │                                            │  Si hay cupón: UPDLOCK sobre Cupon, valida reglas,
  │               │                                            │    UsosComprometidos += 1 (CHECK ≤ límite), INSERT UsoCupon (Reservado)
  │               │                                            │  Calcula descuento repartido por línea (FU_Cupones_CalculoDescuento)
  │               │                                            │  Calcula envío (gratis si aplica) e INSERT SesionCheckout + líneas congeladas
  │               │                                            │ COMMIT
  │◄──────────────│ 201 {sesión: líneas, descuento, envío, total, expira}
```

**Si falla una línea:** `THROW 50301` con la lista de variantes y su disponible → `409` y *"Solo quedan 2 unidades de Camiseta azul M"*. No queda ninguna reserva.

### 6.2 Confirmar pago — `POST /checkout/sesion/pagos` con `Idempotency-Key`

```
Cliente          API (CheckoutService)                 Pasarela (puerto)       SQL Server
  │ POST pagos {token tarjeta} + Idempotency-Key: K        │                       │
  │─────────────►│ EXEC SP_Checkout_RegistrarIntentoPago(K, hash) ────────────────►│ UNIQUE(K):
  │              │◄──── ya existe con mismo hash → devuelve resultado guardado ───│  - existe y mismo hash → resultado previo
  │              │◄──── existe con otro hash → 422 ───────────────────────────────│  - existe y otro hash → 422
  │              │◄──── otro intento en curso → 409 ──────────────────────────────│  - otro Pendiente en la sesión → 409
  │              │                                         │                       │  - nuevo → INSERT IntentoPago (Pendiente)
  │              │ autorizar(monto, K) ───────────────────►│                       │
  │              │◄── rechazada → EXEC SP_Checkout_ActualizarIntentoPago(Rechazado) ►│ (5.º rechazo → cancela sesión y libera)
  │              │◄── autorizada (IDTransaccion) ──────────│                       │
  │              │ EXEC SP_Pedidos_CrearPedido(sesión, intento, IDTransaccion) ───►│ BEGIN TRAN
  │              │                                         │                       │  Sesión Activa y no vencida (si venció: re-reserva o THROW)
  │              │                                         │                       │  INSERT Pedido (UNIQUE IDSesionCheckout) + DetallePedido (copia congelada)
  │              │                                         │                       │  Variante.ExistenciaFisica −= Cantidad (CHECK ≥ 0)
  │              │                                         │                       │  INSERT MovimientoKardex SalidaVenta × línea
  │              │                                         │                       │  Reservas → Consumida; UsoCupon → Confirmado
  │              │                                         │                       │  Sesión → Pagada; Carrito → Convertido; Historial (∅ → Pagado)
  │              │                                         │                       │ COMMIT
  │              │  ✗ si CrearPedido falla → anular(IDTransaccion) ──►│            │  → Intento Anulado, sin cobro
  │              │ capturar(IDTransaccion) ───────────────►│                       │
  │              │ EXEC SP_Checkout_ActualizarIntentoPago(Capturado) ─────────────►│
  │◄─────────────│ 201 {pedido}                            │                       │
```

**Arrendamiento del intento (N-03).** `IntentoPago.ArrendadoHasta` dice hasta cuándo una petición tiene tomado el intento: `TIMEOUT_PASARELA_MS` + `MARGEN_ARRENDAMIENTO_MS` (constantes con nombre en el servicio). `SP_Checkout_RegistrarIntentoPago` decide qué hacer con la llave:

| La llave encuentra | Respuesta |
|---|---|
| Nada (llave nueva) | `INSERT` del intento `Pendiente` con el arrendamiento tomado → autorizar |
| Otro cliente, otra sesión u otro hash | `422 LLAVE_REUTILIZADA` |
| `Pendiente` o `Autorizado` con el arrendamiento vivo | `409 PAGO_EN_CURSO` con `Retry-After` |
| `Pendiente` con el arrendamiento vencido | Compare-and-set bajo `UPDLOCK` (solo una petición lo gana) → autorizar otra vez con la misma llave |
| `Autorizado` sin pedido, arrendamiento vencido | Se retoma (compare-and-set) → `CrearPedido` |
| `Autorizado` con pedido, arrendamiento vencido | Se retoma → capturar → pedido |
| `Capturado` | `200` con el pedido |
| `Rechazado`, `Anulado` o `Fallido` | El mismo error que se respondió entonces; si lo cerró la conciliación, `409 PAGO_NO_COMPLETADO` (sin cobro) |
| Sesión ya pagada (con cualquier llave) | `200` con el pedido existente, sin crear intento ni llamar a la pasarela |

Ante un timeout de la pasarela el arrendamiento se libera de inmediato (`ArrendadoHasta = ahora`) y se responde `504 PAGO_SIN_CONFIRMAR`: el reintento con la misma llave lo retoma sin esperar.

**La pasarela simulada tiene estado propio.** Guarda sus autorizaciones por llave en `PasarelaAutorizacion` (y los reembolsos en `PasarelaReembolso`), solo por `SP_Pasarela_*` y nunca dentro de una transacción del checkout. Un reintento que cae en la otra réplica recibe la misma autorización.

**Modos de falla documentados:**

| Falla | Resultado |
|---|---|
| Doble clic (misma `K`) | La segunda petición recibe `409 PAGO_EN_CURSO` mientras la primera tiene el arrendamiento y después el mismo resultado; un solo pedido y un solo cobro |
| Timeout de la pasarela (`4000…0119`) | `504 PAGO_SIN_CONFIRMAR`, arrendamiento liberado; el reintento con la misma `K` (en cualquier réplica) recibe la misma autorización |
| La red se cae después de autorizar | El cliente reintenta con la misma `K`; vencido el arrendamiento, la petición retoma el intento `Autorizado` y sigue en `CrearPedido`, que es idempotente gracias a `UNIQUE(IDSesionCheckout)` |
| La reserva venció en el segundo 14:59 | `CrearPedido` intenta reservar de nuevo dentro de la transacción; si no hay stock → THROW → se anula la autorización → `409` |
| Falla `CrearPedido` | Se anula la autorización; el intento queda `Anulado` con el código del error |
| Falla la anulación | El intento queda `Autorizado` sin pedido; la conciliación lo anula |
| La API muere entre la autorización y la captura (o entre `CrearPedido` y la actualización del intento) | El intento queda `Autorizado`; la conciliación (cada minuto, E5-H04) lo captura si existe el pedido de la sesión o lo anula si no |
| Falla la captura | El pedido existe y se responde `201`; la conciliación captura después |
| `Pendiente` abandonado | La conciliación consulta la pasarela por la llave: `NoExiste` → `Fallido` sin cobro; `Autorizada` → captura o anula |

### 6.3 Liberación de reservas (N-06, RF-07)

- **Liberación lógica inmediata:** el disponible solo cuenta las reservas `Activa` con `FechaExpiracion > SYSUTCDATETIME()`. Una reserva vencida deja de restar en ese mismo instante, sin esperar a ningún job.
- **Limpieza física:** `SP_Checkout_ExpirarSesiones` corre cada minuto y marca las sesiones vencidas como `Expirada`, sus reservas como `Liberada` y los usos de cupón como `Liberado` (y `UsosComprometidos −= 1`). Lo protege `sp_getapplock`, así que aunque las dos réplicas lo ejecuten al mismo tiempo, solo una avanza.

### 6.4 Cancelación con reembolso (N-09)

```
Operador/Cliente ─► SP_Pedidos_Cancelar (1 transacción):
                      estado + historial, ReingresoCancelacion × línea,
                      UsoCupon → Revertido (UsosComprometidos −= 1),
                      INSERT Reembolso (Pendiente, total + envío)      ── COMMIT
                 ─► servicio: pasarela.reembolsar(IDTransaccion, monto, llave)
                      ✓ → SP_Pedidos_ActualizarReembolso(Completado)
                      ✗ → queda Pendiente → job cada 5 min (máx. 5 intentos) → Fallido → lista del Admin
```

Es un **outbox simplificado**: la intención de reembolsar se guarda en la misma transacción que la cancelación, y la llamada externa ocurre después. Si la API muere entre ambos pasos, el job encuentra el reembolso `Pendiente` y lo completa.

### 6.5 Garantía de precio en el carrito (N-02)

Cuando se consulta el carrito, `SP_Carrito_Obtener` calcula para cada línea:

```
precioVigente  = FU_Catalogo_PrecioVigente(IDVariante)
garantiaActiva = FechaGarantiaHasta > ahora
precioEfectivo = garantiaActiva ? MIN(precioGarantizado, precioVigente) : precioVigente
aviso          = garantiaActiva y precioVigente > precioGarantizado → "Precio garantizado hasta …"
                 precioVigente < precioGarantizado                  → "¡Bajó de precio!"
                 garantía vencida y el precio registrado difiere del vigente (suba o baje) → alerta "cambió de Q… a Q…" (se guarda hasta que el cliente la vea)
```

Al vencer la garantía, la línea se re-ancla a la versión de precio vigente.

### 6.6 Orden global de bloqueo en el catálogo y el carrito (N-14, N-05)

Todo SP de catálogo bloquea en este orden: **categoría → producto → variantes en orden de `IDVariante`**. Desactivar una categoría y activar uno de sus productos se serializan en la fila de la categoría (un producto activo siempre tiene su categoría activa), y el alta de una variante bloquea la fila del producto antes de leer su conjunto de atributos, así dos altas simultáneas nunca fijan dos conjuntos.

En el carrito: **carrito → variantes en orden de `IDVariante`**. Todo SP de carrito bloquea primero la fila del carrito (así el límite de 50 líneas y la existencia se validan sin que otra petición se cuele); la fusión (E4-H03) bloquea los dos carritos en orden de `IDCarrito` y después las variantes. Orden completo cuando un SP toca más: **carrito → variantes (por `IDVariante`) → sesión de checkout → cupón**. La fusión cancela la sesión activa del cliente (`SP_Checkout_CancelarSesionActiva`) en ese orden, y E5 debe respetarlo.

---

## 7. Concurrencia y consistencia

| Mecanismo | Dónde | Por qué |
|---|---|---|
| **`READ_COMMITTED_SNAPSHOT ON`** en la base (A-05) | Global | Las lecturas (catálogo, dashboard) no se bloquean por las escrituras ni las bloquean. Clave para "< 1 s" con concurrencia |
| **Bloqueo pesimista** `WITH (UPDLOCK, ROWLOCK)` | Variantes al reservar o vender, cupón al reservar uso, líneas del pedido al devolver | Serializa solo las filas en disputa: dos compras de productos distintos no se esperan |
| **Orden fijo de bloqueo** (por `IDVariante`) | Reserva de varias variantes | Evita deadlocks entre carritos que comparten variantes |
| **Contadores con `CHECK`** (A-13) | `Cupon.UsosComprometidos ≤ LimiteUsosTotal`, `DetallePedido.CantidadDevuelta ≤ Cantidad`, `Pedido.MontoReembolsado ≤ Total`, `Variante.ExistenciaFisica ≥ 0` | La base rechaza el exceso aunque exista un bug en la lógica |
| **`UNIQUE` como candado de idempotencia** | `IntentoPago.LlaveIdempotencia`, `Pedido.IDSesionCheckout`, `Reembolso.LlaveIdempotencia` | El segundo `INSERT` falla y se devuelve el resultado existente |
| **Concurrencia optimista** | Cambios de estado del pedido (`WHERE IDEstadoPedido = @Esperado`) | Dos operadores sobre el mismo pedido → uno gana y el otro recibe `409` |
| **`sp_getapplock`** | Jobs periódicos | Una sola ejecución a la vez entre réplicas, sin depender de Redis |
| **`SET XACT_ABORT ON`** + `TRY/CATCH` | Todos los SPs que escriben | Cualquier error revierte toda la transacción: nunca quedan datos a medias |
| **Reintento ante deadlock** | `ejecutarSP` (error 1205, hasta 3 veces con backoff) | Si a pesar del orden fijo ocurre un deadlock, se reintenta de forma transparente |

**Test de concurrencia (RNF-3):** `apps/api/test/concurrencia/` lanza 20 clientes sembrados contra la API real (a través de nginx, para repartirse entre las dos réplicas) y verifica: exactamente 1 `201`, 19 rechazos: `409 STOCK_INSUFICIENTE` en el escenario de stock y `422 CUPON_AGOTADO` en el de cupón, `ExistenciaFisica = 0` y `VW_Inventario_Conciliacion` vacía.

---

## 8. Tareas periódicas (A-04)

Se ejecutan **dentro de cada réplica de la API** con un planificador interno (`shared/jobs`, lo arranca solo `server.ts`). Cada SP toma un `sp_getapplock` exclusivo: si la otra réplica ya lo tiene, retorna sin hacer nada y el log de esa réplica dice `Tarea omitida`; la que la ejecuta registra `Tarea ejecutada` con sus conteos. Dentro de una réplica una tarea no se superpone consigo misma, y el apagado ordenado espera la ejecución en curso antes de cerrar el pool.

- **Expiración:** bloquea primero todas las sesiones vencidas (por `IDSesionCheckout`) y después libera reservas y cupones, en el mismo orden sesión → cupón que el resto de los SPs.
- **Conciliación:** `SP_Checkout_TomarIntentosPorConciliar` toma **un** intento por llamada (`UPDLOCK, READPAST`) y lo arrienda lo que tardan consultar y capturar o anular; el servicio llama a la pasarela fuera de toda transacción y `SP_Checkout_ResolverIntentoConciliado` registra el resultado con compare-and-set (si un reintento del cliente ya lo resolvió, no cambia nada). Captura solo lo que tiene pedido y anula solo lo que no lo tiene. Como máximo 50 intentos por ejecución.

| Tarea | Frecuencia | SP |
|---|---|---|
| Expirar sesiones de checkout y liberar reservas y cupones (no las que tienen un pago con el arrendamiento vivo) | 1 min | `SP_Checkout_ExpirarSesiones` |
| Conciliar intentos de pago con el arrendamiento vencido hace más de 2 min (`Pendiente` o `Autorizado`) | 1 min | `SP_Checkout_TomarIntentosPorConciliar` + servicio + `SP_Checkout_ResolverIntentoConciliado` |
| Reintentar reembolsos pendientes | 5 min | `SP_Pedidos_ObtenerReembolsosPendientes` + servicio |
| Expirar carritos de invitado (30 días) | 1 h | `SP_Carrito_ExpirarInvitados` |
| Purgar llaves de idempotencia de más de 24 h (`SolicitudIdempotente`) | 1 h | `SP_Sistema_PurgarSolicitudesIdempotentes` |

**Alternativa considerada:** un contenedor `worker` dedicado. Separa mejor la carga, pero agrega un servicio y su configuración. Con `sp_getapplock`, ejecutar los jobs en las réplicas es seguro y además demuestra coordinación entre instancias. Si la carga de jobs creciera, la extracción a un worker sería directa: el mismo código con otro punto de entrada.

---

## 9. Caché de reportes (extra, A-11)

- **Patrón:** *cache-aside* en Redis con **invalidación por versión**. Las claves incluyen una versión global: `reportes:v{N}:ventas:dia:2026-10-01:2026-10-31`.
- **Invalidación:** cada evento que cambia los reportes (pedido creado, cancelado o devolución registrada) ejecuta `INCR reportes:version` después del commit. Las claves viejas quedan huérfanas y expiran por TTL (10 min). No hace falta borrar claves por patrón, y es imposible servir datos desactualizados después de un cambio.
- **Si Redis cae:** se consulta directo a SQL Server. El dashboard es más lento, pero correcto.

---

## 10. Seguridad

| Aspecto | Medida |
|---|---|
| Mínimo privilegio en la base | La API se conecta con el login `shopcart_app`, que solo tiene `GRANT EXECUTE ON SCHEMA::dbo` y `DENY SELECT, INSERT, UPDATE, DELETE`. Aunque hubiera una inyección, no se podría leer una tabla directamente. El único SQL dinámico (la búsqueda) corre como `shopcart_busqueda`, un usuario sin login que solo puede leer `VW_Catalogo_ProductosTienda` (A-23). El migrador usa otro login con permisos DDL |
| SQL injection | Solo SPs con parámetros tipados (`ejecutarSP` no acepta texto SQL). El SQL dinámico del catálogo usa `sp_executesql` con parámetros, y el ordenamiento sale de una lista blanca que se resuelve con `CASE`, nunca concatenando |
| Contraseñas | argon2id (memoria de 19 MiB, 2 iteraciones, según la recomendación de OWASP) |
| Tokens | Ver 5.3. Los refresh tokens y los tokens de invitado se guardan solo como hash |
| Cabeceras | `helmet` (CSP, HSTS cuando hay HTTPS, `X-Content-Type-Options`, `frame-ancestors 'none'`) y nginx con `server_tokens off` |
| CORS | Lista explícita desde `CORS_ORIGINS` y `credentials: true` |
| Secretos | Solo en `.env` (ignorado por git). `.env.example` con valores de ejemplo. Al arrancar, la validación de configuración rechaza secretos por defecto en `NODE_ENV=production` |
| Datos de pago | Nunca se guardan; solo la marca y los últimos 4 dígitos. pino redacta `numeroTarjeta`, `cvv`, `contrasena`, `authorization` y `cookie` |
| Bitácora | Inmutable mediante un trigger `INSTEAD OF UPDATE, DELETE` y `DENY` (detalle en el modelo de datos) |

---

## 11. Observabilidad (RNF-4)

- **Trazas:** el SDK de OpenTelemetry para Node, con instrumentación de `http`, `express`, `tedious` (cada llamada a un SP es un span con el nombre del SP) e `ioredis`, exporta por OTLP a `otel-lgtm`. Si el colector no está levantado, el exportador descarta en silencio y la API funciona igual.
- **Logs:** pino en JSON hacia stdout y OTLP. Cada línea lleva `requestId`, `traceId`, `instancia`, `idUsuario` y el módulo.
- **Correlación con la base:** `ejecutarSP` envía el `@RequestId` y cada SP que escribe lo fija en `SESSION_CONTEXT` (A-18), y la bitácora y los errores de SQL guardan ese `RequestId`. Desde una fila de la bitácora se puede llegar a la traza completa en Grafana.
- **Demo:** un dashboard de Grafana provisionado con las peticiones por réplica, la latencia por endpoint y el top de SPs más lentos, más un enlace de la traza a sus logs.

---

## 12. Estructura del repositorio

```
shopcart/
├─ apps/
│  ├─ api/
│  │  ├─ src/
│  │  │  ├─ modules/            # un directorio por módulo (4.3)
│  │  │  ├─ shared/             # config, db, errors, http, observability, jobs, adapters
│  │  │  ├─ app.ts              # composición: middlewares, rutas, inyección de adaptadores
│  │  │  └─ server.ts           # arranque, telemetría, jobs, apagado ordenado
│  │  ├─ test/                  # unit/, integracion/, concurrencia/
│  │  └─ Dockerfile
│  └─ web/                      # React + Vite (Fase 2) y Dockerfile con nginx
├─ database/
│  ├─ migrations/               # V001__crear_base.sql, V002__seguridad.sql, … (se ejecutan una sola vez, en orden)
│  ├─ programmability/          # R__SP_*.sql, R__VW_*.sql, R__FU_*.sql, R__TR_*.sql (CREATE OR ALTER, se reaplican si cambian)
│  ├─ seeds/                    # S001__catalogos.sql, S002__geografia_gt.sql, S003__demo.sql
│  ├─ load/                     # carga pesada opcional (50k pedidos) para la defensa
│  └─ migrator/                 # runner Node: tabla HistorialMigracion con versión y checksum, idempotente
├─ packages/
│  └─ shared/                   # esquemas Zod y tipos compartidos entre la API y la web
├─ infra/
│  ├─ nginx/                    # nginx.conf (SPA + balanceo de /api)
│  └─ grafana/                  # dashboards provisionados
├─ docs/                        # 00-vision…, 01-arquitectura, 02-modelo-datos, 03-backlog, diagramas
├─ docker-compose.yml
├─ .env.example
├─ CLAUDE.md
└─ README.md
```

**Cómo se publica `@shopcart/shared` dentro del monorepo:** es un paquete de workspace que la API declara como `"@shopcart/shared": "workspace:*"`. Compila con `tsc` a `dist/` (ESM con sus `.d.ts`), y su `package.json` declara `"files": ["dist"]` y `exports` con `types` y `default` apuntando a `dist/`, más la condición propia **`@shopcart/fuente`** apuntando a `src/`.
- **En desarrollo** (`pnpm typecheck`, `pnpm test`, ESLint), el `tsconfig.json` de la API (`customConditions`) y Vitest (`resolve.conditions`) activan `@shopcart/fuente`, así que se usa el código fuente sin compilar antes.
- **Al compilar la API** (`tsconfig.build.json`, sin la condición), los tipos salen de `dist/`, por eso `pnpm build` compila `shared` primero (`pnpm -r` respeta el orden de dependencias).
- **En la imagen**, el Dockerfile compila `shared` y luego la API, y `pnpm deploy --prod` copia la API con sus dependencias de producción y `shared` como paquete (solo `dist/`): la imagen final no lleva `src/`, TypeScript ni pnpm.
- **Fase 2 (Vite):** la SPA consume el mismo paquete. En desarrollo, `vite.config.ts` agrega `@shopcart/fuente` a `resolve.conditions`; el build de la web se hace después de compilar `shared`.

**Migraciones (A-09):** los scripts `V###` son inmutables una vez aplicados: el migrador guarda su checksum y falla si alguien edita uno ya aplicado. Los scripts `R__` (programabilidad) usan `CREATE OR ALTER` y se reaplican cuando cambia su checksum. Es el mismo modelo que Flyway, sin agregar Java a la imagen, y se explica en dos minutos.

---

## 13. Decisiones de arquitectura propuestas

Estado: 🟡 Propuesta · 🔍 En análisis · ✅ Confirmada · ✏️ Modificada

| ID | Decisión | Alternativa descartada y por qué | Estado |
|---|---|---|---|
| A-01 | Monolito modular con fronteras por módulo, verificadas con lint | Microservicios: RF-06 exige una transacción que cruza pedidos, inventario y cupones | ✅ |
| A-02 | La BD protege invariantes (SP + constraints); el servicio orquesta y da mensajes claros | Todo en servicios: no resiste concurrencia entre réplicas. Todo en SPs: contradice "servicios con la lógica de negocio" | ✅ |
| A-03 | Un nginx actúa como balanceador de carga (round-robin con detección pasiva de fallas) y sirve la SPA; mismo origen. **Red de Compose con subred fija** (`RED_PREFIJO`, por defecto `172.28.10`): cada servicio tiene IP fija y resuelve los nombres de los servicios que usa desde su `/etc/hosts` (`extra_hosts`), nunca por DNS. Porqué: con un contenedor detenido, el DNS de Docker reenvía su nombre al DNS del host, que puede devolver una IP pública (comprobado en la validación de E0-E1); nginx le mandaría peticiones y la API, el login de SQL Server o el `AUTH` de Redis. Los contenedores sin IP fija toman una de `.128/25`, así nadie ocupa la IP de una réplica detenida. nginx: `proxy_connect_timeout 250ms` (conexión sana ≤ 1 ms medido) y `proxy_next_upstream error timeout`, sin `non_idempotent` | Gateway separado: un contenedor más sin beneficio. Orígenes distintos: complica las cookies | ✅ |
| A-04 | Jobs dentro de las réplicas con `sp_getapplock` | Worker dedicado: más servicios. Lock en Redis: depende de algo que se puede perder | ✅ |
| A-05 | `READ_COMMITTED_SNAPSHOT ON` + `UPDLOCK` explícito en escrituras críticas | `SERIALIZABLE` global: bloqueos y deadlocks innecesarios | ✅ |
| A-06 | Errores de negocio con `THROW 5xxxx` por rango de módulo, mapeados a HTTP con un catálogo | Códigos de retorno o `RAISERROR`: menos claros y fáciles de ignorar | ✅ |
| A-07 | Access JWT de 15 min en memoria + refresh opaco en cookie, rotación por familia y detección de reúso; versión de sesión por usuario publicada en Redis | Refresh JWT: no se puede revocar. Token en localStorage: expuesto a XSS | ✅ |
| A-08 | Zod para validar entradas y generar OpenAPI; esquemas compartidos con el frontend | class-validator: duplica tipos. OpenAPI escrito a mano: se desalinea | ✅ |
| A-09 | Migrador propio con versionado `V###` + `R__`, checksum y tabla de historial | Flyway: agrega Java a la imagen. Scripts sin control: no reproducible | ✅ |
| A-10 | Búsqueda con `LIKE` sobre una columna calculada que no distingue mayúsculas ni tildes (`COLLATE Latin1_General_CI_AI`): "camion" encuentra "Camión". El `LIKE '%texto%'` recorre solo la tabla `Producto` (cientos de filas, no los pedidos), y los filtros de categoría, precio y disponibilidad sí usan índices | Full-Text Search: no viene en la imagen oficial de Docker. Queda como mejora documentada | ✅ |
| A-11 | Caché de reportes en Redis con invalidación por versión | Borrado por patrón: frágil y costoso. Sin caché: se pierde el extra | ✅ |
| A-12 | Fechas en UTC (`DATETIME2(3)`) + columna `FechaPagoLocal DATE` (Guatemala) para agrupar reportes | `AT TIME ZONE` en cada consulta: no aprovecha índices | ✅ |
| A-13 | Contadores con `CHECK` para límites (cupón, devoluciones, reembolsos, existencia) | Solo `COUNT`/`SUM` en el SP: correcto con bloqueo, pero sin defensa ante un bug | ✅ |
| A-14 | Parámetros del sistema en una tabla tipada de una sola fila (`ParametroSistema`) | Tabla clave-valor: sin tipos ni `CHECK` | ✅ |
| A-15 | Estados con comportamiento en tablas de catálogo (`EstadoPedido`, `TipoMovimiento`, `Rol`); estados simples con `CHECK` | Todo con `CHECK`: las transiciones no pueden tener FK. Todo en tablas: exceso de joins | ✅ |
| A-16 | Librerías del backend: Express 5, `mssql`, Zod, `@asteasolutions/zod-to-openapi` (OpenAPI generado desde los esquemas Zod, A-08), `swagger-ui-express` (`/api/docs`), `decimal.js`, pino, helmet, cors, argon2, jose, ioredis, rate-limiter-flexible, OpenTelemetry, Vitest + Supertest, `@vitest/coverage-v8` (reporte de cobertura, solo desarrollo) | Cada una se justifica en el README | ✅ |
| A-17 | Estrategia de pruebas: unitarias de servicios con puertos simulados, integración contra SQL Server real en Docker (base `shopcart_test`), test de concurrencia (RNF-3) y test de coincidencia de transiciones (N-08) | Mocks de la BD: no prueban los SPs, que es donde están las reglas críticas | ✅ |
| A-18 | **Contexto del actor por parámetros estándar.** `ejecutarSP` agrega a cada SP `@IDUsuarioActor`, `@RolActor` y `@RequestId` (tomados de un `AsyncLocalStorage` por petición). Los SPs de recursos propios filtran con `@IDUsuarioActor`, y todo SP que escribe llama primero a `SP_Sistema_EstablecerContexto`, que fija `SESSION_CONTEXT` para los triggers. **Fuera de una petición (jobs), `ejecutarSP` envía `@RolActor = 'Sistema'` e `@IDUsuarioActor = NULL`.** Los triggers de bitácora fallan con `50004 CONTEXTO_NO_ESTABLECIDO` si `SESSION_CONTEXT(N'Rol')` es `NULL`: toda escritura auditada declara quién la hace, también una escritura manual en la base (que debe llamar antes a `SP_Sistema_EstablecerContexto`) y el migrador (que fija `Rol = 'Sistema'` antes de cada script). `Sistema` no es un rol de usuario: el token solo admite `Cliente`, `Operador` y `Administrador` | Fijar `SESSION_CONTEXT` desde Node antes de cada llamada: con el pool de conexiones, el `sp_set_session_context` y el SP pueden ejecutarse en conexiones distintas, y amarrar la conexión exige transacciones del lado del cliente que chocan con las de los SPs | ✅ |
| A-19 | **Errores con detalles estructurados.** Si un `THROW` necesita datos (por ejemplo, qué líneas no tienen existencia), su mensaje es un JSON `{ mensaje, detalles }` y `ejecutarSP` lo separa | Devolver un conjunto de resultados con el error: obliga a cada SP a usar un formato de salida doble y complica el `TRY/CATCH` | ✅ |
| A-20 | **Envoltorio tipado `manejar` para la entrada HTTP.** Cada handler del controlador se declara con `manejar(esquemas, handler)`: valida `params`, `body` y `query` con Zod, responde `400 VALIDACION_FALLIDA` con los detalles si falla y llama al handler con los valores transformados, tipados con `z.infer` de los mismos esquemas. No modifica `req` | Middleware que reemplaza `req.body`/`req.query` y genéricos de `Request` escritos a mano: `req.query` es de solo lectura en Express 5, y los genéricos no garantizan coincidir con el esquema validado | ✅ |
| A-21 | **Montos DECIMAL entre la base y la API.** Los SPs devuelven `DECIMAL`; no se convierte a texto en la base. Un único punto de conversión en `shared/dinero`: `aMonto(number) → Decimal` con `toDecimalPlaces(2)`. Es exacto porque un double conserva 15 dígitos significativos y `DECIMAL(12,2)` tiene 12; el `number` nunca se usa para operar. Salvaguarda: si `|valor| >= 1e13`, error interno. Todo agregado de montos en un SP (`SUM`, `AVG`) se convierte a `DECIMAL(15,2)`: si se desborda, SQL Server falla en vez de perder precisión. Los parámetros de entrada viajan como `Decimal` y se convierten a `number` solo en el borde de `ejecutarSP` (`montoParaSql`), con la misma salvaguarda | Convertir a texto en cada SP: más código en la base y fácil de olvidar. Leer el `number` y operar con él: pierde centavos | ✅ |
| A-22 | **Listas hacia un SP como JSON.** Cuando un SP recibe una lista (valores de atributo de una variante, imágenes de un producto), la recibe en un parámetro `NVARCHAR(MAX)` con JSON: el SP verifica `ISJSON`, la lee con `OPENJSON ... WITH` tipado y valida él mismo los duplicados y la pertenencia; Zod limita antes el tamaño del arreglo | TVP (`CREATE TYPE`): agrega un tipo de objeto fuera de la nomenclatura del enunciado. Texto separado por comas: sin tipos y frágil | ✅ |

| A-23 | **SQL dinámico con un usuario sin login.** `SP_Catalogo_BuscarProductos` usa `sp_executesql`, que corre con los permisos de quien llama y choca con el `DENY SELECT` de `shopcart_app`. El SP se declara `WITH EXECUTE AS 'shopcart_busqueda'`: un usuario `WITHOUT LOGIN` (V011) cuyo único permiso es `SELECT` sobre `VW_Catalogo_ProductosTienda` (otorgado en el `R__` de la vista). El SQL dinámico solo lee esa vista; lo que necesite una función se calcula antes y entra como parámetro. `shopcart_app` conserva su `DENY SELECT` y solo tiene `EXECUTE` | `EXECUTE AS OWNER`: el SQL dinámico tendría el alcance de dbo. Firma con certificado: clave maestra y volver a firmar tras cada `ALTER`. SQL estático con `OPTION (RECOMPILE)`: compila en cada llamada del endpoint más usado | ✅ |
---

## 14. Qué revisaría si el sistema crece

| Señal | Evolución |
|---|---|
| El dashboard pasa de 1 s con millones de pedidos | Vistas indexadas (materializadas) por día y categoría, o una tabla de agregados mantenida en la misma transacción del pedido |
| El kardex y la bitácora crecen sin límite | Particionar por mes y archivar los periodos cerrados |
| Más réplicas de la API o jobs pesados | Extraer los jobs a un worker y pasar los reembolsos a una cola (outbox → broker) |
| Picos de lectura en el catálogo | Caché del catálogo en Redis o en una CDN, y réplica de lectura de SQL Server para reportes |
| Pasarela real | Nuevo adaptador de `PasarelaPago`, webhooks firmados para confirmar capturas y captura al despachar (N-03) |
| Búsqueda más rica | Full-Text Search o un motor dedicado (OpenSearch) alimentado por eventos del catálogo |
| Operación en producción | Kubernetes con HPA en la API, SQL Server administrado, secretos en un vault y alertas sobre las métricas del dashboard de Grafana |
