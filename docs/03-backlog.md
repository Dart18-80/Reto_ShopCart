# ShopCart — Backlog

> Etapa 3 del proceso. Cada historia se implementa **solo** cuando su estado es `Lista` y en el orden indicado.
> Fuentes: [`00-vision-y-contexto.md`](./00-vision-y-contexto.md) (N-xx, RNF-xx), [`01-arquitectura.md`](./01-arquitectura.md) (A-xx) y [`02-modelo-datos.md`](./02-modelo-datos.md) (M-xx, tablas y SPs).
> Si una historia no deja algo claro, **el desarrollador se detiene y pregunta**; no decide reglas de negocio por su cuenta.

---

## 1. Cómo leer este backlog

**Formato de cada historia**

- **ID:** `E<épica>-H<número>` (por ejemplo, `E5-H03`).
- **Prioridad:** `Must` (sin esto no se cumple el enunciado), `Should` (mejora la nota o la defensa) o `Could` (se recorta primero si falta tiempo).
- **Estimación:** horas de trabajo con Claude Code, **incluida la revisión de Diego**.
- **Alcance:** lo que se construye. **Fuera de alcance:** lo que no se toca en esta historia.
- **Criterios de aceptación (CA):** verificables. La historia no está terminada hasta que todos se cumplen.
- **Referencias:** decisiones y secciones de los documentos que hay que leer antes de empezar.

**Estados:** `Propuesta` → `Lista` (aprobada por Diego) → `En curso` → `En revisión` (Diego la prueba) → `Hecha`. El estado de cada historia se lleva en el tablero de la sección 5; el desarrollador lo actualiza en el mismo commit de la historia.

---

## 2. Definición de terminado (aplica a todas las historias)

1. TypeScript `strict` sin `any` ni `@ts-ignore`; `pnpm lint` y `pnpm typecheck` pasan.
2. **Ningún texto SQL en el backend:** el repositorio solo llama a `ejecutarSP` con parámetros tipados.
3. Todo SP nuevo sigue la nomenclatura (`SP_Modulo_Proceso`), empieza con `SET NOCOUNT ON; SET XACT_ABORT ON;`, usa `TRY/CATCH` con transacción si escribe y lanza errores de negocio con `THROW` dentro del rango de su módulo (`02-modelo-datos.md`, sección 8).
4. Los scripts de base de datos van en `database/` con la numeración correcta. **Nunca se edita un `V###` ya aplicado.**
5. Entradas validadas con Zod; errores con el formato estándar y el HTTP correcto (`01-arquitectura.md`, sección 4.6).
6. Endpoints documentados en OpenAPI (`/api/docs`).
7. Pruebas: unitarias del servicio y, si la historia toca un SP con reglas críticas, una prueba de integración contra la base `shopcart_test`.
8. `docker compose up -d` sigue levantando todo desde cero.
9. **Un commit por historia** con formato convencional: `feat(checkout): E5-H03 confirmar pago idempotente`.
10. Al cerrar, el desarrollador entrega un **resumen para Diego**: qué se hizo, cómo probarlo (petición de ejemplo) y los 2–3 puntos que Diego debe poder explicar en la defensa.

---

## 3. Plan de la Fase 1 (cierre: lunes 2 nov, 23:59)

| Día | Capacidad | Épicas | Horas estimadas |
|---|---|---|---|
| Jue 29 (noche) | ~3 h | E0 Fundación | 3.0 |
| Vie 30 | 8 h | E1 Esquema y semillas · E2 Auth, usuarios y direcciones · E3 (inicio) | 8.5 |
| Sáb 31 | 5 h | E3 (fin) · E4 Carrito y cupones · **E5 Checkout (inicio)** | 6.0 |
| Dom 1 | 5–8 h | **E5 (fin)** · E6 Pedidos · E7 Reportes y bitácora · E8 Cierre | 8.75 |
| Lun 2 | mínimo | Revisión y **commit final antes del mediodía** | — |
| **Total** | **21–24 h** | | **26.25** (23.5 de `Must`) |

**El plan excede la capacidad en unas 2–5 horas**, y el sábado y el domingo quedan por encima de lo previsto. Si se acumula retraso, se recorta en este orden: primero lo `Could` (≈ 0.25 h) y después lo `Should` (≈ 2.5 h, sobre todo el generador de datos demo E7-H03). Con solo lo `Must` quedan 23.5 h. **Nunca se recorta E5 ni el test de concurrencia.** Lo recortado pasa a la semana 2.

| Épica | Historias | Horas | Must | Should | Could |
|---|---|---|---|---|---|
| E0 Fundación | 6 | 3.0 | 5 | 1 | — |
| E1 Esquema y semillas | 6 | 3.5 | 6 | — | — |
| E2 Auth, usuarios y direcciones | 5 | 2.5 | 4 | 1 | — |
| E3 Catálogo e inventario | 6 | 3.75 | 6 | — | 1 parte |
| E4 Carrito, cupones y envíos | 6 | 2.5 | 5 | 1 | — |
| E5 Checkout y pago | 5 | 4.0 | 5 | — | — |
| E6 Pedidos y devoluciones | 4 | 3.0 | 4 | 1 parte | — |
| E7 Reportes, bitácora y datos demo | 5 | 5.75 | 4 | 1 | — |
| E8 Cierre de la Fase 1 | 3 | 1.5 | 3 | — | — |
| E9 Observabilidad, tiempo real y defensa | 4 | 7.0 | 4 | — | — |

E7-H04, E7-H05 y E9 se agregaron después de este plan (encargos del PO); la tabla muestra el alcance final.

---

## E0 · Fundación

> Objetivo: un repositorio que levanta SQL Server, Redis, el migrador, dos réplicas de la API y nginx con un solo comando, con la infraestructura compartida lista para que cada módulo solo agregue su lógica.

### E0-H01 · Monorepo y estándares de código — `Must` · 0.5 h
**Alcance**
- Monorepo pnpm: `apps/api`, `apps/web` (solo un placeholder), `packages/shared`, `database/`, `infra/`, `docs/`.
- TypeScript `strict` con configuración base compartida; ESLint + Prettier; regla de fronteras entre módulos (`no-restricted-imports` o `eslint-plugin-boundaries`): un módulo solo importa el `index.ts` de otro.
- `.gitattributes` con `* text=auto eol=lf` (los scripts y SQL se ejecutan dentro de contenedores Linux aunque el desarrollo sea en Windows).
- `.gitignore` (incluye `.env`), `.editorconfig`, scripts raíz: `lint`, `typecheck`, `test`, `build`.
- Copiar los documentos de `docs/` y `CLAUDE.md` en su lugar.

**CA**
- [ ] `pnpm install && pnpm lint && pnpm typecheck` pasan en limpio.
- [ ] Un import de `modules/a/a.repository.ts` desde `modules/b/` hace fallar el lint.
- [ ] Commit inicial con la estructura.

**Referencias:** A-01, `01-arquitectura.md` §4.3 y §12.

### E0-H02 · Docker Compose base: SQL Server y Redis — `Must` · 0.5 h
**Alcance**
- `docker-compose.yml` con `sqlserver` (`mcr.microsoft.com/mssql/server:2022-latest`, `MSSQL_MEMORY_LIMIT_MB=2048`, volumen persistente, healthcheck con `/opt/mssql-tools18/bin/sqlcmd -C`) y `redis` (`redis:7-alpine`, healthcheck `redis-cli ping`).
- `.env.example` con todas las variables (contraseñas de ejemplo claramente marcadas como tales).
- Nota en el README sobre `.wslconfig` (memoria recomendada para WSL2: 10 GB).

**CA**
- [ ] `docker compose up -d sqlserver redis` deja ambos servicios `healthy`.
- [ ] Ninguna credencial real en el repositorio.

**Referencias:** D-01, RNF-2, `01-arquitectura.md` §3.

### E0-H03 · Migrador de base de datos — `Must` · 0.75 h
**Alcance**
- `database/migrator`: runner en Node que se conecta como administrador, **crea la base `ShopCart` si no existe**, activa `READ_COMMITTED_SNAPSHOT`, crea los logins `shopcart_app` (solo `EXECUTE` sobre `dbo`, `DENY` de `SELECT/INSERT/UPDATE/DELETE`) y `shopcart_migrator`.
- Tabla `HistorialMigracion` (script, tipo, checksum SHA-256, fecha). Orden de ejecución: `migrations/V###` → `programmability/R__*` → `seeds/S###`.
- `V###` y `S###` se aplican **una sola vez**; si cambia el checksum de uno ya aplicado, el migrador **falla** con un mensaje claro. `R__` se reaplican cuando cambia su checksum.
- Cada script se ejecuta en su propia transacción y admite separadores `GO`.
- Servicio `db-migrator` en Compose (one-shot) que espera a `sqlserver` `healthy`. Variable para apuntar a `shopcart_test`.
- Script `V001__base.sql` mínimo y `R__SP_Sistema_Health.sql` (devuelve versión y hora del servidor).

**CA**
- [ ] Ejecutar el migrador dos veces seguidas no aplica nada la segunda vez.
- [ ] Modificar un `V###` ya aplicado hace fallar el migrador.
- [ ] `shopcart_app` puede ejecutar `SP_Sistema_Health` pero un `SELECT` directo a una tabla devuelve error de permisos.

**Referencias:** A-09, A-05, `01-arquitectura.md` §10 y §12.

### E0-H04 · Esqueleto de la API y piezas compartidas — `Must` · 0.75 h
**Alcance**
- `src/shared/config`: variables de entorno validadas con Zod al arrancar (el proceso termina con un mensaje claro si falta alguna).
- `src/shared/db`: pool `mssql` con el login `shopcart_app`; helper `ejecutarSP<T>(nombre, parametros, opciones)` que exige tipos SQL explícitos por parámetro, **agrega a cada SP `@IDUsuarioActor`, `@RolActor` y `@RequestId`** tomados del contexto de la petición (A-18; en los jobs van en `NULL`), reintenta hasta 3 veces ante deadlock (error 1205) y convierte los errores `50000–59999` en `AppError`. **Si el mensaje del error es un JSON `{ mensaje, detalles }`, lo separa en `mensaje` y `detalles`** (A-19).
- `src/shared/http/contexto.ts`: `AsyncLocalStorage` por petición con `{ requestId, idUsuario, rol }`; lo abre el middleware `requestId` y lo leen `ejecutarSP` y el logger, sin pasarlo a mano por las capas.
- `database/programmability/R__SP_Sistema_EstablecerContexto.sql`: fija `SESSION_CONTEXT` (`IDUsuario`, `Rol`, `RequestId`) a partir de los parámetros estándar, para que los triggers lo lean. Todo SP que escribe lo llama como primera instrucción (A-18).
- `src/shared/errors`: `AppError`, catálogo de códigos (`catalogo.ts`) con su HTTP, middleware central con el formato estándar.
- `src/shared/http`: middleware `requestId`, envoltorio `manejar(esquemas, handler)` que valida la entrada con Zod en el controlador (A-20), formato de paginación y header `X-Instancia`.
- `src/shared/observability`: logger pino en JSON con redacción (`contrasena`, `numeroTarjeta`, `cvv`, `authorization`, `cookie`). OpenTelemetry se agrega en la semana 2.
- `helmet`, `cors` con `CORS_ORIGINS`, `express.json` con límite de tamaño.
- `GET /api/v1/health` (llama a `SP_Sistema_Health` y hace `PING` a Redis), OpenAPI base en `/api/docs`, apagado ordenado con `SIGTERM`.
- Dockerfile multi-stage de la API.

**CA**
- [ ] `GET /api/v1/health` responde `200` con el estado de la base y de Redis; con Redis detenido responde `200` con `redis: "degradado"`.
- [ ] Un `THROW 50003` desde un SP de prueba llega al cliente como `400` con `codigo: PARAMETRO_INVALIDO` y `requestId`.
- [ ] Un error inesperado responde `500` sin detalles internos y queda registrado en el log con su `requestId`.
- [ ] `ejecutarSP` no acepta texto SQL: su firma solo recibe el nombre del SP (verificable por tipos).

**Referencias:** A-02, A-06, A-08, A-18, A-19, `01-arquitectura.md` §4.4–4.6 y §5.1.

### E0-H05 · Dos réplicas detrás de nginx — `Must` · 0.25 h
**Alcance**
- Servicios `api-1` y `api-2` (misma imagen, `INSTANCIA_ID` distinto) que esperan a `db-migrator` completado y a `redis` `healthy`.
- `infra/nginx/nginx.conf`: `upstream api { server api-1:3000 max_fails=3 fail_timeout=10s; server api-2:3000 max_fails=3 fail_timeout=10s; }`, `/api` → upstream, `/` → placeholder estático, `server_tokens off`.
- Red con subred fija e IPs fijas por servicio; cada contenedor resuelve los nombres que usa desde `/etc/hosts` (`extra_hosts`), sin DNS en tiempo de ejecución (A-03). nginx: `proxy_connect_timeout 250ms`, `proxy_next_upstream error timeout`.
- Servicio `web` en `:8080`.

**CA**
- [ ] `docker compose up -d` desde cero levanta todo; `curl localhost:8080/api/v1/health` responde.
- [ ] Peticiones repetidas alternan `X-Instancia: api-1` y `api-2`.
- [ ] Con `docker compose stop api-1`, las peticiones siguen respondiendo desde `api-2`.

**Referencias:** A-03, RNF-2, `01-arquitectura.md` §3.

### E0-H06 · Base de pruebas — `Should` · 0.25 h
**Alcance**
- Vitest para unitarias e integración; Supertest para la API.
- Las pruebas de integración usan la base `shopcart_test`, que el migrador crea y prepara antes de correrlas (`pnpm test:integracion`).
- **Las pruebas no contienen texto SQL.** Los datos de prueba se preparan con SPs que solo existen en `shopcart_test` (`database/test/R__SP_Pruebas_*.sql`); el migrador aplica `database/test/` únicamente a esa base.
- Una prueba de ejemplo de cada tipo (health y mapeo de errores).

**CA**
- [ ] `pnpm test` (unitarias) y `pnpm test:integracion` pasan.

**Referencias:** A-17, A-18.

---

## E1 · Esquema y semillas

> Objetivo: todas las tablas, constraints, índices, triggers de bitácora y de transición, funciones base y datos semilla, exactamente como en `02-modelo-datos.md`.

### E1-H01 · Prueba de tablas ledger con llaves foráneas — `Must` · 0.25 h
**Alcance**
- Script desechable (no versionado) que crea una tabla `LEDGER = ON (APPEND_ONLY = ON)` con `BIGINT IDENTITY`, `NVARCHAR(MAX)` con `CHECK (ISJSON(...) = 1)` y una FK a una tabla normal; prueba `INSERT`, `UPDATE`, `DELETE` y `sp_verify_database_ledger`.

**CA**
- [ ] Resultado documentado en `02-modelo-datos.md` (M-01): **ledger confirmado** o **se usa el respaldo con triggers**.
- [ ] Si se confirma: el error que devuelve SQL Server ante un `UPDATE` queda anotado para el catálogo de errores.

**Referencias:** M-01, `02-modelo-datos.md` §6.

### E1-H02 · Tablas de seguridad, direcciones, catálogo e inventario — `Must` · 0.75 h
**Alcance:** `V002__seguridad.sql` (Rol, Usuario, RefreshToken), `V003__direcciones.sql` (Departamento, Municipio, Direccion), `V004__catalogo.sql` (Categoria, Producto, ImagenProducto, Atributo, ValorAtributo, Variante, VarianteValorAtributo, PrecioVariante), `V005__inventario.sql` (TipoMovimiento, MovimientoKardex como ledger, Reserva — su FK a `SesionCheckout` se agrega en V006).

**CA**
- [ ] Todas las columnas, tipos, `CHECK`, `UNIQUE`, FKs e índices (incluidos los filtrados) coinciden con `02-modelo-datos.md` §3.1–3.4.
- [ ] Nombres de constraints e índices según `02-modelo-datos.md` §1.1.
- [ ] `INSERT` de un kardex con `ExistenciaResultante ≠ ExistenciaAnterior + Signo × Cantidad` falla; un signo que contradice el tipo falla por la FK compuesta.

**Referencias:** `02-modelo-datos.md` §1 y §3.1–3.4.

### E1-H03 · Tablas de carrito, cupones, envíos, parámetros y checkout — `Must` · 0.5 h
**Alcance:** `V006__carrito_cupones_envios.sql` (Carrito, LineaCarrito, Cupon, MetodoEnvio, ParametroSistema) y `V007__checkout.sql` (SesionCheckout, LineaSesionCheckout, IntentoPago, UsoCupon y la FK pendiente de Reserva).

**CA**
- [ ] Coinciden con `02-modelo-datos.md` §3.5–3.8.
- [ ] `UsosComprometidos > LimiteUsosTotal` falla; una segunda sesión `Activa` para el mismo usuario falla; dos intentos `Pendiente` en la misma sesión fallan.
- [ ] Un carrito con `IDUsuario` y `HashTokenInvitado` a la vez (o ninguno) falla.

**Referencias:** `02-modelo-datos.md` §3.5–3.8, A-13, A-14.

### E1-H04 · Tablas de pedidos, devoluciones, reembolsos y bitácora con sus triggers — `Must` · 0.75 h
**Alcance**
- `V008__pedidos.sql` (EstadoPedido, TransicionEstadoPedido, Pedido, DetallePedido, HistorialEstadoPedido como ledger, Devolucion, DetalleDevolucion, Reembolso) y `V009__bitacora.sql` (Bitacora como ledger).
- `R__TR_Pedidos_ValidarTransicion.sql` (rol desde `SESSION_CONTEXT`).
- Triggers de bitácora `R__TR_*_Bitacora.sql` sobre las tablas de `02-modelo-datos.md` §3.10, con `FOR JSON PATH`; el de `Usuario` **excluye** `HashContrasena`; el de `Pedido` solo registra cambios de `IDEstadoPedido`.

**CA**
- [ ] Coinciden con `02-modelo-datos.md` §3.9–3.10.
- [ ] Un `UPDATE` directo de `Pedido` a una transición no permitida falla con `50701`.
- [ ] Modificar el precio de una variante, la existencia o un cupón deja una fila en `Bitacora` con usuario, fecha, entidad, acción, valor anterior y valor nuevo.
- [ ] `UPDATE` y `DELETE` sobre `Bitacora`, `MovimientoKardex` e `HistorialEstadoPedido` fallan.

**Referencias:** N-08, RF-09, M-01, `02-modelo-datos.md` §3.9–3.10 y §6.

### E1-H05 · Funciones y vistas base — `Must` · 0.5 h
**Alcance:** `FU_Catalogo_PrecioVigente`, `FU_Inventario_Disponible`, `VW_Inventario_Conciliacion`, `VW_Inventario_ExistenciaBodega`, `VW_Catalogo_ProductosTienda`, `VW_Pedidos_Historial`. Las de carrito, cupones y dashboard se crean en sus épicas.

**CA**
- [ ] `FU_Inventario_Disponible` ignora las reservas vencidas aunque sigan en estado `Activa`.
- [ ] `VW_Inventario_Conciliacion` devuelve filas si se fuerza un descuadre en la base de pruebas, y ninguna con datos consistentes.

**Referencias:** `02-modelo-datos.md` §4, N-06, N-07.

### E1-H06 · Semillas de catálogos, geografía, usuarios y catálogo demo — `Must` · 0.75 h
**Alcance**
- `S001__catalogos.sql`: roles, estados de pedido, **todas las transiciones** de `02-modelo-datos.md` §3.9, tipos de movimiento, métodos de envío (Estándar Q35 3–5 días, Express Q75 1 día) y la fila de `ParametroSistema`.
- `S002__geografia_gt.sql`: 22 departamentos y 340 municipios de Guatemala.
- `S003__usuarios_demo.sql`, con hashes argon2 precalculados y contraseñas documentadas en el README:

  | Correo | Contraseña | Rol |
  |---|---|---|
  | `admin@shopcart.gt` | `Admin2026!` | Administrador |
  | `operador@shopcart.gt` | `Operador2026!` | Operador |
  | `cliente@shopcart.gt` | `Cliente2026!` | Cliente |
  | `cliente2@shopcart.gt` | `Cliente2026!` | Cliente (segundo cliente para demostrar RF-01) |

- `S004__catalogo_demo.sql`: **cadena de ropa, calzado y accesorios en Guatemala.**
  - 8 categorías con sus atributos: Camisas y blusas (Talla S–XL, Color), Pantalones (Talla 28–38, Color), Vestidos y faldas (Talla S–XL, Color), Chaquetas y suéteres (Talla S–XL, Color), Calzado (Talla 36–44, Color), Ropa deportiva (Talla S–XL, Color), Accesorios (solo Color), Infantil (Talla 2–12, Color).
  - ~60 productos y ~250 variantes; precios en quetzales de Q79 a Q899, con IVA incluido. Al menos una variante de ~Q899 y varias entre Q79 y Q150 (para mostrar el envío gratis desde Q500).
  - Existencias: la mayoría entre 10 y 50; algunas entre 1 y 5; algunas en 0; y **exactamente una** variante con 1 unidad, con SKU `DEMO-CONCURRENCIA`, para la demo de RF-06.
  - Historial de precios en ~10 variantes; 2 productos desactivados.
  - Imágenes SVG locales generadas por categoría en `apps/web/public/static/productos/`.
  - Todas las existencias iniciales **entran por el kardex**; al final, `VW_Inventario_Conciliacion` queda vacía.

**CA**
- [ ] Después de la semilla, `VW_Inventario_Conciliacion` está vacía.
- [ ] Hay 340 municipios ligados a sus 22 departamentos.
- [ ] Las tres cuentas demo pueden iniciar sesión (se comprueba en E2).

**Referencias:** `02-modelo-datos.md` §7, N-17, N-19.

---

## E2 · Auth, usuarios y direcciones

### E2-H01 · Registro e inicio de sesión — `Must` · 0.75 h
**Alcance**
- `POST /auth/registro` (solo crea Clientes; contraseña de mínimo 8 caracteres con letras y números; argon2id) y `POST /auth/login`.
- Access JWT de 15 min (`sub`, `rol`, `jti`; firmado con `jose`) y refresh token opaco en cookie `httpOnly`, `SameSite=Strict`, `Path=/api/v1/auth`; en la base solo su hash.
- Rate limiting con `rate-limiter-flexible` sobre Redis (login: 5/min por IP + correo; registro: 3/min por IP), con caída a memoria si Redis no responde.
- SPs: `SP_Auth_RegistrarCliente`, `SP_Auth_ObtenerCredenciales`, `SP_Auth_RegistrarRefreshToken`.

**CA**
- [ ] Credenciales incorrectas o usuario inexistente responden el **mismo** mensaje genérico (`401`).
- [ ] Un correo repetido con otras mayúsculas responde `409 CORREO_EN_USO`.
- [ ] El sexto intento de login en un minuto responde `429`.
- [ ] Un usuario desactivado no puede iniciar sesión.

**Referencias:** RF-01, N-15, A-07.

### E2-H02 · Rotación del refresh token y logout — `Must` · 0.5 h
**Alcance:** `POST /auth/refresh` con rotación por familia y detección de reúso; `POST /auth/logout`. SPs: `SP_Auth_RotarRefreshToken`, `SP_Auth_RevocarSesion`.

**CA**
- [ ] Cada refresh emite un token nuevo y el anterior deja de servir.
- [ ] **Reusar un refresh token ya rotado revoca toda la familia**: el token más reciente también deja de servir (`401 REFRESH_REUTILIZADO`).
- [ ] Tras el logout, el refresh responde `401`.

**Referencias:** A-07.

### E2-H03 · Autenticación, autorización y revocación — `Must` · 0.5 h
**Alcance:** middlewares `autenticar` (verifica el JWT y la lista de revocados en Redis) y `autorizar(...roles)`; `ListaRevocados` como puerto con adaptador Redis (reemplazado por `VersionesSesion`, A-07).
- **El esquema Zod del token solo admite los roles de usuario `Cliente`, `Operador` y `Administrador`.** `Sistema` es el rol con el que escriben los jobs y el migrador (A-18): ningún token puede traerlo.

**CA**
- [ ] Token expirado → `401`; token válido con rol no permitido → `403` (criterio de RF-01).
- [ ] Al desactivar un usuario, su access token vigente deja de funcionar de inmediato (no a los 15 min).

**Referencias:** RF-01, N-15.

### E2-H04 · Gestión de usuarios y perfil — `Should` · 0.5 h
**Alcance:** `GET/PATCH /usuarios/me`, `POST /usuarios/me/contrasena` (revoca las otras sesiones); Admin: `GET /usuarios` (paginado, filtro por rol y estado), `POST /usuarios` (crear Operador o Admin), `PATCH /usuarios/:id`, `POST /usuarios/:id/desactivar` y `/activar`.

**CA**
- [ ] Un Admin no puede desactivarse a sí mismo; no se puede desactivar al último Admin activo (`409 ULTIMO_ADMIN`).
- [ ] Desactivar revoca los refresh tokens y agrega al usuario a la lista de revocados (hoy: sube su versión de sesión, A-07).
- [ ] La bitácora registra la desactivación sin incluir el hash de la contraseña.

**Referencias:** RF-01, N-15.

### E2-H05 · Direcciones y catálogo geográfico — `Must` · 0.25 h
**Alcance:** `GET /departamentos`, `GET /departamentos/:id/municipios`; `GET/POST /direcciones`, `PATCH/DELETE /direcciones/:id` (máximo 10 por cliente; una sola predeterminada).

**CA**
- [ ] Un cliente que usa el ID de una dirección de otro recibe `404` al leerla, editarla o borrarla.
- [ ] Marcar una dirección como predeterminada desmarca la anterior en la misma transacción.

**Referencias:** RF-01, N-17.

---

## E3 · Catálogo e inventario

### E3-H01 · Categorías — `Must` · 0.25 h
**Alcance:** público `GET /categorias` (activas); Admin `POST/PATCH /admin/categorias`, activar, desactivar y borrar.
**CA**
- [ ] No se puede desactivar una categoría con productos activos ni borrar una con productos (`409 CATEGORIA_CON_PRODUCTOS`).
**Referencias:** RF-02, N-14.

### E3-H02 · Atributos y valores — `Must` · 0.25 h
**Alcance:** Admin `GET/POST /admin/atributos` y `POST /admin/atributos/:id/valores`.
**CA**
- [ ] Un valor repetido dentro del mismo atributo responde `409`.
**Referencias:** N-14.

### E3-H03 · Productos, imágenes y variantes — `Must` · 1.0 h
**Alcance**
- Admin: crear, editar, activar, desactivar y borrar productos; guardar sus imágenes (orden y principal).
- Admin: crear, editar, activar, desactivar y borrar variantes con SKU y combinación de atributos; el SP calcula `FirmaAtributos` y `DescripcionAtributos`.
- `GET /productos/:id` público con sus variantes activas, precio vigente y etiqueta de existencia ("Disponible", "Últimas X unidades", "Agotado").
- Admin: `GET /admin/productos` (paginado, con inactivos y filtros) y `GET /admin/productos/:id` (con inactivos y existencia exacta), con `SP_Catalogo_ListarProductosAdmin`.
- El `POST` de variante recibe el precio inicial: el SP inserta la primera versión de `PrecioVariante` en la misma transacción que la variante (E3-H04 solo cambia precios después). La variante nace con existencia 0 y sin kardex.

**CA**
- [ ] Una segunda variante con la misma combinación de atributos responde `409 COMBINACION_DUPLICADA`; un SKU repetido, `409 SKU_DUPLICADO`.
- [ ] Un producto o variante con ventas, kardex o reservas **no se borra**: responde `409 PRODUCTO_CON_HISTORIAL` y solo se puede desactivar.
- [ ] Un producto desactivado, o sin variantes activas, no aparece en la tienda.
- [ ] Al cliente nunca se le muestra la existencia por encima del umbral; la respuesta pública no trae la existencia física ni la reservada (N-06). Cada variante lleva `estadoExistencia` (`Disponible` | `UltimasUnidades` | `Agotado`) y `unidadesRestantes` solo cuando el estado es `UltimasUnidades`.
- [ ] Un producto activo siempre tiene su categoría activa: crearlo activo en una categoría inactiva, activarlo o moverlo a una inactiva responde `409 CATEGORIA_INACTIVA` (N-14).

**Referencias:** RF-02, N-06, N-14, N-19, A-22.

### E3-H04 · Precios versionados — `Must` · 0.5 h
**Alcance:** `PUT /admin/variantes/:id/precio` (cierra la versión vigente e inserta la nueva en una transacción) y `GET /admin/variantes/:id/precios` (historial). Funciones de precio en uso desde `FU_Catalogo_PrecioVigente`.
**CA**
- [ ] Siempre hay exactamente un precio vigente por variante (lo garantiza el índice filtrado).
- [ ] El cambio queda en la bitácora con el precio anterior y el nuevo.
**Referencias:** N-02, RF-02, RF-09.

### E3-H05 · Búsqueda y filtros del catálogo — `Must` · 0.75 h
**Alcance:** `GET /productos?texto=&categoria=&precioMin=&precioMax=&disponible=&orden=&direccion=&pagina=&tamano=` con `SP_Catalogo_BuscarProductos`, que usa `sp_executesql` **con parámetros**; el ordenamiento sale de una lista blanca resuelta con `CASE`.
**CA**
- [ ] "camion" encuentra "Camión" (sin tildes ni mayúsculas).
- [ ] Un valor malicioso en `orden` (por ejemplo `nombre; DROP TABLE Producto`) responde `400` por la validación; dentro del SP no existe ninguna concatenación de valores.
- [ ] Responde en menos de 1 s con la semilla y devuelve la paginación estándar.
**Referencias:** RF-02, A-10, RNF-1.

### E3-H06 · Inventario y kardex — `Must` · 0.75 h (+ `Could` 0.25 h)
**Alcance**
- `SP_Inventario_RegistrarMovimiento` (**único** punto que modifica `ExistenciaFisica` y escribe el kardex, con bloqueo de la variante). **Ya existe:** se adelantó en E1-H06 para que la semilla S004 cargue las existencias iniciales a través de él, con sus pruebas de integración. Esta historia solo agrega los SPs de entrada y ajuste y los endpoints.
- Operador: `POST /inventario/entradas`, `POST /inventario/ajustes` (motivo obligatorio), `GET /inventario/kardex?variante=` (paginado), `GET /inventario/existencias` (física, reservada y disponible), `GET /inventario/conciliacion`.
- *Could:* `GET /inventario/bodega` con `VW_Inventario_ExistenciaBodega`.

**CA**
- [ ] Un ajuste sin motivo responde `400 MOTIVO_REQUERIDO`; uno que deja la existencia negativa, `422 AJUSTE_DEJA_NEGATIVO`; uno que deja la física por debajo de lo reservado, `422 AJUSTE_BAJO_RESERVADO` con el máximo ajustable.
- [ ] Después de cualquier combinación de movimientos, la conciliación sigue vacía.
- [ ] Cada movimiento registra usuario, fecha, motivo, cantidad, existencia anterior y resultante.

**Referencias:** RF-03, N-07, N-16, A-13.

---

## E4 · Carrito, cupones y envíos

### E4-H01 · Carrito de invitado y de cliente — `Must` · 0.75 h
**Alcance**
- `GET /carrito`, `POST /carrito/lineas`, `PATCH /carrito/lineas/:idLinea`, `DELETE /carrito/lineas/:idLinea`. **Nunca se expone el ID del carrito.**
- Invitado: token aleatorio de 256 bits en la cookie `carrito_invitado` (httpOnly, Secure, `SameSite=Lax`, `Path=/api/v1`), hash en la base; el carrito se crea al agregar el primer producto; rate limiting de creación.
- `FU_Carrito_Lineas`: estado por línea (`Disponible`, `CantidadExcedida`, `Agotado`, `NoDisponible`), subtotal, descuento y total.
- Solo el rol Cliente (o un invitado) tiene carrito; Operador y Admin reciben `403`.

**CA**
- [ ] No se puede agregar ni actualizar a una cantidad mayor que la existencia disponible (criterio de RF-04).
- [ ] Una línea cuyo producto se desactiva aparece como `NoDisponible` y solo se puede eliminar; la cantidad nunca se corrige sola.
- [ ] Usar el ID de una línea de otro carrito responde `404`.
- [ ] El total cuadra al centavo con montos `DECIMAL` (criterio de RF-04); los montos viajan como texto en JSON.
- [ ] Máximo 50 líneas (`422 LIMITE_LINEAS`).

**Referencias:** RF-04, N-05, N-06.

### E4-H02 · Garantía de precio de 3 días — `Must` · 0.5 h
**Alcance:** cada línea guarda la versión de precio y `FechaGarantiaHasta`; el precio efectivo es el menor entre el garantizado y el vigente mientras la garantía dura; avisos "Precio garantizado hasta…", "¡Bajó de precio!" y "El precio cambió de Q… a Q…"; `POST /carrito/avisos/vistos`.
**CA**
- [ ] Con la garantía vigente, una subida de precio no afecta la línea y se muestra el aviso con la fecha.
- [ ] Una baja de precio se aplica de inmediato.
- [ ] Con la garantía vencida, la línea toma el precio vigente y muestra la alerta hasta marcarla como vista.
- [ ] Cambiar la cantidad no renueva la garantía. El plazo sale de `ParametroSistema`.

**Referencias:** N-02.

### E4-H03 · Fusión del carrito al iniciar sesión o registrarse — `Must` · 0.25 h
**Alcance:** al iniciar sesión con cookie de invitado, `SP_Carrito_Fusionar`; al registrarse, `SP_Carrito_AsignarInvitado`.
**CA**
- [ ] Las cantidades de la misma variante se suman con la disponible como tope, con aviso si hubo ajuste.
- [ ] Se conserva la garantía de precio vigente más favorable.
- [ ] El carrito de invitado queda `Fusionado`, la cookie se borra y una sesión de checkout activa del cliente se cancela.

**Referencias:** N-05, N-02.

### E4-H04 · Cupones (administración) — `Must` · 0.25 h
**Alcance:** Admin `GET/POST /admin/cupones`, `PATCH /admin/cupones/:id`, activar y desactivar.
**CA**
- [ ] Un cupón con usos (al menos una fila en `UsoCupon`) solo permite cambiar vigencia, límites y estado; tipo, valor, categoría, compra mínima, tope y código responden `409 CUPON_USADO_NO_EDITABLE` con el campo en los detalles.
- [ ] El código se guarda en mayúsculas y es único sin distinguir mayúsculas.
- [ ] Bajar el límite total por debajo de los usos comprometidos responde con un error claro.

**Referencias:** RF-05, N-12.

### E4-H05 · Aplicar cupón en el carrito — `Must` · 0.5 h
**Alcance:** `PUT /carrito/cupon` y `DELETE /carrito/cupon`; `FU_Cupones_Validar` y `FU_Cupones_CalculoDescuento` (reparto proporcional, centavo sobrante a la línea de mayor monto; tope de porcentaje; solo líneas de la categoría).
**CA**
- [ ] Cada causa de rechazo de N-12 devuelve **su propio** código y mensaje (vencido, agotado, mínimo no alcanzado con el faltante, etc.).
- [ ] El descuento nunca deja el total por debajo de cero (criterio de RF-05).
- [ ] La suma de los descuentos por línea es exactamente el descuento total.
- [ ] Si el cupón deja de ser válido, al consultar el carrito se quita con aviso del motivo.

**Referencias:** RF-05, N-12.

### E4-H06 · Envíos y parámetros — `Should` · 0.25 h
**Alcance:** `GET /envios/metodos` (con el costo calculado para el carrito actual, incluido el envío gratis); Admin `PUT /admin/envios/metodos/:id` y `GET/PATCH /admin/configuracion`.
**CA**
- [ ] El envío gratis se evalúa sobre el subtotal **después** del cupón, y el carrito indica cuánto falta para alcanzarlo.
- [ ] Los cambios de tarifas y parámetros quedan en la bitácora.

**Referencias:** N-04, A-14.

---

## E5 · Checkout y pago ⭐ (la épica más importante)

### E5-H01 · Iniciar la sesión de pago — `Must` · 1.0 h
**Alcance:** `POST /checkout/sesion {idDireccion, idMetodoEnvio}`, `GET /checkout/sesion`, `DELETE /checkout/sesion`. `SP_Checkout_IniciarSesion` según el flujo de `01-arquitectura.md` §6.1.
**CA**
- [ ] Las reservas son **todo o nada**: si una línea no alcanza, no se reserva ninguna y la respuesta lista las líneas con su disponible (`409 STOCK_INSUFICIENTE`).
- [ ] Las variantes se bloquean en orden de `IDVariante`.
- [ ] El uso del cupón queda reservado (`UsosComprometidos + 1`) y se respeta el límite por cliente.
- [ ] Precio, descuento repartido, envío y dirección quedan congelados en la sesión; un cambio de precio posterior no los afecta.
- [ ] Repetir la petición sin cambios en el carrito devuelve la misma sesión; con cambios, cancela la anterior (liberando reservas y cupón) y crea una nueva.
- [ ] Exige sesión iniciada; un invitado recibe `401`.

**Plan aprobado:** `docs/planes/E5-H01-iniciar-sesion-de-pago.md`. `HashContenido` lo calcula el SP con los datos en orden canónico (por `IDVariante`) y los decimales en formato fijo; dos carritos iguales dan el mismo hash. Una sesión con un pago en curso no se cancela (`409 PAGO_EN_CURSO`) y la fusión del login se pospone con `FusionPendiente`. `200` al reutilizar y `201` al crear.

**Nota (cierre de E4):** `SP_Checkout_CancelarSesionActiva` (creado en E4-H03) libera hoy las reservas y el uso del cupón en línea. En esta historia se crean `SP_Inventario_LiberarReservas` y `SP_Cupones_LiberarUso` (internos) y `SP_Checkout_CancelarSesionActiva` pasa a llamarlos: no queda otra ruta de liberación.

**Referencias:** RF-06, N-01, N-02, N-06, A-13.

### E5-H02 · Pasarela de pago simulada — `Must` · 0.5 h
**Alcance:** puerto `PasarelaPago` (`autorizar`, `capturar`, `anular`, `reembolsar`) y adaptador `PasarelaSimulada`: idempotente por llave, tarjetas de prueba `4242…` aprobada, `4000…0002` rechazada (fondos insuficientes), `4000…0119` tiempo de espera agotado; devuelve marca, últimos 4 dígitos e ID de transacción.
**CA**
- [ ] La misma llave devuelve la misma respuesta.
- [ ] El número completo de tarjeta y el CVV nunca aparecen en logs, respuestas ni base de datos.
- [ ] La pasarela simulada persiste sus autorizaciones por llave en tablas propias de SQL Server (`PasarelaAutorizacion`, `PasarelaReembolso`, solo por `SP_Pasarela_*`, nunca dentro de una transacción del checkout; sin Redis): autorizar con `4000…0119` en una réplica y reintentar con la misma llave en la otra devuelve la misma autorización.
- [ ] El puerto incluye `consultar(llave)` (`NoExiste`, `Autorizada`, `Capturada`, `Anulada`, `Rechazada`).

**Referencias:** N-03.

### E5-H03 · Confirmar el pago y crear el pedido — `Must` · 1.25 h
**Alcance:** `POST /checkout/sesion/pagos` con header `Idempotency-Key` obligatorio. Flujo de `01-arquitectura.md` §6.2: registrar intento → autorizar → `SP_Pedidos_CrearPedido` (transacción atómica) → capturar, o anular si la creación falla. Límite de 5 rechazos por sesión.
- El manejo de `Idempotency-Key` se construye reutilizable: `POST /inventario/entradas` y `POST /inventario/ajustes` (E3-H06) también deben aceptarlo, para que un reintento tras un error de red no registre dos veces el mismo movimiento.
**CA**
- [ ] **Doble clic con la misma llave → un solo pedido y un solo cobro** (criterio de RF-06).
- [ ] Misma llave con otro contenido → `422`; una llave nueva mientras otro intento está en curso → `409`; sesión ya pagada → devuelve el pedido existente.
- [ ] La creación es **atómica**: si se fuerza un error dentro de `SP_Pedidos_CrearPedido`, no queda pedido, ni detalle, ni kardex, ni uso de cupón confirmado, y la autorización se anula (criterio de RF-06).
- [ ] El pedido copia precios, descuentos, SKU, nombres, categoría, envío y dirección; calcula base imponible e IVA; registra `(ninguno) → Pagado` en el historial; el carrito queda `Convertido`.
- [ ] `FechaPagoLocal` es el día de Guatemala (UTC−6): un pago a las 05:59 UTC queda en el día anterior y uno a las 06:00 UTC en el mismo día (A-12, M-03).
- [ ] Si la reserva venció, se intenta reservar de nuevo dentro de la transacción; si no hay existencia, se rechaza sin cobro.
- [ ] Una tarjeta rechazada responde `402 PAGO_RECHAZADO`; el quinto rechazo cancela la sesión y libera reservas y cupón.
- [ ] Timeout de la pasarela → `504 PAGO_SIN_CONFIRMAR` con el arrendamiento liberado; el reintento con la misma llave recibe la misma autorización: un solo pedido y un solo cobro.
- [ ] Arrendamiento: reintento con la misma llave durante el arrendamiento → `409 PAGO_EN_CURSO` con `Retry-After`; después → retoma y se completa con un solo cobro; dos retomas simultáneas → solo una avanza.
- [ ] Sesión ya pagada, con cualquier llave → `200` con el pedido existente, sin crear intento ni llamar a la pasarela.
- [ ] `POST /inventario/entradas` y `/ajustes` aceptan `Idempotency-Key`: `SolicitudIdempotente` con `UNIQUE (IDUsuario, Llave)`, insertada por el SP en la misma transacción que el movimiento; misma llave → misma respuesta; otro contenido → `422`.

**Plan aprobado:** `docs/planes/E5-H03-confirmar-pago-y-crear-pedido.md`.

**Referencias:** RF-06, N-01, N-03, N-07, N-18.

### E5-H04 · Planificador de tareas y expiración de sesiones — `Must` · 0.5 h
**Alcance:** planificador interno en `src/shared/jobs`; `SP_Checkout_ExpirarSesiones` cada minuto, la **conciliación de pagos** cada minuto (movida desde F5) y, cada hora, `SP_Carrito_ExpirarInvitados` (carritos de invitado con 30 días sin actividad → `Expirado`, N-05) y la purga de `SolicitudIdempotente` de más de 24 h. Todas protegidas con `sp_getapplock`.
**CA**
- [ ] Una sesión vencida pasa a `Expirada` y libera sus reservas y el uso del cupón **sin intervención manual** (criterio de RF-07).
- [ ] Con las dos réplicas corriendo, cada ejecución la procesa una sola (comprobable en los logs).
- [ ] La tarea es idempotente: ejecutarla dos veces no cambia nada la segunda.
- [ ] La expiración no vence una sesión con un pago en curso mientras el arrendamiento del intento está vivo.
- [ ] Conciliación (intentos con el arrendamiento vencido hace más de 2 min, 01 §6.2), con una prueba por rama: `Pendiente` → `consultar(llave)`: `NoExiste` → `Fallido` sin cobro; `Autorizada` → capturar si existe el pedido de la sesión, si no anular. `Autorizado` sin captura → capturar si existe el pedido, si no anular. Pedido existente con el intento sin `Capturado` → capturar (incluida la API que muere entre `CrearPedido` y la actualización del intento). Después, la sesión sin pedido puede expirar y liberar sus reservas. Correrla dos veces no cambia nada.

**Nota (cierre de E4):** la expiración libera con `SP_Inventario_LiberarReservas` y `SP_Cupones_LiberarUso` (E5-H01), los mismos que usa `SP_Checkout_CancelarSesionActiva`: no queda otra ruta de liberación.

**Referencias:** A-04, RF-07.

### E5-H05 · Test de concurrencia — `Must` · 0.75 h
**Alcance:** `apps/api/test/concurrencia/` contra el entorno levantado con Docker (a través de nginx, para repartir entre réplicas). Escenario 1: 20 clientes intentan pagar la última unidad. Escenario 2: 20 clientes usan un cupón con 1 uso restante. Comando `pnpm test:concurrencia`.
**CA**
- [ ] Escenario 1: exactamente **1** pedido creado, 19 rechazos `409 STOCK_INSUFICIENTE` con mensaje claro, existencia final `0` y conciliación vacía.
- [ ] Escenario 2: exactamente **1** pedido con el cupón; los demás reciben `422 CUPON_AGOTADO` (todos los rechazos de cupón son 422; el 409 queda para conflictos en los que reintentar tiene sentido); `UsosComprometidos = LimiteUsosTotal`.
- [ ] Las peticiones se repartieron entre `api-1` y `api-2`.

**Referencias:** RNF-3, RF-05, RF-06.

---

## E6 · Pedidos y devoluciones

### E6-H01 · Consulta de pedidos — `Must` · 0.5 h
**Alcance:** Cliente `GET /pedidos` (propios, paginado) y `GET /pedidos/:id` (con historial de estados); Operador y Admin `GET /admin/pedidos` con filtros por estado, cliente y rango de fechas, y paginación del servidor.
**CA**
- [ ] Un cliente que pide el ID de un pedido ajeno recibe `404` (criterio de RF-01).
- [ ] El listado de gestión responde en menos de 1 s con la semilla.

**Decisión del PO (cierre de E5):** RF-01 con dos clientes (pedido ajeno → 404). El filtro de fechas de la gestión usa `FechaPagoLocal`, igual que los reportes. Un índice por filtro, con el tiempo medido con la semilla.

**Referencias:** RF-07, RF-08, RF-01.

### E6-H02 · Cambios de estado — `Must` · 0.75 h
**Alcance:** `POST /admin/pedidos/:id/estado {estadoEsperado, estadoNuevo, motivo}`; `SP_Pedidos_CambiarEstado` con concurrencia optimista; mapa de transiciones en el servicio; test que compara el mapa con `SP_Pedidos_ListarTransiciones`.
**CA**
- [ ] Una transición no permitida se rechaza en el backend (`409 TRANSICION_INVALIDA`) **y** en la base (el trigger), probado ambos por separado (criterio de RF-07).
- [ ] Si el pedido ya cambió de estado, responde `409 CONFLICTO_CONCURRENCIA`.
- [ ] Cada cambio registra usuario, fecha y hora, estado anterior y nuevo (criterio de RF-07).
- [ ] El test de coincidencia falla si el mapa y la tabla difieren.

**Decisión del PO (cierre de E5):** `DevueltoParcial` y `Devuelto` solo los deriva el SP de devoluciones, nunca el endpoint. La prueba de coincidencia compara el mapa y la tabla, incluido el rol.

**Referencias:** N-08, RF-07.

### E6-H03 · Cancelación con reembolso — `Must` · 1.0 h (+ `Should` 0.25 h)
**Alcance:** Cliente `POST /pedidos/:id/cancelar`; Operador lo mismo desde gestión. `SP_Pedidos_Cancelar` (estado, reingreso al kardex, uso de cupón revertido, `Reembolso` pendiente por el total) y llamada a la pasarela después del commit. Admin `GET /admin/reembolsos?estado=` y `POST /admin/reembolsos/:id/reintentar`.
*Should:* job de reintento cada 5 minutos con `sp_getapplock`, hasta 5 intentos y luego `Fallido`.
**CA**
- [ ] Solo se puede cancelar desde `Pagado` o `EnPreparacion` (`409 NO_CANCELABLE` en otro caso); el motivo es obligatorio.
- [ ] Cancelar reintegra la existencia con `ReingresoCancelacion` y se refleja en los reportes (criterio de RF-07).
- [ ] Si la pasarela falla al reembolsar, la cancelación se mantiene y el reembolso queda `Pendiente`.
- [ ] Repetir la cancelación no genera un segundo reembolso.

**Decisión del PO (cierre de E5), historia grande con plan:** el `Reembolso` `Pendiente` se registra en la misma transacción de la cancelación y la pasarela se llama después del commit, con una llave determinista por reembolso para que los reintentos y el job nunca reembolsen dos veces. Si el intento del pedido todavía no está `Capturado` (captura pendiente de conciliación), cancelar anula la autorización en vez de reembolsar, y la conciliación nunca captura el cobro de un pedido cancelado. El *Should* (job cada 5 min con `sp_getapplock`, 5 intentos → `Fallido`) se incluye. Dos cancelaciones simultáneas: una sola cancelación y un solo reembolso. `MontoReembolsado` nunca supera lo capturado (contador con `CHECK`, A-13).

**Referencias:** N-09, N-03, A-04.

### E6-H04 · Devoluciones — `Must` · 0.5 h
**Alcance:** `POST /admin/pedidos/:id/devoluciones {motivo, lineas:[{idDetallePedido, cantidad}]}`; `SP_Pedidos_RegistrarDevolucion`.
**CA**
- [ ] No se puede devolver más de lo vendido por línea, ni siquiera con dos devoluciones simultáneas (`422 DEVOLUCION_EXCEDE_VENDIDO`; criterio de RF-07).
- [ ] Solo para pedidos `Entregado` o `DevueltoParcial` y dentro de 30 días (`422 PLAZO_DEVOLUCION_VENCIDO`).
- [ ] El estado pasa a `DevueltoParcial` o `Devuelto` según corresponda; el producto reingresa con `ReingresoDevolucion`.
- [ ] El reembolso es proporcional (precio pagado menos descuento repartido) y la suma de reembolsos nunca supera el total.
- [ ] `FechaLocal` de la devolución es el día de Guatemala (UTC−6): una devolución a las 05:59 UTC queda en el día anterior y una a las 06:00 UTC en el mismo día (N-11, M-03).

**Decisión del PO (cierre de E5):** las líneas de `DetallePedido` se bloquean en orden de su ID; los 30 días cuentan desde que el pedido pasó a `Entregado` (historial). Reembolso por unidad = precio efectivo − descuento repartido; la última devolución de una línea se lleva el residuo de centavos, para que la suma de los reembolsos de la línea sea exactamente lo pagado. El envío no se reembolsa en una devolución.

**Referencias:** N-10, RF-07, A-13.

---

## E7 · Reportes, bitácora y datos demo

### E7-H01 · Dashboard — `Must` · 1.0 h
**Alcance:** `VW_Dashboard_HechosVenta` (definición única de venta, N-11), `VW_Dashboard_VentasPorCategoria`, `VW_Carrito_Abandonados` y los SPs `SP_Dashboard_Resumen`, `SP_Dashboard_VentasPorPeriodo` (día, semana, mes; en quetzales y en número de pedidos), `SP_Dashboard_VentasPorCategoria`, `SP_Dashboard_TopProductos` (top 10) y `SP_Dashboard_CarritosAbandonados`. Endpoints de `01-arquitectura.md` §5.2. Solo Admin.
**CA**
- [ ] Los reportes **excluyen cancelados y descuentan devoluciones** en la fecha en que ocurren (criterio de RF-08 y N-11).
- [ ] Las fechas se agrupan por día de Guatemala (`FechaPagoLocal`).
- [ ] Cada reporte responde en menos de 1 s con la semilla.

**Decisión del PO (cierre de E5):** las devoluciones se descuentan en su propia fecha local (prueba cerca de la medianoche); cada reporte se mide con la semilla y con los datos demo.

**Referencias:** RF-08, N-11, N-13, M-07.

### E7-H02 · Consulta de la bitácora — `Must` · 0.25 h
**Alcance:** `GET /bitacora?modulo=&entidad=&desde=&hasta=&pagina=&tamano=`; solo Admin.
**CA**
- [ ] Filtra por módulo y pagina en el servidor (criterio de RF-09).

**Referencias:** RF-09.

### E7-H03 · Generador de datos demo — `Should` · 1.25 h
**Alcance:** `SP_Semilla_GenerarDatosDemo(@Pedidos, @Dias, @Semilla)` y `S006__datos_demo.sql` (S005 ya existe) (1,500 pedidos en 90 días, ~200 clientes, carritos abandonados, cancelaciones, devoluciones y los cupones de ejemplo de `02-modelo-datos.md` §7). Fechas **relativas a hoy**.
**CA**
- [ ] El dashboard muestra datos de los últimos 90 días desde el primer arranque.
- [ ] Al terminar, `VW_Inventario_Conciliacion` está vacía y todos los pedidos cumplen sus `CHECK`.
- [ ] Existe un cupón para demostrar cada mensaje de rechazo de RF-05.

**Decisión del PO (cierre de E5):** `SP_Inventario_RegistrarMovimiento` acepta una fecha opcional del movimiento solo cuando el rol del contexto es `Sistema` y nunca en el futuro; sigue siendo el único que escribe el kardex. El generador usa esa fecha para que kardex, pedidos e historial coincidan en los 90 días (N-07 y 02). La semilla usa el siguiente `S###` libre (`S005` ya existe). Termina con `VW_Inventario_Conciliacion` vacía y un cupón por cada mensaje de rechazo.

**Referencias:** RNF-1, M-08.

### E7-H04 · Caché de reportes con invalidación — `Must` · 0.75 h
**Alcance (cambio de alcance aprobado por el PO al cierre de E6 y E7: pasa de F5 a la Fase 1):** caché *cache-aside* en la capa de servicio de reportes, detrás del puerto `Cache` (adaptador de Redis). Llave `reportes:v{version}:{reporte}:{hash de los filtros normalizados}`; la versión vive en Redis y cada escritura que cambia los datos que leen las vistas del dashboard la incrementa en su servicio, **después del commit**. La lista de esas escrituras sale de las vistas y queda en `01-arquitectura.md` §9. TTL corto como constante con nombre (cubre los reportes que dependen de la hora y un incremento fallido). Redis caído o con error: se consulta la base y se registra con el log de cambio de estado.
**CA**
- [ ] La segunda consulta con los mismos filtros sale de la caché.
- [ ] Tras cada escritura de la lista, el reporte muestra el dato nuevo.
- [ ] Un proceso que leyó datos viejos y los guarda después de la invalidación no los deja visibles.
- [ ] Las dos réplicas comparten la versión.
- [ ] Con Redis caído, el reporte responde igual (desde la base).

**Referencias:** A-11 (con el porqué de las llaves con versión: no se borra nada ni se coordinan réplicas), RNF-2, N-11.

### E7-H05 · Exportación asíncrona de reportes (Excel y PDF) — `Must` · 2.5 h ⭐ historia grande
**Alcance (cambio de alcance aprobado por el PO: pasa de F5 a la Fase 1):** cola de exportaciones en SQL Server (`SolicitudExportacion` con estado de catálogo `Pendiente`/`Procesando`/`Completada`/`Fallida`/`Expirada`, arrendamiento con token de fencing, intentos y expiración), procesada por las dos réplicas como consumidores en competencia (`UPDLOCK, READPAST`), con generación por streaming (exceljs y pdfmake, A-16 y A-24) que reutiliza el servicio de reportes y su caché, y archivos en el puerto `AlmacenArchivos` (volumen de Docker compartido por `api-1` y `api-2`). Endpoints solo para el Admin: `POST /admin/reportes/{reporte}/exportaciones` (202 + `Location`, agrupación de solicitudes iguales, máximo de pendientes por usuario → 429), `GET /admin/exportaciones`, `GET /admin/exportaciones/{id}` (con `Retry-After` mientras no termina) y `GET /admin/exportaciones/{id}/archivo` (descarga por streaming). Purga horaria de los archivos vencidos (24 h). Plan en `docs/planes/E7-H05-exportacion-asincrona.md`.
**CA**
- [ ] El POST responde 202 de inmediato y el estado avanza hasta `Completada`.
- [ ] Una solicitud igual (mismo usuario, reporte, formato y filtros) vigente devuelve la misma; pasar el máximo de pendientes responde 429.
- [ ] El archivo generado en una réplica se descarga desde la otra.
- [ ] Una réplica que muere a mitad de un reporte: otra lo retoma al vencer el arrendamiento y queda un solo archivo; la muerta no puede escribir el resultado.
- [ ] Los totales del Excel y del PDF coinciden al centavo con el reporte JSON; el archivo dice "datos al" con la fecha y hora de Guatemala.
- [ ] Un texto que empieza con `=`, `+`, `-`, `@`, tabulador o retorno de carro no se interpreta como fórmula en Excel.
- [ ] La solicitud de otro Admin responde 404; un Operador o un Cliente, 403.
- [ ] La purga borra los archivos vencidos y marca la solicitud `Expirada`.

**Referencias:** A-24, A-16, RNF-2, A-04, RF-08.

---

## E8 · Cierre de la Fase 1

### E8-H01 · README de la Fase 1 — `Must` · 0.75 h
**Alcance:** instalación desde cero (requisitos, `.env`, `docker compose up -d`, URLs), credenciales de prueba, decisiones técnicas y de negocio resumidas con enlaces a `docs/`, diagrama ER, **diagrama de estados del pedido** (Mermaid), cómo correr las pruebas y la concurrencia, y la lista de mejoras documentadas.
**CA**
- [ ] Una persona que solo lee el README puede levantar el proyecto y probar un flujo de compra en Swagger.

**Referencias:** enunciado §05 (Calidad y entorno) y §07.

### E8-H02 · Revisión contra penalizaciones — `Must` · 0.5 h
**Alcance:** checklist automatizable: búsqueda de texto SQL en `apps/api` (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `EXEC` fuera de `ejecutarSP`), de concatenación en SPs con SQL dinámico, de `FLOAT`/`REAL` en `database/`, de secretos en el repositorio; recorrido de los criterios de aceptación de RF-01 a RF-09.
**CA**
- [ ] Cero hallazgos o cada hallazgo corregido.
- [ ] OpenAPI completo y sin endpoints sin documentar.

**Referencias:** enunciado §08 (penalización directa).

### E8-H03 · Ensayo en máquina limpia — `Must` · 0.25 h
**Alcance:** `docker compose down -v`, clonar el repositorio en otra carpeta y seguir el README al pie de la letra.
**CA**
- [ ] Todo levanta sin pasos manuales y `pnpm test:concurrencia` pasa.
- [ ] **Commit final de la Fase 1 antes del mediodía del lunes.**

**Referencias:** RNF Portabilidad.

---

## E9 · Observabilidad, tiempo real y defensa

Encargo del PO después del push de la Fase 1. E9-H01 y E9-H02 son historias grandes: plan escrito en `docs/planes/`, verificado contra el alcance antes de implementar.

### E9-H01 · OpenTelemetry y Grafana LGTM — `Must` · 2.0 h ⭐ historia grande
**Alcance:** paquetes de la familia `@opentelemetry` (SDK de Node, auto-instrumentación de http, express, tedious e ioredis, exportador OTLP e instrumentación de pino), listados con su versión en A-16 y el README; cualquier paquete fuera de esa familia requiere aprobación. El SDK se inicializa antes que todo (`node --import`). Perfil de compose `observabilidad` con `grafana/otel-lgtm` en versión fija, IP fija y `extra_hosts` (sin DNS), Grafana solo en `127.0.0.1` con su puerto en `.env`. Sin el perfil, la API funciona igual, sin errores repetidos en el log ni conexiones fuera de la subred; la activación es un solo comando del README. Trazas sin valores de parámetros de SQL, argumentos de Redis (incluido `AUTH`), `Authorization`, `Cookie`, cuerpos ni datos de tarjeta. `requestId` en cada span; `trace_id` y `span_id` en cada línea de pino. Spans propios de la pasarela (autorizar, capturar, anular, consultar, reembolsar), de cada tarea del planificador (réplica y si tomó el bloqueo) y del procesamiento de exportaciones; los spans de SQL muestran el SP. Métricas: duración HTTP por ruta y estado, pedidos creados, resultado de los pagos, ejecuciones de tareas por resultado y exportaciones pendientes. Logs a Loki por OTLP, correlacionados con sus trazas. Dashboard de Grafana aprovisionado desde `infra/grafana` (latencia y errores por endpoint, y negocio) y un recorrido de demo en el README. RNF-4, 01 §11 y el diagrama de arquitectura dejan de decir «planificado».
**CA**
- [ ] Sin el perfil, la API arranca y atiende igual, sin errores repetidos ni conexiones fuera de la subred.
- [ ] Con el perfil (un comando), una compra se ve como una traza: petición → réplica → SPs → pasarela, y sus logs están en Loki con el mismo `trace_id`.
- [ ] Un exportador en memoria prueba que ningún span lleva parámetros de SQL, argumentos de Redis, `Authorization`, `Cookie`, cuerpos ni datos de tarjeta.
- [ ] Cada línea de pino lleva `trace_id` y `span_id`; cada span, el `requestId`.
- [ ] Las métricas HTTP y de negocio aparecen en el dashboard aprovisionado.

**Referencias:** RNF-4, A-16, A-03 (subred e IPs fijas), A-18 (requestId), N-03.

### E9-H02 · Dashboard en tiempo real con SSE — `Must` · 1.5 h ⭐ historia grande
**Alcance:** `GET /admin/reportes/eventos`, solo Admin, `text/event-stream`, con el token en `Authorization` (nunca en la URL; decisión A-25). Canal entre réplicas con Redis pub/sub y una conexión de suscripción propia por réplica: cada incremento de versión de la caché (A-11) publica `{ dominio, version }` después del commit y cada réplica lo reenvía a sus clientes. Los eventos solo avisan; el cliente vuelve a pedir el reporte. Evento inicial con las versiones actuales; cada evento lleva la versión como `id` (`Last-Event-ID`). Como máximo un evento por dominio cada N segundos por réplica (constante con nombre). Heartbeat como comentario SSE. El stream se cierra al vencer el access token y al cambiar la versión de sesión (A-07). Máximo de conexiones por usuario y por réplica → 429. Al apagarse (SIGTERM) la réplica cierra sus streams. nginx: `location` propia sin buffering y con timeout de lectura largo. Redis caído: el stream sigue sin eventos, con el log de cambio de estado; al volver, se envían las versiones actuales. Instrumentado con spans de E9-H01.
**CA**
- [ ] Un pedido creado en `api-1` llega como evento a un cliente conectado a `api-2`.
- [ ] Una ráfaga de escrituras produce como máximo un evento por dominio en la ventana.
- [ ] 401 sin token; 403 para Operador y Cliente; 429 al pasar el límite.
- [ ] El stream se cierra al vencer el token, al revocar la sesión y al apagar la réplica.
- [ ] Con Redis caído el stream sigue abierto; al volver, llegan las versiones actuales.

**Referencias:** A-25 (nueva), A-11, A-07, RNF-2, A-03.

### E9-H03 · Guía de defensa — `Must` · 1.5 h
**Alcance:** `docs/defensa/` con un índice, un archivo por módulo y archivos transversales (arquitectura, base de datos, concurrencia, seguridad, pruebas, infraestructura y observabilidad). Cada módulo: qué hace (3–5 líneas), su flujo crítico en un diagrama de secuencia Mermaid, una tabla regla → dónde vive → `archivo:línea` → ID de la decisión, qué pasa con dos peticiones simultáneas y con una réplica que muere, modos de falla, alternativas descartadas y de 10 a 15 preguntas probables con respuesta corta y «muéstralo en». Un archivo con las 30 preguntas más difíciles del proyecto y un guion de demo de 10 minutos con los comandos exactos.
**CA**
- [ ] Cada afirmación cita `archivo:línea` o una prueba y se verificó contra el código; nada aspiracional.
- [ ] El guion de demo se puede seguir de punta a punta con los comandos escritos.

**Referencias:** todo `docs/`, el enunciado y `docs/revision/estado-backend.md`.

### E9-H04 · Revisión manual de pagos y reembolsos — `Must` · 2.0 h ⭐ historia grande
Encargo del PO al cierre de la Fase 1: el Admin resuelve con evidencia un intento de pago `EnRevision` y un reembolso `Fallido`, y todo queda en la bitácora.
**Alcance:** solo Admin. `GET /admin/pagos/en-revision` (paginado: intento, pedido si lo hay, cliente, monto, transacción, causa y fecha) y `POST /admin/pagos/:id/resolver` con `{ resolucion, motivo }`, motivo obligatorio. Resoluciones:
- **CobroVerificado** (intento con pedido): solo si `consultar(llave)` en la pasarela confirma `Capturada`; si no, se rechaza con un código claro. El pedido sigue su flujo.
- **SinCobro** (intento con pedido): cancela el pedido reutilizando el flujo de cancelación existente (estado, `ReingresoCancelacion`, cupón revertido y, como no hubo captura, sin reembolso), con el motivo del Admin. Sin un camino paralelo.
- **Reembolsar** (cobro capturado sin pedido): crea un reembolso `Pendiente` que procesa el job de siempre. Si `Reembolso` exige `IDPedido`, la migración le permite apuntar al intento, con un `CHECK` de exactamente uno de los dos; `MontoReembolsado` nunca supera lo capturado.

`POST /admin/reembolsos/:id/resolver` con `{ motivo, referencia }`: un reembolso `Fallido` pasa al estado nuevo `ResueltoManual` (motivo, referencia, quién y cuándo), distinto de `Completado`; para los montos cuenta como reembolsado. Una resolución solo procede desde `EnRevision` o `Fallido`, con bloqueo de la fila; resolver dos veces responde 409. La conciliación y el job de reintento nunca tocan un intento `EnRevision` ni un reembolso `ResueltoManual`. Triggers de bitácora en `IntentoPago` (solo al cambiar de estado) y en `Reembolso`, que también cubren el reintento actual.
**CA**
- [ ] Cada resolución hace lo descrito y queda en la bitácora con quién, cuándo y el motivo.
- [ ] `CobroVerificado` sin captura confirmada en la pasarela se rechaza y no cambia nada.
- [ ] Dos resoluciones simultáneas del mismo intento o reembolso: una pasa y la otra recibe 409.
- [ ] Operador y Cliente reciben 403.
- [ ] N-03 o N-09, 01 §5.2, 02 y la guía de defensa actualizados (con su prueba de citas).

**Referencias:** N-03, N-09, A-02, A-05, A-18, M-01, `docs/revision/estado-backend.md` §8.

---

## 4. Semana 2 (Fase 2: frontend y proyecto completo) — vista general

El orden de construcción, por módulos (F1, módulos 1 a 11 y F6), está en [`05-arquitectura-frontend.md`](./05-arquitectura-frontend.md) §16. Las historias de la Fase 2 se agregan en la sección 6 de este backlog, módulo por módulo.

| Épica | Contenido |
|---|---|
| F1 Base del frontend | Vite + React + TS, rutas protegidas y menús por rol, renovación transparente del token, cliente HTTP con manejo de errores, componentes reutilizables (tabla paginada del servidor, formularios, estados de carga, vacío y error) |
| F2 Tienda | Catálogo con búsqueda y filtros, detalle, carrito con avisos, checkout, pago, mis pedidos |
| F3 Backoffice | Catálogo, precios, inventario y kardex, pedidos y devoluciones, cupones, usuarios, bitácora, configuración |
| F4 Dashboard | Gráficas de ventas, categorías, top 10 y carritos abandonados |
| F5 Extras y calidad | Script de carga pesada (la observabilidad con Grafana LGTM pasó a E9-H01) y lo recortado de la Fase 1 (la conciliación de pagos pasó a E5-H04). **Carga pesada (decisión de cierre de E7):** sobre una base nueva, con el número de pedidos como parámetro del generador (`SP_Semilla_GenerarDatosDemo @Pedidos`), porque el generador es idempotente sobre una base que ya tiene los datos demo. Con esa carga se mide también el filtro de carritos abandonados (`VW_Carrito_Abandonados`), que hoy no usa un índice |
| F6 Cierre y defensa | README final de la Fase 2 y el ensayo de la demo con el frontend (las preguntas de defensa y el guion de la Fase 1 ya están en `docs/defensa/`, E9-H03) |

---

## 5. Tablero

| Historia | Título | Prioridad | Horas | Estado |
|---|---|---|---|---|
| E0-H01 | Monorepo y estándares de código | Must | 0.5 | Hecha |
| E0-H02 | Docker Compose base: SQL Server y Redis | Must | 0.5 | Hecha |
| E0-H03 | Migrador de base de datos | Must | 0.75 | Hecha |
| E0-H04 | Esqueleto de la API y piezas compartidas | Must | 0.75 | Hecha |
| E0-H05 | Dos réplicas detrás de nginx | Must | 0.25 | Hecha |
| E0-H06 | Base de pruebas | Should | 0.25 | Hecha |
| E1-H01 | Prueba de tablas ledger con llaves foráneas | Must | 0.25 | Hecha |
| E1-H02 | Tablas de seguridad, direcciones, catálogo e inventario | Must | 0.75 | Hecha |
| E1-H03 | Tablas de carrito, cupones, envíos, parámetros y checkout | Must | 0.5 | Hecha |
| E1-H04 | Tablas de pedidos, devoluciones, reembolsos y bitácora con sus triggers | Must | 0.75 | Hecha |
| E1-H05 | Funciones y vistas base | Must | 0.5 | Hecha |
| E1-H06 | Semillas de catálogos, geografía, usuarios y catálogo demo | Must | 0.75 | Hecha |
| E2-H01 | Registro e inicio de sesión | Must | 0.75 | Hecha |
| E2-H02 | Rotación del refresh token y logout | Must | 0.5 | Hecha |
| E2-H03 | Autenticación, autorización y revocación | Must | 0.5 | Hecha |
| E2-H04 | Gestión de usuarios y perfil | Should | 0.5 | Hecha |
| E2-H05 | Direcciones y catálogo geográfico | Must | 0.25 | Hecha |
| E3-H01 | Categorías | Must | 0.25 | Hecha |
| E3-H02 | Atributos y valores | Must | 0.25 | Hecha |
| E3-H03 | Productos, imágenes y variantes | Must | 1.0 | Hecha |
| E3-H04 | Precios versionados | Must | 0.5 | Hecha |
| E3-H05 | Búsqueda y filtros del catálogo | Must | 0.75 | Hecha |
| E3-H06 | Inventario y kardex | Must | 0.75 | Hecha |
| E4-H01 | Carrito de invitado y de cliente | Must | 0.75 | Hecha |
| E4-H02 | Garantía de precio de 3 días | Must | 0.5 | Hecha |
| E4-H03 | Fusión del carrito al iniciar sesión o registrarse | Must | 0.25 | Hecha |
| E4-H04 | Cupones (administración) | Must | 0.25 | Hecha |
| E4-H05 | Aplicar cupón en el carrito | Must | 0.5 | Hecha |
| E4-H06 | Envíos y parámetros | Should | 0.25 | Hecha |
| E5-H01 | Iniciar la sesión de pago | Must | 1.0 | Hecha |
| E5-H02 | Pasarela de pago simulada | Must | 0.5 | Hecha |
| E5-H03 | Confirmar el pago y crear el pedido | Must | 1.25 | Hecha |
| E5-H04 | Planificador de tareas y expiración de sesiones | Must | 0.5 | Hecha |
| E5-H05 | Test de concurrencia | Must | 0.75 | Hecha |
| E6-H01 | Consulta de pedidos | Must | 0.5 | Hecha |
| E6-H02 | Cambios de estado | Must | 0.75 | Hecha |
| E6-H03 | Cancelación con reembolso | Must | 1.0 | Hecha |
| E6-H04 | Devoluciones | Must | 0.5 | Hecha |
| E7-H01 | Dashboard | Must | 1.0 | Hecha |
| E7-H02 | Consulta de la bitácora | Must | 0.25 | Hecha |
| E7-H03 | Generador de datos demo | Should | 1.25 | Hecha |
| E7-H04 | Caché de reportes con invalidación | Must | 0.75 | Hecha |
| E7-H05 | Exportación asíncrona de reportes (Excel y PDF) | Must | 2.5 | Hecha |
| E8-H01 | README de la Fase 1 | Must | 0.75 | Hecha |
| E8-H02 | Revisión contra penalizaciones | Must | 0.5 | Hecha |
| E8-H03 | Ensayo en máquina limpia | Must | 0.25 | Hecha |
| E9-H01 | OpenTelemetry y Grafana LGTM | Must | 2.0 | Hecha |
| E9-H02 | Dashboard en tiempo real con SSE | Must | 1.5 | Hecha |
| E9-H03 | Guía de defensa | Must | 1.5 | Hecha |
| E9-H04 | Revisión manual de pagos y reembolsos | Must | 2.0 | Hecha |
| F1-H01 | Proyecto web, tema y herramientas | Must | 1.0 | Hecha |
| F1-H02 | Contrato: foto del OpenAPI, tipos y cobertura | Must | 0.75 | Hecha |
| F1-H03 | Cliente `api`, `ErrorApi` y `QueryClient` | Must | 0.75 | Hecha |
| F1-H04 | Sesión con renovación transparente | Must | 1.5 | Hecha |
| F1-H05 | Rutas, áreas, layouts y control por rol | Must | 1.0 | Hecha |
| F1-H06 | Componentes de datos: `EstadoVista`, `TablaServidor` y URL | Must | 1.0 | Hecha |
| F1-H07 | Formularios, formato y prenda | Must | 1.0 | Hecha |
| F1-H08 | Base de E2E y pruebas transversales | Must | 0.75 | Hecha |
| M1-H01 | Ingresar y registrarse | Must | 1.0 | Hecha |
| M1-H02 | Perfil y contraseña | Should | 0.75 | Hecha |
| M2-H01 | Datos de presentación del catálogo (backend) | Must | 1.25 | Hecha |
| M2-H02 | Catálogo con búsqueda y filtros | Must | 1.0 | Hecha |
| M2-H03 | Detalle de producto | Must | 1.25 | Lista |

---

## 6. Fase 2 — Frontend (cierre: lunes 9 nov, 23:59)

> Fuente: [`05-arquitectura-frontend.md`](./05-arquitectura-frontend.md) (FE-01 a FE-15) y la skill `modulo-react`. El diseño de referencia está en Figma (05 §17); Claude Code lo **lee** con el MCP de Figma y nunca lo modifica.
> Se construye **por módulos** en el orden de 05 §16. Cada módulo se cierra con su E2E contra el backend real y sus rutas cubiertas en `pnpm contrato:cobertura`.

### 6.1 Definición de terminado del frontend (aplica a toda historia `F*`)

1. TypeScript `strict` sin `any`, `@ts-ignore` ni `!` sin justificar; `pnpm lint`, `pnpm typecheck` y `pnpm test` pasan.
2. Cumple el checklist de la skill `modulo-react` (§13) y la subsección SOLID y clean code de `CLAUDE.md`.
3. Ninguna dependencia fuera de FE-14 (05 §15) sin aprobación.
4. Toda vista tiene sus estados de carga, vacío y error; todo monto y fecha pasa por `shared/formato`.
5. Cada criterio de aceptación tiene su prueba (TDD); si la historia toca un flujo de punta a punta, también su E2E.
6. `docker compose up -d` desde cero sigue levantando todo y la SPA responde en `http://localhost:8080`.
7. **Un commit por historia** con formato convencional, sin atribución: `feat(web): F1-H04 sesión con renovación transparente`.
8. **Resumen de cierre** como en el backend, con una diferencia en "Cómo probarlo": los pasos en el navegador (qué abrir, qué hacer, qué se ve) y el comando de su prueba.

### 6.2 Plan

| Bloque | Contenido | Horas | Estado |
|---|---|---|---|
| **F1 Base del frontend** | Proyecto, tema, contrato, cliente `api`, sesión, rutas por rol, componentes compartidos y base de E2E | 7.75 | Hecha |
| **M1 Cuenta** | Ingresar, registrarse, perfil y contraseña | 1.75 | Lista |
| **M2 Catálogo de la tienda** | Datos de presentación (ilustración y colores), catálogo con filtros y detalle de producto | 3.5 | Lista |
| M3 Carrito | Líneas, garantía de precio, cupón, envíos, carrito de invitado y fusión | 2.0 | Por detallar |
| M4 Checkout y pago | Direcciones, sesión de pago con reservas y pago idempotente | 2.5 | Por detallar |
| M5 Mis pedidos | Listado, detalle con historial y cancelación | 1.0 | Por detallar |
| M6 Backoffice de catálogo | Categorías, atributos, productos, variantes, imágenes y precios | 2.5 | Por detallar |
| M7 Inventario | Entradas, ajustes, kardex, existencias y conciliación | 1.25 | Por detallar |
| M8 Gestión de pedidos | Estados, devoluciones, reembolsos y pagos en revisión | 2.0 | Por detallar |
| M9 Cupones, envíos y configuración | Administración | 1.25 | Por detallar |
| M10 Usuarios y bitácora | Administración | 1.25 | Por detallar |
| M11 Dashboard | Gráficas, tiempo real y exportaciones | 2.0 | Por detallar |
| F6 Cierre | README final, matriz completa (`contrato:cobertura --estricto`), ensayo de la demo y verificación desde cero | 1.5 | Por detallar |

---

## F1 · Base del frontend

> Objetivo: una SPA que levanta con Docker, con el tema de Figma, el contrato tipado, la sesión con renovación transparente, las rutas por rol y las piezas compartidas listas, para que cada módulo solo agregue su capa de datos y sus pantallas.

### F1-H01 · Proyecto web, tema y herramientas — `Must` · 1.0 h
**Alcance**
- `apps/web` (`@shopcart/web`): Vite + React 19 + TypeScript `strict`, con la configuración base del monorepo. Consume `@shopcart/shared` con la condición `@shopcart/fuente` en `resolve.conditions` de Vite y en `customConditions` del `tsconfig` (01 §12).
- Estructura de carpetas de 05 §3, sin módulos todavía.
- **Tailwind CSS + shadcn/ui** inicializado con las primitivas en `src/shared/ui` y `cn()`.
- **Tema desde Figma:** lee con el MCP de Figma (`get_variable_defs`) las colecciones `Color` (modos Claro y Oscuro), `Forma` y `Prenda` del archivo de 05 §17 y escribe las variables CSS con **los mismos nombres de su *code syntax*** (`--background`, `--primary`, `--oferta`, `--radius-md`, `--prenda-azul-marino`…). Modo oscuro con la clase `.dark`. No inventes valores: si una variable de Figma no tiene equivalente o shadcn necesita una que Figma no tiene, detente y pregunta.
- Fuentes autoalojadas con `@fontsource/space-grotesk` (títulos y precios) y `@fontsource/public-sans` (texto), según los estilos de texto de Figma.
- ESLint para `apps/web`: reglas de React Hooks, accesibilidad (`jsx-a11y`) y **fronteras de FE-09** con `eslint-plugin-boundaries`: `paginas → componentes → hooks → <modulo>.api.ts → shared/api`; entre módulos solo por `index.ts`; excepción: `src/app/` importa `modules/*/paginas/*`.
- Vitest con jsdom, Testing Library y MSW: `src/test/` con el servidor MSW y un `renderizar()` provisional (router en memoria y `QueryClient` sin reintentos; la sesión se agrega en F1-H04).
- Proxy de Vite: `/api` → `http://localhost:8080` (05 §5).
- **Dockerfile de `web` en dos etapas:** compila `@shopcart/shared` y la SPA con pnpm, y sirve `dist/` con el nginx actual (misma versión fijada con digest). La carpeta `static/productos` se sigue sirviendo.

**Fuera de alcance:** pantallas, sesión, cliente `api`.

**CA**
- [ ] `pnpm install && pnpm lint && pnpm typecheck && pnpm test` pasan en limpio.
- [ ] Un import de `modules/a/hooks/x` desde `modules/b/` hace fallar el lint; un componente que importa `shared/api` también.
- [ ] `docker compose up -d --build` sirve la SPA en `http://localhost:8080`; recargar una ruta profunda (`/catalogo/x`) devuelve la SPA y no un 404 (el `try_files` de nginx); `/api/v1/health` y `/api/docs` siguen respondiendo.
- [ ] Las variables CSS de claro y oscuro coinciden una a una con las de Figma (lista en el resumen de cierre).

**Referencias:** FE-01, FE-09, FE-14, FE-15, A-03, 05 §3, §12, §15 y §17.

### F1-H02 · Contrato: foto del OpenAPI, tipos y cobertura — `Must` · 0.75 h
**Alcance**
- `packages/contrato` (`@shopcart/contrato`): `openapi.json` y los tipos generados con `openapi-typescript` (solo desarrollo), ambos versionados.
- `pnpm openapi:exportar`: genera el documento con `generarDocumentoOpenApi()` **sin levantar la API, sin base, sin Redis y sin un `.env` real**, y lo escribe ordenado y con formato estable. Si algún módulo de la API impide importarlo sin efectos (por ejemplo, porque lee la configuración al importarse), detente y propón cómo resolverlo sin cambiar el comportamiento de la API.
- `pnpm openapi:verificar`, dentro de `pnpm lint`: falla si la foto o los tipos no coinciden con lo que genera el código.
- `pnpm contrato:cobertura`: cruza las rutas de la foto con las rutas literales usadas en `apps/web/src/modules/*/*.api.ts` y con `packages/contrato/exclusiones.json` (cada exclusión con su motivo: `/health`, Swagger). Imprime por módulo: cubiertas, excluidas y pendientes. Con `--estricto` (que se usa en F6) termina con error si queda alguna pendiente.

**CA**
- [ ] Ejecutar `openapi:exportar` dos veces seguidas no produce diff.
- [ ] Cambiar la descripción de un esquema de la API sin reexportar hace fallar `pnpm lint`.
- [ ] `contrato:cobertura` lista las rutas de `/api/v1` del router (01 §5.2) agrupadas por módulo; hoy todas pendientes salvo las excluidas.

**Referencias:** FE-13, A-08, 05 §9.

### F1-H03 · Cliente `api`, `ErrorApi` y `QueryClient` — `Must` · 0.75 h
**Alcance**
- `shared/api`: cliente `api` con `openapi-fetch` tipado con `@shopcart/contrato`, mismo origen y cookies del mismo origen.
- *Middleware* que agrega `Authorization: Bearer` cuando hay token (por ahora lo lee de una función que F1-H04 implementa).
- `ErrorApi` (`status`, `codigo`, `mensaje`, `detalles`, `requestId`) a partir del formato de A-06; una falla de red es `ErrorApi` con `codigo: 'RED'` y `status: 0`; una respuesta de error sin el formato esperado se convierte en un error genérico que conserva el `status` y el `X-Request-Id`.
- Tipos de ayuda `Respuesta<ruta, método>` y `Cuerpo<ruta, método>` (05 §9, skill `modulo-react` §2).
- `QueryClient` con las reglas de FE-02: reintento solo en red y 5xx (hasta 2), nunca en 4xx ni en mutaciones.

**CA**
- [ ] Un 400 con `detalles` por campo, un 409 con `detalles` de objeto, un 500 sin cuerpo y una falla de red producen el `ErrorApi` correcto (pruebas con MSW).
- [ ] La función de reintento no reintenta un `ErrorApi` 4xx y sí uno de red o 5xx (prueba unitaria).

**Referencias:** FE-02, FE-13, A-06, 01 §4.6.

### F1-H04 · Sesión con renovación transparente — `Must` · 1.5 h ⭐ historia grande
**Alcance:** `shared/api/sesion` exactamente como 05 §5 (FE-05):
- Token en memoria del módulo; `useSesion()` con `useSyncExternalStore` (usuario, rol, `rehidratando`, `tieneRol()`).
- `establecer(sesion)` (lo usan el login y el registro del módulo Cuenta), `renovar()` y `cerrar()` (`POST /auth/logout`, limpia la sesión local y avisa a las demás pestañas).
- **Single-flight** dentro de la pestaña; **Web Locks** (`shopcart-refresh`) y **BroadcastChannel** (`shopcart-sesion`) entre pestañas; la que espera el lock no renueva si ya llegó un token nuevo.
- *Middleware* del cliente `api`: ante un 401 fuera de `/auth`, espera la renovación y reintenta **una vez** con una copia de la petición tomada antes de enviarla.
- **Rehidratación** con `POST /auth/refresh` en `main.tsx` antes de montar React.
- `queryClient.clear()` cuando cambia el usuario o se cierra la sesión.
- `renderizar()` de las pruebas acepta un rol para montar una sesión simulada.

Escribe primero un plan corto con `writing-plans` (cómo se coordinan promesa, lock y canal, y cómo se prueban) y espera la aprobación de Diego.

**CA**
- [ ] Cinco peticiones que reciben 401 a la vez producen **un solo** `POST /auth/refresh` y las cinco se completan.
- [ ] Dos sesiones que comparten lock y canal simulados y renuevan a la vez producen un solo refresh; la segunda usa el token que publicó la primera.
- [ ] Si el refresh falla (`REFRESH_REUTILIZADO`, `USUARIO_INACTIVO`, sin cookie), la sesión queda cerrada en todas las pestañas y la caché vacía.
- [ ] Con `StrictMode`, al cargar la aplicación hay un solo refresh.
- [ ] Después de iniciar y renovar sesión, `localStorage` y `sessionStorage` no contienen el token (prueba explícita).
- [ ] Un 401 de `/auth/login` llega al llamador como `ErrorApi` y no dispara renovación.

**Referencias:** FE-05, FE-08, A-07, 01 §5.3, 05 §5.

### F1-H05 · Rutas, áreas, layouts y control por rol — `Must` · 1.0 h
**Alcance**
- `app/rutas.ts`: **una sola definición** de rutas con roles y entrada de menú, de la que salen el guardián y los menús (05 §4, skill `modulo-react` §8).
- Tres áreas con `lazy()` y su propio `errorElement`: tienda (pública e invitado/Cliente), cuenta (con sesión) y backoffice (Operador y Administrador; los menús cambian por rol).
- Guardián: sin sesión → `/ingresar?volver=<ruta>`; sin rol → página **Sin permiso**; mientras rehidrata → estado de carga. Página **No encontrado** para rutas desconocidas.
- Layouts con los tokens del tema: tienda (marca, enlace al carrito, acceso a la cuenta), backoffice (navegación lateral que en móvil se vuelve menú) y cuenta. Selector de tema claro y oscuro y `Toaster` de `sonner`. Las páginas de cada módulo son marcadores hasta su historia. El aspecto final de los layouts se ajusta cuando esté su frame en Figma.
- `/ingresar` es un marcador que el módulo Cuenta reemplaza.

**CA**
- [ ] Un Cliente que entra por URL a `/backoffice/...` ve "Sin permiso"; un invitado que entra a una ruta de cuenta va a `/ingresar?volver=…`.
- [ ] Un Operador no ve en el menú lo que es solo del Administrador, y entrar por URL le muestra "Sin permiso".
- [ ] Una prueba recorre la definición: cada entrada de menú apunta a una ruta existente con los mismos roles.
- [ ] El build genera un paquete separado para el backoffice (se muestra en el resumen la lista de *chunks*).
- [ ] Un error al renderizar una página del backoffice muestra el `errorElement` del área y la tienda sigue funcionando.

**Referencias:** FE-04, FE-08, RF-01, enunciado §05 (rutas protegidas y menús por rol).

### F1-H06 · Componentes de datos: `EstadoVista`, `TablaServidor` y URL — `Must` · 1.0 h ⭐ historia grande
**Alcance** (05 §8, skill `modulo-react` §5 y §7):
- `useParametrosUrl(esquemaZod)`: valida y escribe la URL; un valor inválido cae al valor por defecto del esquema.
- `useDebounce` (300 ms para texto libre).
- `EstadoVista`: carga con esqueleto, vacío con título y acción, error con mensaje del backend, botón de reintentar y `requestId`.
- `Paginacion` y `TablaServidor<T, Orden>`: columnas tipadas con `celda`, `prioridad` y `ordenable` limitado al `enum` de `orden` del esquema; `aria-sort`; cambiar un filtro vuelve a la página 1; página fuera de rango salta a la última; `keepPreviousData` con indicador; vacío que distingue "sin registros" de "sin resultados con estos filtros"; bajo `md`, tarjetas con las columnas de prioridad 1.

Escribe primero un plan corto de la API de `TablaServidor` (props y un ejemplo de uso) y espera la aprobación de Diego: es el componente que más se reutiliza.

**CA**
- [ ] Una columna con `ordenable` fuera del `enum` no compila (prueba de tipos con `@ts-expect-error`).
- [ ] Cambiar orden o página actualiza la URL, y recargar conserva la vista; "atrás" vuelve a la vista anterior.
- [ ] Los tres estados de `EstadoVista` y los dos vacíos de la tabla se prueban con MSW.
- [ ] En 375 px la tabla se muestra como tarjetas (prueba del componente con el ancho simulado).

**Referencias:** FE-06, enunciado §05 (tablas con paginación, ordenamiento y filtros del servidor; estados de carga, vacío y error).

### F1-H07 · Formularios, formato y prenda — `Must` · 1.0 h
**Alcance**
- `useFormularioApi`, `CampoFormulario` y `AvisoFormulario` con el mapeo de errores de 05 §7: 400 → campo (`body.x` → `x`), 409/422 → aviso, 5xx/red → aviso con `requestId`; deshabilita el envío mientras la mutación está en curso.
- `shared/formato`: `formatearMonto` (texto → GTQ con `Intl`, nunca `number`), `formatearFechaHora` (siempre `America/Guatemala`) y `formatearFechaCalendario` (sin `new Date()`); componentes `Monto` y `FechaHora`.
- **`Prenda`:** un componente con un SVG por tipo (Camisa, Pantalón, Vestido, Chaqueta, Tenis, Gorra) con `fill="currentColor"`, tomado del componente `Prenda` de Figma con el MCP, y el mapa de nombre de color de la semilla (Negro, Azul marino…) a su variable `--prenda-*`. Un color sin mapa usa un neutro. Este mapa es presentación (FE-15), no regla de negocio.

**CA**
- [ ] `formatearMonto("9999999999.99")` y `formatearMonto("-12.00")` dan el texto exacto, y una prueba verifica que no se convierte a `number`.
- [ ] Con el reloj fijado a las 23:30 de Guatemala (otro día en UTC), `formatearFechaHora` muestra el día de Guatemala y `formatearFechaCalendario("2026-11-03")` muestra el 3 de noviembre.
- [ ] Un 400 con `detalles: { errores: [{ campo: "body.nombreRecibe", … }] }` marca el campo `nombreRecibe`; un 422 muestra el mensaje del backend en el aviso.
- [ ] `Prenda` renderiza los seis tipos y toma el color con `currentColor` (prueba de componente).

**Referencias:** FE-03, FE-10, FE-15, A-21, A-12.

### F1-H08 · Base de E2E y pruebas transversales — `Must` · 0.75 h
**Alcance**
- Playwright en `apps/web/e2e` contra `SHOPCART_URL` (por defecto `http://localhost:8080`), `pnpm test:e2e` en la raíz (requiere el entorno levantado, como `test:concurrencia`).
- Fixture `apiAdmin` (token de Administrador por la API pública) y ayudante para crear un cliente de prueba con nombre único por corrida; `iniciarSesionPorApi(page, correo, contraseña)`, que inicia sesión con `page.request` para que la cookie `refresh` quede en el contexto y la SPA rehidrate al abrir.
- E2E transversales:
  1. Recargar la página conserva la sesión (rehidratación).
  2. **Dos pestañas del mismo contexto recargan a la vez** y ninguna pierde la sesión; una tercera recarga sigue con sesión (FE-05).
  3. Un Cliente que entra por URL al backoffice ve "Sin permiso" (RF-01, FE-04).

**CA**
- [ ] `pnpm test:e2e` pasa contra `docker compose up -d` desde cero, repetible sin limpiar datos.
- [ ] Ninguna prueba depende de la semilla demo ni del orden de ejecución.

**Referencias:** FE-12, 05 §13.

---

## M1 · Cuenta

> Frames: Ingresar escritorio `26:414` y móvil con credenciales incorrectas `26:460` (05 §17). Registro no tiene frame propio: usa el mismo formulario de Ingresar con sus campos.

### M1-H01 · Ingresar y registrarse — `Must` · 1.0 h
**Alcance**
- Mueve a `@shopcart/shared` `correoSchema`, `contrasenaSchema`, `loginSchema` y `registroSchema` (FE-03). **`openapi.json` queda idéntico.**
- `modules/auth`: `auth.api.ts` (`POST /auth/login`, `POST /auth/registro`) y sus mutaciones. Al responder, `sesion.establecer(respuesta)`.
- Páginas `/ingresar` (reemplaza el marcador) y `/registro` (ruta nueva en la definición única, solo para invitados): correo y contraseña; el registro agrega nombre y teléfono opcional.
- **`volver` seguro:** solo se acepta una ruta interna (empieza con `/`, no con `//` ni `/\`, sin esquema); cualquier otra cosa usa el destino por defecto. Por defecto: el Cliente va a `/` y el personal a `/backoffice`. Una función pura con su prueba.
- Con sesión activa, abrir `/ingresar` o `/registro` lleva al destino.
- Errores: `401 CREDENCIALES_INVALIDAS` en el aviso del formulario (nunca en un campo: N-15 no dice cuál falló); `429 DEMASIADAS_PETICIONES` en el aviso; `409 CORREO_EN_USO` en el campo `correo`. Para esto, `useFormularioApi` acepta un mapa opcional `campoPorCodigo` (`{ CORREO_EN_USO: 'correo' }`) para los 409/422 que corresponden a un campo; se documenta en la skill `modulo-react` §6.
- `avisosCarrito` de la respuesta (fusión del carrito, N-05) se muestran con `toast` al entrar.
- Encabezado: "Ingresar" pasa a "Mi cuenta" con sesión.

**CA**
- [ ] `volver=https://otro.sitio`, `volver=//otro.sitio` y `volver=/\otro.sitio` llevan al destino por defecto; `volver=/carrito` lleva a `/carrito` (prueba unitaria).
- [ ] Una contraseña sin números se rechaza en el navegador con el mismo mensaje que da el backend (mismo esquema).
- [ ] Un correo ya registrado marca el campo `correo` con el mensaje del backend.
- [ ] Credenciales incorrectas muestran "Correo o contraseña incorrectos." en el aviso, como en el frame `26:460`.
- [ ] E2E: registrarse con un correo único inicia sesión; cerrar sesión e ingresar de nuevo funciona; el sexto intento fallido muestra el aviso de demasiados intentos.

**Referencias:** RF-01, N-05, N-15, FE-03, FE-05, A-07.

### M1-H02 · Perfil y contraseña — `Should` · 0.75 h
**Alcance**
- **Backend (pequeño):**
  - Cuando la contraseña actual no coincide, `POST /usuarios/me/contrasena` responde el mismo `400 PARAMETRO_INVALIDO` con la forma de un 400 de validación, `detalles: { errores: [{ campo: "body.contrasenaActual", mensaje }] }`, para que el formulario lo marque en su campo. Con su prueba de integración.
  - El `200` de `POST /usuarios/me/contrasena` se declara en OpenAPI con el esquema de sesión (`respuestaSesionSchema`); hoy solo tiene descripción y la web tipada no vería la sesión que el código sí devuelve. El diff de `openapi.json` va en el mismo commit y solo cambia eso.
- Mueve a `shared` `actualizarPerfilSchema` y `cambiarContrasenaSchema`.
- `/cuenta/perfil` con dos secciones: datos (`GET/PATCH /usuarios/me`: nombre y teléfono) y contraseña (`POST /usuarios/me/contrasena`).
- El cambio de contraseña devuelve una sesión nueva: `sesion.establecer(respuesta)`. Las otras pestañas la reciben por el canal; las otras sesiones del usuario quedan revocadas (A-07).

**CA**
- [ ] Guardar el perfil actualiza el nombre sin recargar: la sesión adopta el que confirmó el backend (mismo token, también en las demás pestañas) y se ve arriba del menú de la cuenta, con el correo, y en la barra lateral del backoffice. El encabezado sigue diciendo "Mi cuenta" (M1-H01).
- [ ] Una contraseña actual incorrecta marca el campo `contrasenaActual`.
- [ ] Después de cambiar la contraseña, la sesión sigue activa y un refresh posterior funciona (E2E).
- [ ] Los tres estados de la página (carga, error y datos) se prueban.
- [ ] `openapi:exportar`: el diff agrega solo el cuerpo del `200` de `POST /usuarios/me/contrasena`.

**Referencias:** RF-01, N-15, A-07, E2-H04.

---

## M2 · Catálogo de la tienda

> Frames: Catálogo escritorio `22:2` y móvil `23:516`; Detalle escritorio `24:314` y móvil `24:406`.
> **Ajuste del diseño al contrato:** la búsqueda devuelve `precioMinimo` y `disponible` (booleano), no el estado de cada variante. En la tarjeta del catálogo, el precio se muestra como "Desde" + `precioMinimo` y la existencia solo como "Disponible" o "Agotado", según `disponible`. "Últimas X unidades" aparece solo en el detalle, por variante.

### M2-H01 · Datos de presentación del catálogo (backend) — `Must` · 1.25 h
**Alcance** (FE-15: la ilustración por tipo de prenda necesita saber qué dibujar y con qué colores):
- `V025__categoria_ilustracion.sql`: columna `Categoria.Ilustracion VARCHAR(20) NOT NULL` con `DEFAULT 'Camisa'` y `CHECK` en (`Camisa`, `Pantalon`, `Vestido`, `Chaqueta`, `Tenis`, `Gorra`). Es un atributo de presentación de la categoría, no una regla de negocio.
- `S007__ilustracion_categorias.sql`: asigna la ilustración a las 8 categorías de la semilla (Camisas y blusas → Camisa, Pantalones → Pantalon, Vestidos y faldas → Vestido, Chaquetas y suéteres → Chaqueta, Calzado → Tenis, Ropa deportiva → Camisa, Accesorios → Gorra, Infantil → Camisa).
- Crear y editar categoría aceptan `ilustracion` (opcional; enum en el esquema); `GET /categorias`, `GET /productos` y `GET /productos/{id}` la devuelven.
- `GET /productos/{id}` devuelve además `diasGarantiaPrecio`: el plazo de la garantía de precio del carrito (N-02), leído de `ParametroSistema` por el SP del detalle, sin otra consulta desde el backend. Lo muestra el aviso del detalle (M2-H03); el plazo es configurable por el Admin y la web nunca lo escribe fijo.
- `GET /productos` devuelve además `colores`: los valores distintos del atributo **Color** de las variantes activas del producto, en el orden de `ValorAtributo.Orden`, hasta 5. Se calcula en `VW_Catalogo_ProductosTienda` con `STRING_AGG` y se separa en el repositorio. Sin cifras de existencia (N-06).
- La convención "el atributo llamado Color es el color de la prenda" se documenta como **FE-16** en 05 §14, junto al mapa de nombres de color a `--prenda-*` (FE-15).
- Bitácora: el cambio de ilustración de una categoría queda registrado por el trigger existente (verificar que la nueva columna entra en el JSON).

**CA**
- [ ] Una ilustración fuera de la lista se rechaza con 400 (Zod) y con el `CHECK` en la base (prueba de integración por separado).
- [ ] `GET /productos` responde `colores` sin repetidos y sin variantes inactivas; un producto sin atributo Color responde `colores: []`.
- [ ] La búsqueda sigue respondiendo en menos de 1 s con la semilla (RNF-1); se muestra la medición.
- [ ] Cambiar el plazo de la garantía en `/admin/configuracion` cambia `diasGarantiaPrecio` en `GET /productos/{id}` (prueba de integración).
- [ ] `openapi:exportar` actualiza la foto y el diff solo agrega `ilustracion`, `colores` y `diasGarantiaPrecio`.

**Referencias:** FE-15, FE-16 (nueva), N-06, N-14, RNF-1, A-10, M-01.

### M2-H02 · Catálogo con búsqueda y filtros — `Must` · 1.0 h
**Alcance** (frames `22:2` y `23:516`):
- Mueve a `shared` el esquema de *query* de `GET /productos` (`texto`, `categoria`, `precioMin`, `precioMax`, `disponible`, `orden`, `direccion`, `pagina`, `tamano`). Resuelve aquí el límite que anotó F1-H06: `precioMin` y `precioMax` llegan de la URL como texto y se validan con `montoSchema`; la conversión a `Decimal` queda en la API.
- `modules/catalogo`: `catalogo.api.ts`, `catalogo.keys.ts`, `useProductos`, `useCategorias`.
- Página `/` con `useParametrosUrl`: chips de categoría (de `GET /categorias`), filtros de precio y "Solo con existencia", orden (relevancia, menor precio, mayor precio, nombre, recientes), cuadrícula de `TarjetaProducto` y `Paginacion`. El buscador del encabezado escribe `texto` (ya lo hace F1-H05).
- `TarjetaProducto`: ilustración `Prenda` de la categoría teñida con el **primer color** de `colores`; muestras de `colores` (solo visuales en la tarjeta); nombre, categoría, "Desde" + `precioMinimo`, y "Disponible" o "Agotado" según `disponible`. Enlaza al detalle.
- En móvil, los filtros se abren en un `Sheet` desde el botón "Filtros (n)", donde `n` es la cantidad de filtros activos.
- Estados: esqueleto de tarjetas, vacío sin filtros ("Todavía no hay productos") y con filtros ("Ningún producto con estos filtros" y Limpiar filtros), error con Reintentar.

**CA**
- [ ] Buscar "camion" encuentra "Camión" (lo resuelve el backend; E2E de punta a punta).
- [ ] Filtrar, ordenar y paginar cambia la URL; recargar conserva la vista; "atrás" vuelve a la anterior.
- [ ] Un `precioMin` mayor que `precioMax` muestra el mensaje del esquema y no consulta.
- [ ] Coincide con los frames en 375 y 1280 px (captura con Playwright en el resumen de cierre).
- [ ] E2E con datos propios: un producto creado por la API con una variante Azul aparece en la búsqueda con la prenda azul y su precio.

**Referencias:** RF-02, FE-06, FE-10, FE-15, A-10.

### M2-H03 · Detalle de producto — `Must` · 1.25 h
**Alcance** (frames `24:314` y `24:406`):
- `/productos/:id` (ruta nueva en la definición única) con `GET /productos/{id}`; un 404 muestra "No encontrado".
- Selección de variante **solo con los datos que llegan**: los atributos (Color, Talla…) y sus valores salen de `variantes[].valores`. Elegir un valor de cada atributo resuelve la variante; un valor que no forma ninguna variante disponible con los demás elegidos se muestra deshabilitado (la talla tachada del frame), con el texto "XL agotada en Azul" o "No disponible en Azul". Es una búsqueda sobre la lista, no una regla de negocio: la existencia la decide el backend.
- Al elegir un Color, la ilustración se tiñe; el texto "Color: Azul" se actualiza.
- La URL guarda la variante elegida (`?variante=<id>`), así se puede compartir.
- Precio de la variante elegida, "Incluye IVA del 12 %", y existencia por variante (`Disponible`, "Últimas N unidades" con `unidadesRestantes`, `Agotado`).
- Cantidad y "Agregar al carrito": **en esta historia el botón queda deshabilitado con el texto "Elige talla y color"** mientras falte un atributo, y la acción real se conecta en M3 (Carrito). Aviso de la garantía de precio como en el frame, con el plazo que manda el backend: "Al agregarlo, su precio queda garantizado por {diasGarantiaPrecio} días: si sube, pagas el anterior; si baja, pagas el nuevo." El "Incluye IVA del 12 %" va fijo (N-18).
- Galería: la ilustración teñida primero; si el producto tiene imágenes, se muestran como miniaturas que se pueden elegir (con su `textoAlternativo`).
- Móvil: la barra de compra fija abajo del frame `24:406`.

**CA**
- [ ] Con dos atributos, elegir Azul deshabilita las tallas que no existen o están agotadas en Azul, y viceversa (prueba con MSW con una matriz de variantes).
- [ ] La variante en la URL se restaura al recargar; una `variante` que no es del producto se ignora.
- [ ] `unidadesRestantes` solo aparece cuando la variante está en `UltimasUnidades` (N-06).
- [ ] Coincide con los frames en 375 y 1280 px (captura en el resumen de cierre).
- [ ] E2E: abrir el detalle de un producto creado por la API, elegir color y talla, y ver el precio de esa variante.

**Referencias:** RF-02, N-06, N-19, FE-10, FE-15, FE-16.
