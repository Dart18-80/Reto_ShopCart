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
| E7 Reportes, bitácora y datos demo | 3 | 2.5 | 2 | 1 | — |
| E8 Cierre de la Fase 1 | 3 | 1.5 | 3 | — | — |

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
- [ ] Un cupón con usos no permite cambiar tipo ni valor (`409 CUPON_USADO_NO_EDITABLE`); sí vigencia, límites y estado.
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

**Nota (cierre de E4):** `SP_Checkout_CancelarSesionActiva` (creado en E4-H03) libera hoy las reservas y el uso del cupón en línea. En esta historia se crean `SP_Inventario_LiberarReservas` y `SP_Cupones_LiberarUso` (internos) y `SP_Checkout_CancelarSesionActiva` pasa a llamarlos: no queda otra ruta de liberación.
- [ ] Exige sesión iniciada; un invitado recibe `401`.

**Referencias:** RF-06, N-01, N-02, N-06, A-13.

### E5-H02 · Pasarela de pago simulada — `Must` · 0.5 h
**Alcance:** puerto `PasarelaPago` (`autorizar`, `capturar`, `anular`, `reembolsar`) y adaptador `PasarelaSimulada`: idempotente por llave, tarjetas de prueba `4242…` aprobada, `4000…0002` rechazada (fondos insuficientes), `4000…0119` tiempo de espera agotado; devuelve marca, últimos 4 dígitos e ID de transacción.
**CA**
- [ ] La misma llave devuelve la misma respuesta.
- [ ] El número completo de tarjeta y el CVV nunca aparecen en logs, respuestas ni base de datos.

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

**Referencias:** RF-06, N-01, N-03, N-07, N-18.

### E5-H04 · Planificador de tareas y expiración de sesiones — `Must` · 0.5 h
**Alcance:** planificador interno en `src/shared/jobs`; `SP_Checkout_ExpirarSesiones` cada minuto y `SP_Carrito_ExpirarInvitados` cada hora (carritos de invitado con 30 días sin actividad → `Expirado`, N-05), ambos protegidos con `sp_getapplock`.
**CA**
- [ ] Una sesión vencida pasa a `Expirada` y libera sus reservas y el uso del cupón **sin intervención manual** (criterio de RF-07).
- [ ] Con las dos réplicas corriendo, cada ejecución la procesa una sola (comprobable en los logs).
- [ ] La tarea es idempotente: ejecutarla dos veces no cambia nada la segunda.

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

**Referencias:** RF-07, RF-08, RF-01.

### E6-H02 · Cambios de estado — `Must` · 0.75 h
**Alcance:** `POST /admin/pedidos/:id/estado {estadoEsperado, estadoNuevo, motivo}`; `SP_Pedidos_CambiarEstado` con concurrencia optimista; mapa de transiciones en el servicio; test que compara el mapa con `SP_Pedidos_ListarTransiciones`.
**CA**
- [ ] Una transición no permitida se rechaza en el backend (`409 TRANSICION_INVALIDA`) **y** en la base (el trigger), probado ambos por separado (criterio de RF-07).
- [ ] Si el pedido ya cambió de estado, responde `409 CONFLICTO_CONCURRENCIA`.
- [ ] Cada cambio registra usuario, fecha y hora, estado anterior y nuevo (criterio de RF-07).
- [ ] El test de coincidencia falla si el mapa y la tabla difieren.

**Referencias:** N-08, RF-07.

### E6-H03 · Cancelación con reembolso — `Must` · 1.0 h (+ `Should` 0.25 h)
**Alcance:** Cliente `POST /pedidos/:id/cancelar`; Operador lo mismo desde gestión. `SP_Pedidos_Cancelar` (estado, reingreso al kardex, uso de cupón revertido, `Reembolso` pendiente por el total) y llamada a la pasarela después del commit. Admin `GET /admin/reembolsos?estado=` y `POST /admin/reembolsos/:id/reintentar`.
*Should:* job de reintento cada 5 minutos con `sp_getapplock`, hasta 5 intentos y luego `Fallido`.
**CA**
- [ ] Solo se puede cancelar desde `Pagado` o `EnPreparacion` (`409 NO_CANCELABLE` en otro caso); el motivo es obligatorio.
- [ ] Cancelar reintegra la existencia con `ReingresoCancelacion` y se refleja en los reportes (criterio de RF-07).
- [ ] Si la pasarela falla al reembolsar, la cancelación se mantiene y el reembolso queda `Pendiente`.
- [ ] Repetir la cancelación no genera un segundo reembolso.

**Referencias:** N-09, N-03, A-04.

### E6-H04 · Devoluciones — `Must` · 0.5 h
**Alcance:** `POST /admin/pedidos/:id/devoluciones {motivo, lineas:[{idDetallePedido, cantidad}]}`; `SP_Pedidos_RegistrarDevolucion`.
**CA**
- [ ] No se puede devolver más de lo vendido por línea, ni siquiera con dos devoluciones simultáneas (`422 DEVOLUCION_EXCEDE_VENDIDO`; criterio de RF-07).
- [ ] Solo para pedidos `Entregado` o `DevueltoParcial` y dentro de 30 días (`422 PLAZO_DEVOLUCION_VENCIDO`).
- [ ] El estado pasa a `DevueltoParcial` o `Devuelto` según corresponda; el producto reingresa con `ReingresoDevolucion`.
- [ ] El reembolso es proporcional (precio pagado menos descuento repartido) y la suma de reembolsos nunca supera el total.
- [ ] `FechaLocal` de la devolución es el día de Guatemala (UTC−6): una devolución a las 05:59 UTC queda en el día anterior y una a las 06:00 UTC en el mismo día (N-11, M-03).

**Referencias:** N-10, RF-07, A-13.

---

## E7 · Reportes, bitácora y datos demo

### E7-H01 · Dashboard — `Must` · 1.0 h
**Alcance:** `VW_Dashboard_HechosVenta` (definición única de venta, N-11), `VW_Dashboard_VentasPorCategoria`, `VW_Carrito_Abandonados` y los SPs `SP_Dashboard_Resumen`, `SP_Dashboard_VentasPorPeriodo` (día, semana, mes; en quetzales y en número de pedidos), `SP_Dashboard_VentasPorCategoria`, `SP_Dashboard_TopProductos` (top 10) y `SP_Dashboard_CarritosAbandonados`. Endpoints de `01-arquitectura.md` §5.2. Solo Admin.
**CA**
- [ ] Los reportes **excluyen cancelados y descuentan devoluciones** en la fecha en que ocurren (criterio de RF-08 y N-11).
- [ ] Las fechas se agrupan por día de Guatemala (`FechaPagoLocal`).
- [ ] Cada reporte responde en menos de 1 s con la semilla.

**Referencias:** RF-08, N-11, N-13, M-07.

### E7-H02 · Consulta de la bitácora — `Must` · 0.25 h
**Alcance:** `GET /bitacora?modulo=&entidad=&desde=&hasta=&pagina=&tamano=`; solo Admin.
**CA**
- [ ] Filtra por módulo y pagina en el servidor (criterio de RF-09).

**Referencias:** RF-09.

### E7-H03 · Generador de datos demo — `Should` · 1.25 h
**Alcance:** `SP_Semilla_GenerarDatosDemo(@Pedidos, @Dias, @Semilla)` y `S005__datos_demo.sql` (1,500 pedidos en 90 días, ~200 clientes, carritos abandonados, cancelaciones, devoluciones y los cupones de ejemplo de `02-modelo-datos.md` §7). Fechas **relativas a hoy**.
**CA**
- [ ] El dashboard muestra datos de los últimos 90 días desde el primer arranque.
- [ ] Al terminar, `VW_Inventario_Conciliacion` está vacía y todos los pedidos cumplen sus `CHECK`.
- [ ] Existe un cupón para demostrar cada mensaje de rechazo de RF-05.

**Referencias:** RNF-1, M-08.

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

## 4. Semana 2 (Fase 2: frontend y proyecto completo) — vista general

Se detalla en historias al cerrar la Fase 1.

| Épica | Contenido |
|---|---|
| F1 Base del frontend | Vite + React + TS, rutas protegidas y menús por rol, renovación transparente del token, cliente HTTP con manejo de errores, componentes reutilizables (tabla paginada del servidor, formularios, estados de carga, vacío y error) |
| F2 Tienda | Catálogo con búsqueda y filtros, detalle, carrito con avisos, checkout, pago, mis pedidos |
| F3 Backoffice | Catálogo, precios, inventario y kardex, pedidos y devoluciones, cupones, usuarios, bitácora, configuración |
| F4 Dashboard | Gráficas de ventas, categorías, top 10 y carritos abandonados |
| F5 Extras y calidad | Caché de reportes en Redis, exportación a Excel, observabilidad con Grafana LGTM, script de carga pesada, job de conciliación de pagos y lo recortado de la Fase 1 |
| F6 Cierre y defensa | README final, ensayo de la demo (incluida la tolerancia a fallas) y preparación de preguntas de defensa |

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
| E4-H01 | Carrito de invitado y de cliente | Must | 0.75 | En revisión |
| E4-H02 | Garantía de precio de 3 días | Must | 0.5 | En revisión |
| E4-H03 | Fusión del carrito al iniciar sesión o registrarse | Must | 0.25 | En revisión |
| E4-H04 | Cupones (administración) | Must | 0.25 | En revisión |
| E4-H05 | Aplicar cupón en el carrito | Must | 0.5 | En revisión |
| E4-H06 | Envíos y parámetros | Should | 0.25 | En revisión |
| E5-H01 | Iniciar la sesión de pago | Must | 1.0 | Propuesta |
| E5-H02 | Pasarela de pago simulada | Must | 0.5 | Propuesta |
| E5-H03 | Confirmar el pago y crear el pedido | Must | 1.25 | Propuesta |
| E5-H04 | Planificador de tareas y expiración de sesiones | Must | 0.5 | Propuesta |
| E5-H05 | Test de concurrencia | Must | 0.75 | Propuesta |
| E6-H01 | Consulta de pedidos | Must | 0.5 | Propuesta |
| E6-H02 | Cambios de estado | Must | 0.75 | Propuesta |
| E6-H03 | Cancelación con reembolso | Must | 1.0 | Propuesta |
| E6-H04 | Devoluciones | Must | 0.5 | Propuesta |
| E7-H01 | Dashboard | Must | 1.0 | Propuesta |
| E7-H02 | Consulta de la bitácora | Must | 0.25 | Propuesta |
| E7-H03 | Generador de datos demo | Should | 1.25 | Propuesta |
| E8-H01 | README de la Fase 1 | Must | 0.75 | Propuesta |
| E8-H02 | Revisión contra penalizaciones | Must | 0.5 | Propuesta |
| E8-H03 | Ensayo en máquina limpia | Must | 0.25 | Propuesta |
