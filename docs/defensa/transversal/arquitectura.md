# Arquitectura

## Qué decide

ShopCart es un **monolito modular** (A-01): una sola API Express 5 con 15 módulos de dominio en `apps/api/src/modules/`, desplegada en dos réplicas (`api-1`, `api-2`) detrás de nginx. Cada módulo tiene sus capas `routes → controller → service → repository`, y solo se comunica con otro a través de su `index.ts`. Todo lo externo (pasarela, Redis, reloj, disco) entra por un **puerto** y se compone en `server.ts`/`app.ts`. Las reglas que se pueden romper con dos peticiones simultáneas viven en la base (SP o constraint); el servicio orquesta y habla con lo que está fuera de la base (A-02). La API no guarda estado compartido en memoria (RNF-2).

## Monolito modular y fronteras (A-01)

- Un módulo por dominio: `auth`, `bitacora`, `carrito`, `catalogo`, `checkout`, `configuracion`, `cupones`, `direcciones`, `envios`, `exportaciones`, `inventario`, `pedidos`, `reportes`, `sistema`, `usuarios`.
- La frontera entre módulos la impone ESLint con `eslint-plugin-boundaries`: un módulo solo puede importar el `index.ts` de otro. [eslint.config.mjs:43](../../../eslint.config.mjs#L43 "A-01: un módulo solo puede usar a otro a través de su index.ts") y el mensaje del error en [eslint.config.mjs:88](../../../eslint.config.mjs#L88 "A-01: un módulo solo importa el index.ts de otro módulo").
- La regla está probada con el lint real sobre un módulo temporal: importar el repositorio de otro módulo falla ([fronteras.test.ts:61](../../../apps/api/test/unit/fronteras.test.ts#L61 "importar el repositorio de otro módulo hace fallar el lint")) e importar su `index.ts` pasa ([fronteras.test.ts:69](../../../apps/api/test/unit/fronteras.test.ts#L69 "importar el index.ts de otro módulo está permitido")).
- **El orden de capas dentro de un módulo** también lo verifica el lint (decisión del PO en E9), con la misma herramienta: cada archivo se clasifica por su sufijo y el controlador no importa el repositorio, el servicio no importa Express, las rutas ni el controlador, y el repositorio no importa el servicio ([eslint.config.mjs:94](../../../eslint.config.mjs#L94 "A-01 (capas): el controlador llama al servicio, nunca al repositorio.")). La regla revisa también las dependencias internas de un módulo y las externas ([eslint.config.mjs:73](../../../eslint.config.mjs#L73 "checkInternals: true")); cada import prohibido tiene su prueba ([fronteras.test.ts:101](../../../apps/api/test/unit/fronteras.test.ts#L101 "%s: el lint falla")).
- Por qué monolito y no microservicios: el pago (RF-06) crea el pedido, descuenta inventario y confirma el cupón en **una** transacción de SQL Server; repartirlo entre servicios obligaría a sagas.

## Capas, de punta a punta (ejemplo: direcciones)

| Capa | Responsabilidad | Dónde se ve |
| --- | --- | --- |
| `index.ts` | Composición del módulo: crea el servicio con su repositorio y el router con su controlador | [index.ts:13](../../../apps/api/src/modules/direcciones/index.ts#L13 "crearDireccionesService({ repositorio: direccionesRepository })") |
| `routes` | HTTP: ruta, autenticación, rol y documentación OpenAPI | [direcciones.routes.ts:101](../../../apps/api/src/modules/direcciones/direcciones.routes.ts#L101 "const soloCliente = [autenticar, autorizar('Cliente')]") |
| `controller` | Traduce HTTP ↔ caso de uso, sin reglas: valida con `manejar` y llama al servicio | [direcciones.controller.ts:30](../../../apps/api/src/modules/direcciones/direcciones.controller.ts#L30 "obtener: manejar({ params: paramsIdDireccionSchema }") |
| `service` | Caso de uso: decide el flujo y traduce "no hay fila" en `404` | [direcciones.service.ts:13](../../../apps/api/src/modules/direcciones/direcciones.service.ts#L13 "RF-01: una dirección ajena responde igual que una inexistente") |
| `repository` | Solo llama SPs con `ejecutarSP` y tipos SQL explícitos; nunca recibe el ID del cliente | [direcciones.repository.ts:70](../../../apps/api/src/modules/direcciones/direcciones.repository.ts#L70 "RF-01: el dueño sale siempre de @IDUsuarioActor") |

El repositorio es un objeto simple (`direccionesRepository`) y el servicio una fábrica que lo recibe por parámetro: en las pruebas unitarias se sustituye por un falso sin tocar el servicio.

## Puertos y adaptadores

Cada dependencia externa es una interfaz pequeña en `shared/` y un adaptador en `shared/adapters/`. Los servicios dependen de la interfaz; `server.ts` crea los adaptadores reales y los pasa a `crearApp` ([app.ts:82](../../../apps/api/src/app.ts#L82 "export function crearApp({")).

| Puerto | Interfaz | Adaptador real (compuesto en `server.ts`) |
| --- | --- | --- |
| Pasarela de pago (N-03) | [index.ts:72](../../../apps/api/src/shared/pasarela/index.ts#L72 "export interface PasarelaPago") | [server.ts:59](../../../apps/api/src/server.ts#L59 "conTrazas(crearPasarelaSimulada())") |
| Caché de reportes (A-11) | [index.ts:5](../../../apps/api/src/shared/cache/index.ts#L5 "export interface Cache") | [server.ts:60](../../../apps/api/src/server.ts#L60 "crearCacheRedis(redis, logger)") |
| Versión de sesión (A-07) | [autenticar.ts:10](../../../apps/api/src/shared/http/autenticar.ts#L10 "export interface VersionesSesion") | [server.ts:97](../../../apps/api/src/server.ts#L97 "crearVersionesSesionRedis(redis, logger)") |
| Rate limiting (A-07) | [limitar-intentos.ts:5](../../../apps/api/src/shared/http/limitar-intentos.ts#L5 "export interface LimitadorIntentos") | [server.ts:79](../../../apps/api/src/server.ts#L79 "crearLimitadorRedis(redis, logger, { prefijo: 'limite:login'") |
| Almacén de exportaciones (A-24) | [index.ts:8](../../../apps/api/src/shared/almacen/index.ts#L8 "export interface AlmacenArchivos") | [server.ts:69](../../../apps/api/src/server.ts#L69 "crearAlmacenEnDisco(config.directorioAlmacen)") |
| Avisos entre réplicas (A-25) | [index.ts:17](../../../apps/api/src/shared/avisos/index.ts#L17 "export interface AvisosDeVersion") | [server.ts:62](../../../apps/api/src/server.ts#L62 "crearAvisosRedis(redis") |
| Reloj | [index.ts:2](../../../apps/api/src/shared/reloj/index.ts#L2 "export interface Reloj") | por defecto el del sistema: [app.ts:96](../../../apps/api/src/app.ts#L96 "reloj = relojDelSistema") |
| SQL Server | [ejecutar-sp.ts:25](../../../apps/api/src/shared/db/ejecutar-sp.ts#L25 "export interface ConexionSP") | [server.ts:56](../../../apps/api/src/server.ts#L56 "configurarBaseDatos(conexionMssql(pool), logger)") |

- Ejemplo de inyección en un módulo: el servicio de pago recibe la pasarela, el repositorio y el invalidador de reportes ([index.ts:35](../../../apps/api/src/modules/checkout/index.ts#L35 "crearPagoService({")).
- Las tareas periódicas solo las arranca `server.ts`; las pruebas usan `crearApp` sin ellas ([server.ts:120](../../../apps/api/src/server.ts#L120 "A-04: solo el servidor arranca las tareas periódicas")).

## Validación de entrada: `manejar` (A-20)

- Todo handler se declara con `manejar(esquemas, handler)`: valida `params`, `query`, `body`, `cookies` y encabezados con Zod y entrega al handler los valores ya transformados y tipados ([manejar.ts:44](../../../apps/api/src/shared/http/manejar.ts#L44 "A-20: valida la entrada con Zod")).
- Si algo falla, responde `400 VALIDACION_FALLIDA` con todos los campos a la vez ([manejar.ts:67](../../../apps/api/src/shared/http/manejar.ts#L67 "new AppError('VALIDACION_FALLIDA', { detalles: { errores } })")).
- No modifica `req` (en Express 5 `req.query` es de solo lectura).
- Los cuerpos son `.strict()`: un `idUsuario` colado en el body se rechaza ([manejar.test.ts:93](../../../apps/api/test/unit/shared/http/manejar.test.ts#L93 "RF-01: un campo extra en el body")).
- Los mismos esquemas generan el OpenAPI de `/api/docs` ([app.ts:177](../../../apps/api/src/app.ts#L177 "generarDocumentoOpenApi()")).

## Errores: catálogo central (A-06)

Recorrido de un error de negocio:

1. El SP lanza `THROW 50301, ...` ([R__SP_Inventario_ReservarExistencia.sql:52](../../../database/programmability/R__SP_Inventario_ReservarExistencia.sql#L52 "THROW 50301, @Error, 1;")).
2. `ejecutarSP` lo pasa por `traducirErrorSql` ([ejecutar-sp.ts:75](../../../apps/api/src/shared/db/ejecutar-sp.ts#L75 "throw traducirErrorSql(error) ?? error")). Solo el rango 50000–59999 es de negocio ([traducir-sql.ts:5](../../../apps/api/src/shared/errors/traducir-sql.ts#L5 "RANGO_NEGOCIO = { desde: 50000, hasta: 59999 }")).
3. El número se busca en el catálogo, que fija el código estable y el HTTP ([catalogo.ts:9](../../../apps/api/src/shared/errors/catalogo.ts#L9 "A-06: código estable → HTTP"); por ejemplo [catalogo.ts:118](../../../apps/api/src/shared/errors/catalogo.ts#L118 "STOCK_INSUFICIENTE: { http: 409, numeroSql: 50301")).
4. Un número sin catalogar no muestra el texto del SP: se vuelve `ERROR_INTERNO` ([traducir-sql.ts:24](../../../apps/api/src/shared/errors/traducir-sql.ts#L24 "codigoPorNumeroSql(numero)") y la prueba [traducir-sql.test.ts:45](../../../apps/api/test/unit/shared/errors/traducir-sql.test.ts#L45 "un número de negocio fuera del catálogo se trata como error interno")).
5. El middleware central responde siempre `{ error: { codigo, mensaje, detalles?, requestId } }` ([middleware.ts:31](../../../apps/api/src/shared/errors/middleware.ts#L31 "Middleware central (A-06)")). Lo inesperado responde `500 ERROR_INTERNO` sin detalle; el detalle va solo al log ([middleware.ts:54](../../../apps/api/src/shared/errors/middleware.ts#L54 "logger.error({ err: appError.cause ?? original }")).

Los errores que nacen en la API (por ejemplo `VALIDACION_FALLIDA`) están en el mismo catálogo sin `numeroSql`. Las pruebas: [middleware.test.ts:95](../../../apps/api/test/unit/shared/errors/middleware.test.ts#L95 "un error inesperado responde 500 ERROR_INTERNO sin detalles internos") y [middleware.test.ts:224](../../../apps/api/test/unit/shared/errors/middleware.test.ts#L224 "development y production responden exactamente lo mismo").

## Dinero (A-21)

| Paso | Qué pasa | Dónde |
| --- | --- | --- |
| Entrada JSON | El monto llega como texto con hasta 10 enteros y 2 decimales | [monto.ts:4](../../../packages/shared/src/monto.ts#L4 "export const montoSchema = z") |
| Zod → servicio | Se transforma en `Decimal` | [catalogo.schemas.ts:175](../../../apps/api/src/modules/catalogo/catalogo.schemas.ts#L175 ".transform((precio) => new Decimal(precio))") |
| Servicio → SP | `ejecutarSP` convierte el `Decimal` a número solo en el borde | [ejecutar-sp.ts:93](../../../apps/api/src/shared/db/ejecutar-sp.ts#L93 "valor instanceof Decimal ? montoParaSql(valor) : valor") |
| SP → repositorio | El driver entrega `DECIMAL` como `number`; se convierte una sola vez con `aMonto` | [index.ts:12](../../../apps/api/src/shared/dinero/index.ts#L12 "export function aMonto(valor: number): Decimal") y [checkout.repository.ts:83](../../../apps/api/src/modules/checkout/checkout.repository.ts#L83 "total: aMonto(fila.Total)") |
| Salida JSON | Texto con dos decimales (`"149.90"`) | [index.ts:32](../../../apps/api/src/shared/dinero/index.ts#L32 "export function montoATexto(monto: Decimal): string") |

- Salvaguarda: desde `1e13` ya no hay garantía de exactitud en un double y se falla en lugar de redondear ([index.ts:6](../../../apps/api/src/shared/dinero/index.ts#L6 "const LIMITE = new Decimal('1e13')")).
- En la base: `DECIMAL(12,2)` en columnas y parámetros; la prueba de penalizaciones prohíbe `FLOAT`, `REAL` y `MONEY` (ver [base-de-datos.md](base-de-datos.md)).

## API stateless (RNF-2)

- **Contexto por petición, no global:** usuario, rol y `requestId` viven en un `AsyncLocalStorage` que muere con la petición ([contexto.ts:13](../../../apps/api/src/shared/http/contexto.ts#L13 "new AsyncLocalStorage")).
- **Redis solo guarda lo que se puede perder:** la caché nunca lanza ([index.ts:2](../../../apps/api/src/shared/cache/index.ts#L2 "Redis solo guarda lo que se puede perder (RNF-2)")); la versión de sesión real está en `Usuario.VersionSesion` ([versiones-sesion-redis.ts:25](../../../apps/api/src/shared/adapters/versiones-sesion-redis.ts#L25 "Redis solo guarda lo que se puede perder (RNF-2)")); el rate limiting cae a un contador en memoria de la réplica ([limitador-redis.ts:60](../../../apps/api/src/shared/adapters/limitador-redis.ts#L60 "return consumirEn(enMemoria, clave)")).
- **Lo crítico vive en SQL Server:** idempotencia de pagos, reservas, arrendamientos y hasta el estado de la pasarela simulada ([V012__pasarela_simulada.sql:3](../../../database/migrations/V012__pasarela_simulada.sql#L3 "aunque el reintento caiga en la otra réplica (sin Redis, RNF-2)")).
- **Archivos compartidos:** las exportaciones van a un volumen montado en las dos réplicas ([docker-compose.yml:55](../../../docker-compose.yml#L55 "exportaciones:/var/lib/shopcart/exportaciones")).
- **Estado por réplica que sí existe (y es aceptable):** los streams SSE abiertos del dashboard y el contador de rate limiting en memoria cuando Redis cae. Ninguno es crítico: el cliente SSE reconecta a la otra réplica y el rate limiting vuelve a Redis cuando responde.
- **Pruebas en el entorno real:** con `api-1` detenida todas las peticiones responden desde `api-2` ([rnf2.test.ts:40](../../../apps/api/test/entorno/rnf2.test.ts#L40 "peticiones seguidas a través de nginx responden 200 desde api-2")), y con Redis detenido un checkout vende la última unidad una sola vez ([rnf2.test.ts:68](../../../apps/api/test/entorno/rnf2.test.ts#L68 "con Redis detenido, un checkout completo vende la última unidad una sola vez")).

## Dónde vive cada regla (A-02)

Criterio: si la regla se rompe con dos peticiones simultáneas o con una escritura directa a la base, va en el SP o en un constraint; si depende de algo fuera de la base o decide el flujo, va en el servicio.

| Regla | Dónde vive | Archivo:línea | Decisión |
| --- | --- | --- | --- |
| No vender más de lo disponible | `SP_Inventario_ReservarExistencia` bajo `UPDLOCK` | [R__SP_Inventario_ReservarExistencia.sql:39](../../../database/programmability/R__SP_Inventario_ReservarExistencia.sql#L39 "CROSS APPLY dbo.FU_Inventario_Disponible(p.IDVariante)") | N-06, A-02 |
| Existencia nunca negativa | constraint `CK_Variante_ExistenciaNoNegativa` | [V004__catalogo.sql:88](../../../database/migrations/V004__catalogo.sql#L88 "CK_Variante_ExistenciaNoNegativa CHECK (ExistenciaFisica >= 0)") | A-13 |
| Límite total de usos del cupón | `SP_Cupones_ReservarUso` + `CK_Cupon_UsosComprometidos` | [R__SP_Cupones_ReservarUso.sql:39](../../../database/programmability/R__SP_Cupones_ReservarUso.sql#L39 "UsosComprometidos < LimiteUsosTotal") | N-12, A-13 |
| Transiciones de estado del pedido | `SP_Pedidos_CambiarEstado` + trigger `TR_Pedidos_ValidarTransicion` | [R__TR_Pedidos_ValidarTransicion.sql:5](../../../database/programmability/R__TR_Pedidos_ValidarTransicion.sql#L5 "CREATE OR ALTER TRIGGER dbo.TR_Pedidos_ValidarTransicion") | N-08 |
| Un pago por llave | constraint `UQ_IntentoPago_LlaveIdempotencia` | [V007__checkout.sql:97](../../../database/migrations/V007__checkout.sql#L97 "UQ_IntentoPago_LlaveIdempotencia UNIQUE (LlaveIdempotencia)") | N-03 |
| Llamar a la pasarela fuera de toda transacción | servicio `checkout.pago` | [checkout.pago.ts:51](../../../apps/api/src/modules/checkout/checkout.pago.ts#L51 "Ninguna llamada a") | N-03, A-02 |
| Tarjeta no vencida (depende del reloj) | Zod con el puerto `Reloj` | [checkout.schemas.ts:69](../../../apps/api/src/modules/checkout/checkout.schemas.ts#L69 "export const pagarVigenteSchema = (reloj: Reloj)") | A-20 |
| Rate limiting del login | middleware con Redis | [auth.routes.ts:78](../../../apps/api/src/modules/auth/auth.routes.ts#L78 "limitarIntentos(limitadores.login, porIpYCorreo)") | A-07 |
| Token revocado por versión de sesión | middleware `autenticar` con Redis | [autenticar.ts:47](../../../apps/api/src/shared/http/autenticar.ts#L47 "await sesionRevocada(actor, versiones)") | A-07 |

El servicio puede prevalidar para dar un mensaje claro, pero el SP vuelve a validar bajo bloqueo y es la autoridad.

## Alternativas descartadas

- **Microservicios** → el pago necesita una transacción que cruza pedidos, inventario y cupones (A-01).
- **Toda la lógica en servicios** → no resiste concurrencia entre réplicas; **toda en SPs** → contradice el enunciado ("servicios con la lógica de negocio"). Se reparte con el criterio de A-02.
- **Códigos de retorno o `RAISERROR`** → menos claros y fáciles de ignorar; se usa `THROW` por rango con catálogo (A-06).
- **class-validator u OpenAPI escrito a mano** → duplica tipos o se desalinea; Zod genera ambos (A-08).
- **Middleware que reescribe `req.body`/`req.query`** → `req.query` es de solo lectura en Express 5 (A-20).
- **Operar con `number`** → pierde centavos; **convertir a texto en cada SP** → más código en la base (A-21).
- **Un "RedisService" que lo haga todo** → se separó en puertos pequeños (`Cache`, `VersionesSesion`, `LimitadorIntentos`, `AvisosDeVersion`).

## Preguntas probables

### ¿Cómo garantizan que un módulo no use los internos de otro?

Con `eslint-plugin-boundaries`: importar un archivo de otro módulo que no sea su `index.ts` es un error de lint, y una prueba lo comprueba con el lint real.
**Muéstralo en:** [fronteras.test.ts:61](../../../apps/api/test/unit/fronteras.test.ts#L61 "importar el repositorio de otro módulo hace fallar el lint")

### ¿Y el orden routes → controller → service → repository dentro del módulo?

Lo verifica el lint: el controlador no importa el repositorio; el servicio no importa Express, las rutas ni el controlador; el repositorio no importa el servicio. Un import prohibido hace fallar `pnpm lint`, y la prueba lo demuestra con un módulo temporal.
**Muéstralo en:** [eslint.config.mjs:94](../../../eslint.config.mjs#L94 "A-01 (capas): el controlador llama al servicio, nunca al repositorio.") y [fronteras.test.ts:101](../../../apps/api/test/unit/fronteras.test.ts#L101 "%s: el lint falla")

### ¿Dónde se arma todo?

`server.ts` crea el pool, Redis y los adaptadores, y los pasa a `crearApp`, que monta middlewares y módulos. Las pruebas llaman a `crearApp` con falsos.
**Muéstralo en:** [server.ts:72](../../../apps/api/src/server.ts#L72 "const app = crearApp({")

### Si mañana cambian la pasarela simulada por una real, ¿qué tocan?

Un adaptador nuevo que cumpla `PasarelaPago` y una línea en `server.ts`. El servicio de pago no cambia.
**Muéstralo en:** [index.ts:72](../../../apps/api/src/shared/pasarela/index.ts#L72 "export interface PasarelaPago")

### ¿El controlador tiene lógica de negocio?

No: valida con `manejar`, llama al servicio y responde. El 404 de un recurso ajeno lo decide el servicio a partir de lo que devuelve el SP.
**Muéstralo en:** [direcciones.controller.ts:30](../../../apps/api/src/modules/direcciones/direcciones.controller.ts#L30 "obtener: manejar({ params: paramsIdDireccionSchema }")

### ¿Cómo llega un error del SP al cliente con el HTTP correcto?

`THROW 5xxxx` → `ejecutarSP` → `traducirErrorSql` busca el número en el catálogo → `AppError` → middleware central.
**Muéstralo en:** [traducir-sql.ts:20](../../../apps/api/src/shared/errors/traducir-sql.ts#L20 "export function traducirErrorSql(error: unknown)")

### ¿Qué pasa si un SP lanza un número que no está en el catálogo?

Se trata como `500 ERROR_INTERNO`: el cliente no ve el texto del SP y el log registra la causa.
**Muéstralo en:** [traducir-sql.test.ts:45](../../../apps/api/test/unit/shared/errors/traducir-sql.test.ts#L45 "un número de negocio fuera del catálogo se trata como error interno")

### ¿Por qué `decimal.js` y montos como texto en JSON?

Un `number` de JavaScript no representa exactamente 0.1; el monto se opera siempre como `Decimal` y se convierte solo en los bordes (SP y JSON).
**Muéstralo en:** [index.ts:20](../../../apps/api/src/shared/dinero/index.ts#L20 "export function montoParaSql(monto: Decimal): number")

### ¿La API es realmente stateless? ¿Qué se pierde si cae una réplica?

Nada crítico: lo que importa está en SQL Server. Se pierden los streams SSE de esa réplica (el cliente reconecta a la otra). La prueba de entorno detiene `api-1` y todo responde desde `api-2`.
**Muéstralo en:** [rnf2.test.ts:40](../../../apps/api/test/entorno/rnf2.test.ts#L40 "peticiones seguidas a través de nginx responden 200 desde api-2")

### ¿Y si cae Redis?

La API sigue: la caché responde como vacía, la versión de sesión cae a la ventana del access token y el rate limiting a un contador por réplica. El checkout no usa Redis.
**Muéstralo en:** [rnf2.test.ts:68](../../../apps/api/test/entorno/rnf2.test.ts#L68 "con Redis detenido, un checkout completo vende la última unidad una sola vez")

### ¿Por qué el stock se valida en el SP y no en el servicio?

Porque dos réplicas pueden validar a la vez y ambas ver existencia. En el SP la variante está bloqueada con `UPDLOCK` y el disponible no cambia hasta el `COMMIT`.
**Muéstralo en:** [R__SP_Inventario_ReservarExistencia.sql:34](../../../database/programmability/R__SP_Inventario_ReservarExistencia.sql#L34 "WITH (UPDLOCK, ROWLOCK)")

### ¿Cómo se enteran los SPs de quién hace la petición si nadie pasa el usuario?

`requestId` abre un `AsyncLocalStorage` por petición, `autenticar` deja ahí al usuario y `ejecutarSP` lo agrega como `@IDUsuarioActor`.
**Muéstralo en:** [request-id.ts:17](../../../apps/api/src/shared/http/request-id.ts#L17 "ejecutarConContexto({ requestId: id, idUsuario: null, rol: null }, next)")
