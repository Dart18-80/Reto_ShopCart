# ShopCart — Arquitectura del sistema

> Etapa 2 del proceso. Se basa en las decisiones confirmadas de [`00-vision-y-contexto.md`](./00-vision-y-contexto.md) (D-xx, RNF-xx, N-xx).
> Las decisiones de arquitectura (`A-xx`) de este documento son **propuestas 🟡** hasta que el PO las analice y confirme (sección 13).
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
| `redis` | `redis:7-alpine` | Rate limiting, lista de revocados y caché de reportes | `redis-cli ping` | — |
| `api-1`, `api-2` | Propia (`apps/api`) | API REST; misma imagen y misma configuración salvo `INSTANCIA_ID` | `GET /api/v1/health` | Migrador completado, `redis` saludable |
| `web` | Propia (nginx + build de `apps/web`) | Sirve la SPA y `/static`, y balancea `/api` entre las réplicas | `GET /` | `api-1`, `api-2` |
| `otel-lgtm` | `grafana/otel-lgtm` | Logs, trazas y métricas | — | Perfil `observability` |

**Notas de despliegue:**

- **Un solo origen** (`http://localhost:8080`): la SPA y la API se sirven desde el mismo host, así que las cookies (`refresh`, `carrito_invitado`) funcionan con `SameSite=Strict` sin trucos de CORS. CORS se configura igualmente con una lista explícita de orígenes (requisito del enunciado) para el servidor de desarrollo de Vite.
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

### 4.3 Estructura interna de cada módulo

```
src/modules/<modulo>/
  <modulo>.routes.ts        # rutas Express: método, path, middlewares (auth, rol, validación)
  <modulo>.controller.ts    # traduce HTTP ↔ caso de uso; sin lógica de negocio
  <modulo>.service.ts       # casos de uso: orquesta, aplica reglas, llama repositorios y puertos
  <modulo>.repository.ts    # SOLO invoca SPs mediante ejecutarSP(); mapea resultados a tipos
  <modulo>.schemas.ts       # esquemas Zod de entrada y salida (también generan OpenAPI)
  <modulo>.types.ts         # tipos del dominio del módulo
  <modulo>.errors.ts        # códigos de error de negocio del módulo
  index.ts                  # API pública del módulo (lo único que otros módulos importan)
```

**Reglas de dependencia:**

- `routes → controller → service → repository`. Nunca al revés.
- Un módulo **solo** usa a otro a través de su `index.ts` (su servicio público), nunca su repositorio. Un lint (`eslint-plugin-boundaries` o `no-restricted-imports`) lo hace cumplir.
- Los servicios dependen de **puertos** (interfaces) para todo lo externo: `PasarelaPago`, `Cache`, `ListaRevocados` y `Reloj`. Los adaptadores se inyectan en `app.ts`. Esto permite probar los servicios sin infraestructura.

### 4.4 Infraestructura compartida (`src/shared`)

| Pieza | Qué hace |
|---|---|
| `config/` | Lee las variables de entorno y **las valida con Zod al arrancar**; si falta una, el proceso no inicia |
| `db/` | Pool de `mssql`, helper `ejecutarSP<T>(nombre, parametros)` con **parámetros tipados obligatorios**, establece `SESSION_CONTEXT` (`IDUsuario`, `RequestId`) en cada llamada y traduce los errores de SQL |
| `errors/` | `AppError` (código, mensaje, status, detalles), mapeo de errores de negocio de SQL (50000–59999) a HTTP y middleware central de errores |
| `http/` | Middlewares: `requestId`, `autenticar`, `autorizar(roles)`, `validar(esquema)`, `rateLimit`, `idempotencia`; formato estándar de respuesta y paginación |
| `observability/` | SDK de OpenTelemetry (http, express, tedious, ioredis), logger pino con `traceId`/`spanId` y **redacción** de datos sensibles |
| `jobs/` | Planificador interno de tareas periódicas (sección 8) |
| `adapters/` | `PasarelaSimulada`, `CacheRedis`, `ListaRevocadosRedis` |

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
| usuarios | `GET/PATCH /usuarios/me`, `POST /usuarios/me/contrasena`; `GET/POST /usuarios`, `PATCH /usuarios/:id`, `POST /usuarios/:id/desactivar` | Cliente / Admin |
| direcciones | `GET/POST /direcciones`, `PATCH/DELETE /direcciones/:id`; `GET /departamentos`, `GET /departamentos/:id/municipios` | Cliente / público |
| catalogo | `GET /productos` (búsqueda y filtros), `GET /productos/:id`, `GET /categorias`; administración: `POST/PATCH/DELETE /admin/productos…`, `/admin/variantes…`, `/admin/categorias…`, `/admin/atributos…`, `PUT /admin/variantes/:id/precio` | Público / Admin |
| inventario | `POST /inventario/entradas`, `POST /inventario/ajustes`, `GET /inventario/kardex?variante=`, `GET /inventario/existencias`, `GET /inventario/conciliacion` | Operador, Admin |
| carrito | `GET /carrito`, `POST /carrito/lineas`, `PATCH /carrito/lineas/:idLinea`, `DELETE /carrito/lineas/:idLinea`, `PUT /carrito/cupon`, `DELETE /carrito/cupon` | Invitado, Cliente |
| envios | `GET /envios/metodos`; `PUT /admin/envios/metodos/:id` | Público / Admin |
| cupones | `GET/POST /admin/cupones`, `PATCH /admin/cupones/:id`, `POST /admin/cupones/:id/desactivar` | Admin |
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
```

- El access token se firma con `HS256` y un secreto del `.env`, y lleva `sub` (IDUsuario), `rol` y `jti`.
- **Lista de revocados (N-15):** al desactivar un usuario, su ID entra en Redis con TTL de 15 min, y `autenticar` lo consulta en cada petición.
- **Rate limiting** (`rate-limiter-flexible` sobre Redis, compartido entre réplicas): login con 5 intentos por minuto por IP + correo, registro con 3 por minuto por IP y creación de carritos de invitado con 20 por minuto por IP. Si Redis no está disponible, se cae a un limitador en memoria por réplica y la API no se bloquea.

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

**Modos de falla documentados:**

| Falla | Resultado |
|---|---|
| Doble clic (misma `K`) | La segunda petición recibe el mismo resultado; un solo pedido y un solo cobro |
| La red se cae después de autorizar | El cliente reintenta con la misma `K`; la pasarela simulada también es idempotente por `K` y devuelve la misma autorización; `CrearPedido` es idempotente gracias a `UNIQUE(IDSesionCheckout)` |
| La reserva venció en el segundo 14:59 | `CrearPedido` intenta reservar de nuevo dentro de la transacción; si no hay stock → THROW → se anula la autorización → `409` |
| La API muere entre la autorización y la captura | El intento queda `Autorizado` sin pedido o sin captura; un job de conciliación lo detecta (más de 2 min) y anula o captura según exista el pedido |
| Falla la captura | El pedido existe; se reintenta la captura desde el job de conciliación. Con la pasarela simulada no ocurre salvo que se fuerce |

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
                 garantía vencida y el precio cambió               → alerta "cambió de Q… a Q…" (se guarda hasta que el cliente la vea)
```

Al vencer la garantía, la línea se re-ancla a la versión de precio vigente.

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

**Test de concurrencia (RNF-3):** `apps/api/test/concurrencia/` lanza 20 clientes sembrados contra la API real (a través de nginx, para repartirse entre las dos réplicas) y verifica: exactamente 1 `201`, 19 `409` con `STOCK_INSUFICIENTE` (o `CUPON_AGOTADO`), `ExistenciaFisica = 0` y `VW_Inventario_Conciliacion` vacía.

---

## 8. Tareas periódicas (A-04)

Se ejecutan **dentro de cada réplica de la API** con un planificador interno. Cada SP toma un `sp_getapplock` exclusivo: si la otra réplica ya lo tiene, retorna sin hacer nada.

| Tarea | Frecuencia | SP |
|---|---|---|
| Expirar sesiones de checkout y liberar reservas y cupones | 1 min | `SP_Checkout_ExpirarSesiones` |
| Conciliar intentos de pago autorizados sin pedido o sin captura | 2 min | `SP_Checkout_ObtenerIntentosPorConciliar` + servicio |
| Reintentar reembolsos pendientes | 5 min | `SP_Pedidos_ObtenerReembolsosPendientes` + servicio |
| Expirar carritos de invitado (30 días) | 1 h | `SP_Carrito_ExpirarInvitados` |

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
| Mínimo privilegio en la base | La API se conecta con el login `shopcart_app`, que solo tiene `GRANT EXECUTE ON SCHEMA::dbo` y `DENY SELECT, INSERT, UPDATE, DELETE`. Aunque hubiera una inyección, no se podría leer una tabla directamente. El migrador usa otro login con permisos DDL |
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
- **Correlación con la base:** `ejecutarSP` establece `SESSION_CONTEXT('RequestId')`, y la bitácora y los errores de SQL guardan ese `RequestId`. Desde una fila de la bitácora se puede llegar a la traza completa en Grafana.
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

**Migraciones (A-09):** los scripts `V###` son inmutables una vez aplicados: el migrador guarda su checksum y falla si alguien edita uno ya aplicado. Los scripts `R__` (programabilidad) usan `CREATE OR ALTER` y se reaplican cuando cambia su checksum. Es el mismo modelo que Flyway, sin agregar Java a la imagen, y se explica en dos minutos.

---

## 13. Decisiones de arquitectura propuestas

Estado: 🟡 Propuesta · 🔍 En análisis · ✅ Confirmada · ✏️ Modificada

| ID | Decisión | Alternativa descartada y por qué | Estado |
|---|---|---|---|
| A-01 | Monolito modular con fronteras por módulo, verificadas con lint | Microservicios: RF-06 exige una transacción que cruza pedidos, inventario y cupones | 🟡 |
| A-02 | La BD protege invariantes (SP + constraints); el servicio orquesta y da mensajes claros | Todo en servicios: no resiste concurrencia entre réplicas. Todo en SPs: contradice "servicios con la lógica de negocio" | 🟡 |
| A-03 | Un nginx sirve la SPA y balancea `/api` entre `api-1` y `api-2`; mismo origen | Gateway separado: un contenedor más sin beneficio. Orígenes distintos: complica las cookies | 🟡 |
| A-04 | Jobs dentro de las réplicas con `sp_getapplock` | Worker dedicado: más servicios. Lock en Redis: depende de algo que se puede perder | 🟡 |
| A-05 | `READ_COMMITTED_SNAPSHOT ON` + `UPDLOCK` explícito en escrituras críticas | `SERIALIZABLE` global: bloqueos y deadlocks innecesarios | 🟡 |
| A-06 | Errores de negocio con `THROW 5xxxx` por rango de módulo, mapeados a HTTP con un catálogo | Códigos de retorno o `RAISERROR`: menos claros y fáciles de ignorar | 🟡 |
| A-07 | Access JWT de 15 min en memoria + refresh opaco en cookie, rotación por familia y detección de reúso; revocados en Redis | Refresh JWT: no se puede revocar. Token en localStorage: expuesto a XSS | 🟡 |
| A-08 | Zod para validar entradas y generar OpenAPI; esquemas compartidos con el frontend | class-validator: duplica tipos. OpenAPI escrito a mano: se desalinea | 🟡 |
| A-09 | Migrador propio con versionado `V###` + `R__`, checksum y tabla de historial | Flyway: agrega Java a la imagen. Scripts sin control: no reproducible | 🟡 |
| A-10 | Búsqueda con `LIKE` sobre una columna calculada que no distingue mayúsculas ni tildes (`COLLATE Latin1_General_CI_AI`): "camion" encuentra "Camión". El `LIKE '%texto%'` recorre solo la tabla `Producto` (cientos de filas, no los pedidos), y los filtros de categoría, precio y disponibilidad sí usan índices | Full-Text Search: no viene en la imagen oficial de Docker. Queda como mejora documentada | 🟡 |
| A-11 | Caché de reportes en Redis con invalidación por versión | Borrado por patrón: frágil y costoso. Sin caché: se pierde el extra | 🟡 |
| A-12 | Fechas en UTC (`DATETIME2(3)`) + columna `FechaPagoLocal DATE` (Guatemala) para agrupar reportes | `AT TIME ZONE` en cada consulta: no aprovecha índices | 🟡 |
| A-13 | Contadores con `CHECK` para límites (cupón, devoluciones, reembolsos, existencia) | Solo `COUNT`/`SUM` en el SP: correcto con bloqueo, pero sin defensa ante un bug | 🟡 |
| A-14 | Parámetros del sistema en una tabla tipada de una sola fila (`ParametroSistema`) | Tabla clave-valor: sin tipos ni `CHECK` | 🟡 |
| A-15 | Estados con comportamiento en tablas de catálogo (`EstadoPedido`, `TipoMovimiento`, `Rol`); estados simples con `CHECK` | Todo con `CHECK`: las transiciones no pueden tener FK. Todo en tablas: exceso de joins | 🟡 |
| A-16 | Librerías del backend: Express 5, `mssql`, Zod, `decimal.js`, pino, helmet, cors, argon2, jose, ioredis, rate-limiter-flexible, OpenTelemetry, Vitest + Supertest | Cada una se justifica en el README | 🟡 |
| A-17 | Estrategia de pruebas: unitarias de servicios con puertos simulados, integración contra SQL Server real en Docker (base `shopcart_test`), test de concurrencia (RNF-3) y test de coincidencia de transiciones (N-08) | Mocks de la BD: no prueban los SPs, que es donde están las reglas críticas | 🟡 |

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
