# Pruebas

## Qué decide

Las reglas críticas viven en los SPs y en los constraints (A-02), así que se prueban contra un SQL Server real y no con la base simulada (A-17). La pirámide tiene cinco pisos: unitarias con puertos falsos, integración contra `shopcart_test` (recreada en cada corrida, con la API completa vía supertest), concurrencia RNF-3 a través de nginx, verificación del entorno de Docker y telemetría con un receptor OTLP en memoria. Ninguna prueba contiene SQL: los datos se preparan con SPs de prueba que solo existen en `shopcart_test`. Una prueba de penalizaciones revisa además los scripts y el código TypeScript contra el enunciado.

## La pirámide real

Conteos hechos sobre el repositorio: archivos `*.test.ts` y declaraciones `it(` / `it.each(` (un `it.each` se expande en varios casos al correr). Las cifras de casos ejecutados salen de correr cada suite en un clon nuevo con `core.autocrlf=true` sobre `f870306` (2 nov 2026), todas en verde.

| Piso | Carpeta | Archivos | Declaraciones `it` (de ellas `it.each`) | Casos al correr | Contra qué corre |
|---|---|---|---|---|---|
| Unitarias de la API | `apps/api/test/unit` | 58 | 454 (34) | 556 | Nada externo: puertos falsos y `vi.fn` |
| Unitarias del migrador | `database/migrator/test/*.test.ts` | 7 | 97 (10) | 259 | Archivos del repositorio |
| Integración de la API | `apps/api/test/integracion` | 65 (44 `*.api.test.ts` con supertest) | 662 (42) | 785 | `shopcart_test` + Redis base 1 |
| Integración del migrador | `database/migrator/test/integracion` | 2 | 11 | 11 | SQL Server real, `shopcart_test` |
| Telemetría | `apps/api/test/telemetria` | 1 | 5 | 5 | API compilada + receptor OTLP en memoria |
| Concurrencia (RNF-3) | `apps/api/test/concurrencia` | 1 | 2 | 2 | nginx en `http://localhost:8080` |
| Entorno | `apps/api/test/entorno` | 6 | 19 (4) | 28: 26 sin el perfil de observabilidad (2 omitidas) y 27 con él (1 omitida) | Docker Compose levantado |
| Humo de la imagen | `apps/api/test/humo` | 1 | 2 | 2 | La imagen `shopcart-api:local` |

Los SPs de prueba son 88 `R__SP_Pruebas_*` y 3 triggers `R__TR_Pruebas_*` en [database/test](../../../database/test).

## Scripts

| Comando | Qué corre | Dónde |
|---|---|---|
| `pnpm lint` | ESLint (incluidas las fronteras entre módulos) y Prettier | [package.json:11](../../../package.json#L11 "eslint . && prettier --check .") |
| `pnpm typecheck` | `tsc --noEmit` en cada paquete | [package.json:13](../../../package.json#L13 "pnpm -r --if-present typecheck") |
| `pnpm test` | Unitarias del migrador, del contrato, de la API y de la web, un paquete a la vez (en paralelo, dos Vitest con un worker por núcleo cada uno agotaban pruebas por falta de CPU) | [package.json:14](../../../package.json#L14 "pnpm -r --workspace-concurrency=1 --if-present test") |
| `pnpm test:integracion` | Integración del migrador, luego recrea y migra `shopcart_test`, luego integración de la API | [package.json:18](../../../package.json#L18 "migrar:pruebas") |
| `pnpm test:concurrencia` | RNF-3 contra el entorno levantado | [package.json:20](../../../package.json#L20 "test:concurrencia") |
| `pnpm test:entorno` | Verificación de entrega contra Docker | [package.json:21](../../../package.json#L21 "test:entorno") |
| `pnpm test:humo` | Construye la imagen y prueba lo que lleva | [package.json:22](../../../package.json#L22 "docker compose build api-1") |
| `pnpm test:cobertura` | Migra `shopcart_test` y corre unitarias e integración en una sola corrida con cobertura v8: un solo reporte | [package.json:19](../../../package.json#L19 "test:cobertura") |

## Unitarias: servicios con puertos falsos

- El servicio recibe sus dependencias por parámetro (D de SOLID); la prueba pasa objetos con `vi.fn`. Ejemplo: el pago recibe repositorio, pedidos y pasarela falsos en [checkout.pago.test.ts:66](../../../apps/api/test/unit/modules/checkout/checkout.pago.test.ts#L66 "function preparar(") y la pasarela simulada en [checkout.pago.test.ts:82](../../../apps/api/test/unit/modules/checkout/checkout.pago.test.ts#L82 "const pasarela = {"). Un caso típico: [checkout.pago.test.ts:145](../../../apps/api/test/unit/modules/checkout/checkout.pago.test.ts#L145 "si la pasarela no responde, libera el arrendamiento").
- `dependenciasDePrueba` arma `crearApp` con falsos intercambiables (Liskov): versiones de sesión en memoria [app-de-prueba.ts:28](../../../apps/api/test/app-de-prueba.ts#L28 "export function versionesSesionEnMemoria"), una caché que se comporta como Redis caído [app-de-prueba.ts:43](../../../apps/api/test/app-de-prueba.ts#L43 "export const SIN_CACHE"), y cada prueba reemplaza solo lo que le importa [app-de-prueba.ts:51](../../../apps/api/test/app-de-prueba.ts#L51 "export function dependenciasDePrueba").
- Telemetría en memoria: `InMemorySpanExporter` e `InMemoryMetricExporter` en [telemetria-en-memoria.ts:21](../../../apps/api/test/unit/telemetria-en-memoria.ts#L21 "export function usarTelemetriaEnMemoria").
- Pruebas de arquitectura dentro de las unitarias: importar el repositorio de otro módulo rompe el lint [fronteras.test.ts:61](../../../apps/api/test/unit/fronteras.test.ts#L61 "importar el repositorio de otro módulo hace fallar el lint"); cada ruta está en el OpenAPI [openapi-rutas.test.ts:82](../../../apps/api/test/unit/openapi-rutas.test.ts#L82 "cada ruta de /api/v1 está en el documento"); ningún secreto real en `.env.example` [secretos.test.ts:15](../../../apps/api/test/unit/secretos.test.ts#L15 "todo secreto de .env.example está marcado como ejemplo"); el apagado con SIGTERM [apagado.test.ts:123](../../../apps/api/test/unit/apagado.test.ts#L123 "con SIGTERM termina las peticiones en curso").

## Integración: `shopcart_test` recreada en cada corrida

| Regla | Dónde vive | Archivo:línea |
|---|---|---|
| Las pruebas de integración siempre usan `shopcart_test` y la base 1 de Redis | config de Vitest | [vitest.integracion.config.ts:19](../../../apps/api/vitest.integracion.config.ts#L19 "DB_NOMBRE: 'shopcart_test'") |
| Si la configuración apunta a otra base, la prueba se niega a conectar | `conectarBaseDePruebas` | [base-de-pruebas.ts:14](../../../apps/api/test/integracion/base-de-pruebas.ts#L14 "config.baseDatos.nombre !== BASE_DE_PRUEBAS") |
| `--pruebas` fija la base `shopcart_test` y pide recrearla | migrador | [config.ts:72](../../../database/migrator/src/config.ts#L72 "modoPruebas ? BASE_PRUEBAS") |
| La recreación borra la base (los ledger no admiten `DELETE`, M-01) | script del migrador | [recrear-base.sql:6](../../../database/migrator/sql/recrear-base.sql#L6 "IF @Base <> N'shopcart_test'") |
| Los SPs de prueba solo se agregan cuando la base es `shopcart_test` | migrador | [scripts.ts:49](../../../database/migrator/src/scripts.ts#L49 "baseDatos === BASE_PRUEBAS") |
| Lo verifica una prueba: nunca entran a la base real | unitaria del migrador | [leer-scripts.test.ts:130](../../../database/migrator/test/leer-scripts.test.ts#L130 "nunca incluye database/test/") |
| Redis de pruebas en su propia base lógica, vaciada al arrancar | `globalSetup` | [redis-de-pruebas.ts:26](../../../apps/api/test/integracion/redis-de-pruebas.ts#L26 "await cliente.flushdb()") |

- **Sin SQL en las pruebas:** los datos se preparan llamando SPs de prueba con `ejecutarSP`, igual que el repositorio: [datos-de-prueba.ts:11](../../../apps/api/test/integracion/datos-de-prueba.ts#L11 "export async function unaFila"). La prueba de penalizaciones también recorre `apps/api/test` [penalizaciones.test.ts:18](../../../database/migrator/test/penalizaciones.test.ts#L18 "'apps/api/test'") y falla si encuentra una sentencia SQL [penalizaciones.test.ts:185](../../../database/migrator/test/penalizaciones.test.ts#L185 "ningún archivo TypeScript del backend contiene una sentencia SQL").
- **Actor de la petición:** `comoActor` ejecuta como un usuario y rol dados, el mismo `AsyncLocalStorage` que usa la API (A-18): [datos-de-prueba.ts:54](../../../apps/api/test/integracion/datos-de-prueba.ts#L54 "export function comoActor").
- **API completa con supertest:** cada `*.api.test.ts` monta `crearApp(dependenciasDePrueba())` contra `shopcart_test`: [pagar.api.test.ts:32](../../../apps/api/test/integracion/checkout/pagar.api.test.ts#L32 "const app = crearApp(dependenciasDePrueba());"). Para simular dos réplicas se crean dos apps: [pagar.api.test.ts:263](../../../apps/api/test/integracion/checkout/pagar.api.test.ts#L263 "instancia: 'api-1'").
- **Grupos:** las pruebas que cambian estado global de la base corren solas después del grupo paralelo [vitest.integracion.config.ts:35](../../../apps/api/vitest.integracion.config.ts#L35 "name: 'secuencial'").
- **Excepción deliberada:** algunos SPs de prueba escriben directo sobre un ledger o sobre `ExistenciaFisica` para demostrar que el motor lo rechaza (lo explica [database/test/README.md](../../../database/test/README.md)). Siguen la plantilla de SP: [convenciones-sql.test.ts:43](../../../database/migrator/test/convenciones-sql.test.ts#L43 "it.each(spsQueEscriben").

## Concurrencia RNF-3 a través de nginx

- Corre contra el entorno real (`SHOPCART_URL` o `http://localhost:8080`): [apoyo-concurrencia.ts:5](../../../apps/api/test/concurrencia/apoyo-concurrencia.ts#L5 "http://localhost:8080").
- Los 20 clientes compran en el mismo turno del event loop: [checkout.concurrencia.test.ts:40](../../../apps/api/test/concurrencia/checkout.concurrencia.test.ts#L40 "Promise.all(clientes.map").
- Escenario 1, última unidad: [checkout.concurrencia.test.ts:55](../../../apps/api/test/concurrencia/checkout.concurrencia.test.ts#L55 "20 clientes por la última unidad"). Exige 1 éxito, 19 × `409 STOCK_INSUFICIENTE`, existencia 0, conciliación del kardex vacía [checkout.concurrencia.test.ts:73](../../../apps/api/test/concurrencia/checkout.concurrencia.test.ts#L73 "conciliacionDeInventario()") y que atendieron las dos réplicas [checkout.concurrencia.test.ts:74](../../../apps/api/test/concurrencia/checkout.concurrencia.test.ts#L74 "new Set(['api-1', 'api-2'])").
- Escenario 2, último uso de un cupón: [checkout.concurrencia.test.ts:77](../../../apps/api/test/concurrencia/checkout.concurrencia.test.ts#L77 "20 clientes por el último uso de un cupón"), con `usosComprometidos: 1` al final.

## Entorno: lo que solo se ve con Docker

| Qué demuestra | Prueba |
|---|---|
| Helmet a través de nginx | [seguridad-http.test.ts:48](../../../apps/api/test/entorno/seguridad-http.test.ts#L48 "lleva los encabezados de helmet") |
| nginx sin versión, sin `X-Powered-By` | [seguridad-http.test.ts:61](../../../apps/api/test/entorno/seguridad-http.test.ts#L61 "no revela la tecnología") |
| CORS con lista explícita, nunca `*` | [seguridad-http.test.ts:82](../../../apps/api/test/entorno/seguridad-http.test.ts#L82 "nunca con *") |
| Un 500 real (SQL Server en pausa) no filtra stack | [seguridad-http.test.ts:113](../../../apps/api/test/entorno/seguridad-http.test.ts#L113 "un 500 real no trae stack ni detalles internos") |
| Contenedores sin root | [contenedores.test.ts:15](../../../apps/api/test/entorno/contenedores.test.ts#L15 "no corre como root") |
| RNF-2: con api-1 detenida todo lo atiende api-2 | [rnf2.test.ts:40](../../../apps/api/test/entorno/rnf2.test.ts#L40 "peticiones seguidas a través de nginx responden 200 desde api-2") |
| RNF-2: sin Redis se vende una sola vez y se cobra una sola vez | [rnf2.test.ts:68](../../../apps/api/test/entorno/rnf2.test.ts#L68 "con Redis detenido, un checkout completo vende la última unidad una sola vez") |
| Observabilidad sin y con el perfil | [observabilidad.test.ts:62](../../../apps/api/test/entorno/observabilidad.test.ts#L62 "sin el perfil, la API atiende") y [observabilidad.test.ts:95](../../../apps/api/test/entorno/observabilidad.test.ts#L95 "una compra es una traza en Tempo") |
| Tiempo real: sin buffering y entre réplicas | [tiempo-real.test.ts:59](../../../apps/api/test/entorno/tiempo-real.test.ts#L59 "el primer evento llega sin buffering") |
| Tiempo real: SIGTERM cierra el stream en menos de 10 s | [tiempo-real.test.ts:120](../../../apps/api/test/entorno/tiempo-real.test.ts#L120 "al detener la réplica (SIGTERM) su stream se cierra enseguida") |
| La imagen solo lleva JavaScript compilado | [imagen.test.ts:57](../../../apps/api/test/humo/imagen.test.ts#L57 "solo lleva JavaScript compilado") |

El detalle de cada escenario de falla está en [infraestructura.md](infraestructura.md).

## Telemetría: receptor OTLP en memoria

`seguridad-trazas.test.ts` compila la API y la arranca igual que la imagen [api-con-telemetria.ts:145](../../../apps/api/test/telemetria/api-con-telemetria.ts#L145 "'--import', './dist/telemetria.js', 'dist/server.js'"), exportando a un servidor HTTP propio de la prueba [api-con-telemetria.ts:56](../../../apps/api/test/telemetria/api-con-telemetria.ts#L56 "export async function receptorEnMemoria"). Recorre registro, login, refresh, carrito y un pago, y revisa todo lo exportado: [seguridad-trazas.test.ts:142](../../../apps/api/test/telemetria/seguridad-trazas.test.ts#L142 "ningún span ni log lleva contraseñas, tokens"). Está en el proyecto `telemetria` de la integración [vitest.integracion.config.ts:45](../../../apps/api/vitest.integracion.config.ts#L45 "name: 'telemetria'"). Detalle en [observabilidad.md](observabilidad.md).

## Migrador

- Idempotente: [migrador.test.ts:52](../../../database/migrator/test/integracion/migrador.test.ts#L52 "ejecutarlo dos veces seguidas no aplica nada la segunda vez").
- Un `V###` modificado hace fallar: [migrador.test.ts:62](../../../database/migrator/test/integracion/migrador.test.ts#L62 "modificar un V### ya aplicado").
- Dos migradores a la vez no duplican: [migrador.test.ts:83](../../../database/migrator/test/integracion/migrador.test.ts#L83 "dos migradores a la vez").
- `shopcart_app` no puede leer tablas: [migrador.test.ts:103](../../../database/migrator/test/integracion/migrador.test.ts#L103 "un SELECT directo a una tabla devuelve error de permisos").
- Penalizaciones sobre los scripts: tipos prohibidos [penalizaciones.test.ts:130](../../../database/migrator/test/penalizaciones.test.ts#L130 "ningún FLOAT, REAL, MONEY") y concatenación en SQL dinámico [penalizaciones.test.ts:146](../../../database/migrator/test/penalizaciones.test.ts#L146 "nunca concatena valores").

## Qué prueba demuestra cada requisito importante

| Requisito | Prueba | Tipo |
|---|---|---|
| RF-01 aislamiento | [aislamiento.api.test.ts:233](../../../apps/api/test/integracion/seguridad/aislamiento.api.test.ts#L233 "el recurso de otro cliente responde 404, igual que uno inexistente"), [aislamiento.api.test.ts:262](../../../apps/api/test/integracion/seguridad/aislamiento.api.test.ts#L262 "ninguna ruta de cliente acepta idUsuario") | integración |
| RF-03 kardex | [inventario.test.ts:44](../../../apps/api/test/integracion/esquema/inventario.test.ts#L44 "rechaza un saldo que no cuadra"), [registrar-movimiento.test.ts:113](../../../apps/api/test/integracion/inventario/registrar-movimiento.test.ts#L113 "nunca deja la existencia negativa") | integración |
| RF-06 todo o nada en la reserva | [reservar-existencia.test.ts:58](../../../apps/api/test/integracion/inventario/reservar-existencia.test.ts#L58 "todo o nada") | integración |
| RF-06 sin cobro doble | [pagar.api.test.ts:152](../../../apps/api/test/integracion/checkout/pagar.api.test.ts#L152 "doble clic con la misma llave") | integración |
| RF-06 timeout y reintento en otra réplica | [pagar.api.test.ts:262](../../../apps/api/test/integracion/checkout/pagar.api.test.ts#L262 "el reintento de 0119 en la otra réplica") | integración |
| RF-07 transiciones en tres capas | [estados.api.test.ts:114](../../../apps/api/test/integracion/pedidos/estados.api.test.ts#L114 "segunda capa (SP)"), [estados.api.test.ts:153](../../../apps/api/test/integracion/pedidos/estados.api.test.ts#L153 "tercera defensa (trigger)") | integración |
| N-08 mapa del servicio = tabla | [estados.api.test.ts:220](../../../apps/api/test/integracion/pedidos/estados.api.test.ts#L220 "cada (origen, destino, rol) del mapa está en la tabla") | integración |
| M-01 ledger append-only | [ledger.test.ts:19](../../../apps/api/test/integracion/esquema/ledger.test.ts#L19 "rechaza %s") | integración |
| RF-09 bitácora con actor | [bitacora.test.ts:119](../../../apps/api/test/integracion/esquema/bitacora.test.ts#L119 "una escritura auditada sin contexto falla con CONTEXTO_NO_ESTABLECIDO") | integración |
| A-18 contexto del actor | [ejecutar-sp.test.ts:51](../../../apps/api/test/integracion/shared/ejecutar-sp.test.ts#L51 "el SP recibe @IDUsuarioActor, @RolActor y @RequestId") | integración |
| A-21 montos exactos | [montos.test.ts:31](../../../apps/api/test/integracion/shared/montos.test.ts#L31 "DECIMAL(15,2) en el SP llega como 1.67") | integración |
| RNF-2 job con `sp_getapplock` | [tareas-periodicas.test.ts:192](../../../apps/api/test/integracion/secuencial/tareas-periodicas.test.ts#L192 "si la otra réplica tiene el bloqueo, retorna sin hacer nada") | integración |
| RNF-2 Redis caído | [limitador-redis.test.ts:50](../../../apps/api/test/integracion/adaptadores/limitador-redis.test.ts#L50 "con Redis caído cae al contador en memoria"), [versiones-sesion.test.ts:63](../../../apps/api/test/integracion/adaptadores/versiones-sesion.test.ts#L63 "con Redis caído deja pasar") y [rnf2.test.ts:68](../../../apps/api/test/entorno/rnf2.test.ts#L68 "con Redis detenido") | integración + entorno |
| RNF-3 | [checkout.concurrencia.test.ts:55](../../../apps/api/test/concurrencia/checkout.concurrencia.test.ts#L55 "escenario 1") y [checkout.concurrencia.test.ts:77](../../../apps/api/test/concurrencia/checkout.concurrencia.test.ts#L77 "escenario 2") | concurrencia |
| RNF-4 | [seguridad-trazas.test.ts:153](../../../apps/api/test/telemetria/seguridad-trazas.test.ts#L153 "todos sus spans llevan su requestId") | telemetría |

## Cobertura

`pnpm test:cobertura` corre las unitarias y las de integración en **una sola corrida** con `@vitest/coverage-v8` sobre `src/**/*.ts`: las unitarias son un proyecto más junto a los de integración, así sale un solo reporte sin fusionar nada ([vitest.cobertura.config.ts:11](../../../apps/api/vitest.cobertura.config.ts#L11 "projects: [{ extends: './vitest.config.ts'")). Verificación final del 2 de noviembre de 2026 (1,283 pruebas): **líneas 94.5 %, ramas 86.45 %, funciones 95.04 %, sentencias 93.22 %**; entre corridas varía una o dos líneas, porque un reintento depende del tiempo. Por módulo, las líneas van de 92 % (exportaciones) a 100 %; lo más bajo es el arranque (`server.ts`, `telemetria.ts`: 56 %), porque la prueba de telemetría levanta la API compilada en otro proceso, que v8 no mide. El detalle por módulo está en [docs/revision/estado-backend.md](../../revision/estado-backend.md) §1. No hay umbral mínimo configurado.

## Alternativas descartadas

- **Simular la base en las pruebas** → no prueba los SPs, que es donde están las reglas críticas (A-17).
- **Limpiar la base con `DELETE` entre corridas** → los ledger no lo admiten (M-01); se recrea la base completa ([recrear-base.sql:2](../../../database/migrator/sql/recrear-base.sql#L2 "no admiten DELETE ni TRUNCATE")).
- **Preparar datos con SQL en las pruebas** → viola la regla de cero SQL en `apps/` (incluidas las pruebas); se usan SPs `SP_Pruebas_*` que no llegan a la base real.
- **Probar RNF-3 en proceso** → no pasaría por nginx ni por dos procesos reales; el escenario corre contra Docker y verifica `X-Instancia`.
- **Revisar la telemetría dentro de Vitest con exportador en memoria** → dentro del cargador de Vitest las instrumentaciones de ioredis y pino no generan nada (plan E9-H01 §5); se arranca la API compilada.

## Preguntas probables

### ¿Cómo sé que las pruebas no tocan la base real?
La configuración fija `DB_NOMBRE=shopcart_test` y `conectarBaseDePruebas` se niega a conectar a cualquier otra.
**Muéstralo en:** [base-de-pruebas.ts:15](../../../apps/api/test/integracion/base-de-pruebas.ts#L15 "Las pruebas de integración solo corren contra")

### Si no hay SQL en las pruebas, ¿cómo preparan los datos?
Con 84 SPs `SP_Pruebas_*` que el migrador solo instala en `shopcart_test`; la prueba los llama con `ejecutarSP`.
**Muéstralo en:** [scripts.ts:44](../../../database/migrator/src/scripts.ts#L44 "R__(?:SP|TR)_Pruebas_")

### ¿Quién verifica que no se coló un SELECT en el código?
Una prueba del migrador recorre `apps/api/src`, `apps/api/test`, `packages/shared/src` y `database/migrator/src` buscando sentencias SQL.
**Muéstralo en:** [penalizaciones.test.ts:185](../../../database/migrator/test/penalizaciones.test.ts#L185 "ningún archivo TypeScript del backend contiene una sentencia SQL")

### ¿Cómo prueban que no hay sobreventa?
Tres niveles: el SP rechaza bajo bloqueo (integración), 20 clientes simultáneos por la última unidad a través de nginx (RNF-3), y la conciliación del kardex queda vacía.
**Muéstralo en:** [checkout.concurrencia.test.ts:55](../../../apps/api/test/concurrencia/checkout.concurrencia.test.ts#L55 "1 pedido y 19 × 409 STOCK_INSUFICIENTE")

### ¿La prueba de concurrencia de verdad usa las dos réplicas?
Sí: lee `X-Instancia` de cada respuesta y exige ver `api-1` y `api-2`.
**Muéstralo en:** [checkout.concurrencia.test.ts:74](../../../apps/api/test/concurrencia/checkout.concurrencia.test.ts#L74 "expect(instancias(intentos))")

### ¿Cómo prueban el doble clic en pagar?
Dos peticiones con la misma `Idempotency-Key`: un solo pedido, un solo cobro y el reintento recibe el mismo pedido.
**Muéstralo en:** [pagar.api.test.ts:152](../../../apps/api/test/integracion/checkout/pagar.api.test.ts#L152 "un solo pedido y un solo cobro")

### ¿Qué pasa si una prueba de integración deja datos basura?
No importa: cada `pnpm test:integracion` borra y recrea `shopcart_test`, y Redis de pruebas usa la base 1 y se vacía al arrancar.
**Muéstralo en:** [package.json:18](../../../package.json#L18 "migrar:pruebas")

### ¿Por qué la cobertura unitaria es tan baja en ramas?
Las ramas de los repositorios y de los SPs se ejercitan en integración contra SQL Server; la cobertura configurada solo mide las unitarias.
**Muéstralo en:** [vitest.config.ts:11](../../../apps/api/vitest.config.ts#L11 "test/unit/**/*.test.ts")

### ¿Cómo prueban que Redis caído no rompe la venta?
Una prueba de entorno detiene el contenedor de Redis y hace un checkout completo: `/health` dice `degradado`, se vende una vez y el reintento con la misma llave no cobra de nuevo.
**Muéstralo en:** [rnf2.test.ts:79](../../../apps/api/test/entorno/rnf2.test.ts#L79 "compose('stop', 'redis')")

### ¿Cómo prueban que los jobs no corren dos veces entre réplicas?
La prueba retiene el `sp_getapplock` como si fuera la otra réplica y verifica que el job retorna sin hacer nada.
**Muéstralo en:** [tareas-periodicas.test.ts:91](../../../apps/api/test/integracion/secuencial/tareas-periodicas.test.ts#L91 "retiene el sp_getapplock del job")

### ¿Las transiciones de estado se prueban solo en el servicio?
No: hay una prueba por capa (servicio, SP y trigger) y otra que compara el mapa del servicio con la tabla `TransicionEstadoPedido`.
**Muéstralo en:** [estados.api.test.ts:153](../../../apps/api/test/integracion/pedidos/estados.api.test.ts#L153 "un UPDATE directo con una transición inválida se revierte")
