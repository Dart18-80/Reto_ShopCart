# Observabilidad

## Qué decide

E9-H01 (RNF-4): la API emite trazas, métricas y logs con OpenTelemetry por OTLP/HTTP hacia Grafana LGTM (Tempo, Prometheus, Loki y Grafana en una sola imagen). El SDK se carga antes que la API con `node --import`, así las librerías quedan instrumentadas. Cada span lleva el `requestId` de la petición, el mismo que llega a los SPs y a la bitácora (A-18), y cada línea de log lleva `trace_id` y `span_id`. El colector es opcional (perfil `observabilidad`): sin él, la API funciona igual y cada señal registra una sola advertencia. Nada sensible sale del proceso, y lo prueba un receptor OTLP en memoria.

## Arranque: `node --import` antes que la API

| Regla | Dónde vive | Archivo:línea |
|---|---|---|
| La imagen arranca con la telemetría primero | `CMD` del Dockerfile | [Dockerfile:36](../../../apps/api/Dockerfile#L36 "./dist/telemetria.js") |
| Igual fuera de Docker (`pnpm start`) | `package.json` | [package.json:9](../../../apps/api/package.json#L9 "--import ./dist/telemetria.js dist/server.js") |
| Hook de ESM síncrono de Node 24 (`import-in-the-middle`) | `telemetria.ts` | [telemetria.ts:4](../../../apps/api/src/telemetria.ts#L4 "import-in-the-middle/register-hooks.mjs") |
| El hook solo envuelve los paquetes instrumentados | `telemetria.ts` | [telemetria.ts:11](../../../apps/api/src/telemetria.ts#L11 "register({ include: MODULOS_INSTRUMENTADOS })") |
| Lista: express, ioredis, pino, mssql y http | `shared/observability` | [telemetria.ts:43](../../../apps/api/src/shared/observability/telemetria.ts#L43 "MODULOS_INSTRUMENTADOS") |
| Sin endpoint (API en el host, pruebas) el SDK corre sin exportadores | `telemetria.ts` | [telemetria.ts:23](../../../apps/api/src/telemetria.ts#L23 "SIN_EXPORTAR") |
| pino se importa después de instrumentarlo | `telemetria.ts` | [telemetria.ts:25](../../../apps/api/src/telemetria.ts#L25 "await import('./shared/observability/logger.js')") |

Por qué el hook de ESM: el código es ESM e importa express, ioredis y pino directamente; `require-in-the-middle` solo ve `require`. Una librería importada antes de registrar las instrumentaciones no queda instrumentada (comentario en [telemetria.ts:88](../../../apps/api/src/shared/observability/telemetria.ts#L88 "Va antes que todo")).

## Instrumentaciones y qué se excluye

| Instrumentación | Qué hace y qué excluye | Archivo:línea |
|---|---|---|
| HTTP | Un span por petición; **el healthcheck no se traza** (llega cada pocos segundos) | [telemetria.ts:116](../../../apps/api/src/shared/observability/telemetria.ts#L116 "ignoreIncomingRequestHook") |
| HTTP | No captura encabezados (no se le pide ninguno), así no salen `Authorization` ni `Cookie` | [telemetria.ts:92](../../../apps/api/src/shared/observability/telemetria.ts#L92 "encabezados (la instrumentación HTTP no los captura") |
| Express | Solo el handler de cada ruta (fija `http.route`); middlewares y routers fuera | [telemetria.ts:126](../../../apps/api/src/shared/observability/telemetria.ts#L126 "ignoreLayersType") |
| tedious (mssql) | Un span por SP con `db.stored_procedure.name`; sin valores de parámetros | [telemetria.ts:128](../../../apps/api/src/shared/observability/telemetria.ts#L128 "new TediousInstrumentation()") |
| ioredis | Solo el nombre del comando, nunca argumentos ni el `AUTH` | [telemetria.ts:130](../../../apps/api/src/shared/observability/telemetria.ts#L130 "dbStatementSerializer: (comando) => comando") |
| pino | `trace_id` y `span_id` en cada línea escrita dentro de un span, y envío de los logs por OTLP | [telemetria.ts:131](../../../apps/api/src/shared/observability/telemetria.ts#L131 "new PinoInstrumentation()") |

## Spans propios

Todos pasan por `enSpan`, que crea un span hijo del activo y lo marca en error si la función lanza: [trazas.ts:31](../../../apps/api/src/shared/observability/trazas.ts#L31 "export function enSpan"). Sin SDK, la API de OpenTelemetry no hace nada.

| Span | Atributos | Archivo:línea |
|---|---|---|
| `pasarela.autorizar`, `capturar`, `anular`, `reembolsar`, `consultar` | resultado; nunca la tarjeta | [pasarela-con-trazas.ts:13](../../../apps/api/src/shared/observability/pasarela-con-trazas.ts#L13 "enSpan('pasarela.autorizar'") |
| Decorador compuesto en `server.ts` sobre el puerto `PasarelaPago` | — | [server.ts:59](../../../apps/api/src/server.ts#L59 "conTrazas(crearPasarelaSimulada())") |
| `tarea <nombre>` | `shopcart.replica`, `shopcart.tarea.bloqueo_tomado` | [planificador.ts:45](../../../apps/api/src/shared/jobs/planificador.ts#L45 "enSpan(`tarea ${tarea.nombre}`") y [planificador.ts:47](../../../apps/api/src/shared/jobs/planificador.ts#L47 "ATRIBUTOS.bloqueoTomado") |
| `exportacion.procesar` | ID, reporte, formato y resultado | [exportaciones.procesador.ts:115](../../../apps/api/src/modules/exportaciones/exportaciones.procesador.ts#L115 "enSpan('exportacion.procesar'") |
| `sse.difundir` (E9-H02) | dominio, versión y clientes de la réplica | [reportes.eventos.ts:124](../../../apps/api/src/modules/reportes/reportes.eventos.ts#L124 "enSpan('sse.difundir'") |

El decorador de la pasarela es un ejemplo de abierto/cerrado: se agrega trazabilidad sin tocar el adaptador ni el checkout.

## Correlación: `requestId`, `trace_id` y la base

| Regla | Archivo:línea |
|---|---|
| Cada span que nace dentro de una petición recibe `shopcart.request_id` desde el `AsyncLocalStorage` | [telemetria.ts:78](../../../apps/api/src/shared/observability/telemetria.ts#L78 "span.setAttribute(ATRIBUTOS.requestId, requestId)") |
| El span HTTP raíz empieza antes del middleware: lo toma del encabezado de la respuesta | [telemetria.ts:120](../../../apps/api/src/shared/observability/telemetria.ts#L120 "respuesta.getHeader(ENCABEZADO_REQUEST_ID)") |
| El `requestId` se genera (o se acepta si es UUID) y se devuelve en `X-Request-Id` | [request-id.ts:16](../../../apps/api/src/shared/http/request-id.ts#L16 "res.setHeader(ENCABEZADO_REQUEST_ID, id)") |
| pino agrega `requestId` e `idUsuario` a cada línea | [logger.ts:41](../../../apps/api/src/shared/observability/logger.ts#L41 "requestId: contexto.requestId") |
| `ejecutarSP` envía `@RequestId` a cada SP (A-18) | [ejecutar-sp.ts:111](../../../apps/api/src/shared/db/ejecutar-sp.ts#L111 "RequestId: { tipo: sql.UniqueIdentifier") |
| El SP lo fija en `SESSION_CONTEXT` para triggers y bitácora | [R__SP_Sistema_EstablecerContexto.sql:15](../../../database/programmability/R__SP_Sistema_EstablecerContexto.sql#L15 "N'RequestId'") |

Así, desde un `requestId` se llega a la traza en Tempo, a sus logs en Loki y a las filas de `Bitacora` que escribió esa petición.

## Métricas

| Métrica | Origen | Archivo:línea |
|---|---|---|
| `http.server.request.duration` por ruta, método y estado | instrumentación HTTP con la convención estable | [docker-compose.yml:31](../../../docker-compose.yml#L31 "OTEL_SEMCONV_STABILITY_OPT_IN: http") |
| `shopcart.pedidos.creados` | decorador del pago | [metricas.ts:15](../../../apps/api/src/shared/observability/metricas.ts#L15 "shopcart.pedidos.creados") |
| `shopcart.pagos` por resultado (`PedidoCreado`, `Repetido` o el código del error) | decorador del pago | [metricas.ts:24](../../../apps/api/src/shared/observability/metricas.ts#L24 "shopcart.pagos") y [checkout.metricas.ts:15](../../../apps/api/src/modules/checkout/checkout.metricas.ts#L15 "error.codigo : 'ERROR_INTERNO'") |
| `shopcart.tareas.ejecuciones` por tarea y resultado (`ConTrabajo`, `SinTrabajo`, `Omitida`, `Fallida`) | planificador | [metricas.ts:30](../../../apps/api/src/shared/observability/metricas.ts#L30 "shopcart.tareas.ejecuciones") |
| `shopcart.exportaciones.pendientes` (gauge leído al exportar) | `SP_Exportaciones_ContarPendientes` | [metricas.ts:39](../../../apps/api/src/shared/observability/metricas.ts#L39 "createObservableGauge") y [server.ts:132](../../../apps/api/src/server.ts#L132 "observarExportacionesPendientes") |
| Intervalo de exportación: 15 s | SDK | [telemetria.ts:54](../../../apps/api/src/shared/observability/telemetria.ts#L54 "INTERVALO_METRICAS_MS = 15_000") |

Los servicios no importan OpenTelemetry: las métricas de negocio pasan por `shared/observability/metricas.ts` (inversión de dependencias). Con la base caída, el gauge omite el punto en lugar de fallar en cada intervalo [metricas.ts:45](../../../apps/api/src/shared/observability/metricas.ts#L45 "contar().catch(() => null)").

## Logs a Loki

- pino escribe JSON en stdout con una línea por petición (método, ruta, estado y duración; nunca cuerpos ni encabezados) [registrar-peticiones.ts:19](../../../apps/api/src/shared/observability/registrar-peticiones.ts#L19 "Petición atendida").
- Redacta contraseñas, tarjeta, CVV, tokens, `authorization` y cookies, también anidados: [logger.ts:36](../../../apps/api/src/shared/observability/logger.ts#L36 "censor: '[REDACTADO]'"), probado en [logger.test.ts:18](../../../apps/api/test/unit/shared/observability/logger.test.ts#L18 "redacta contraseñas, tarjeta, CVV").
- La instrumentación de pino envía cada línea al `LoggerProvider` (OTLP → Loki). La prueba de seguridad comprueba que lo que llega no lleva secretos y que los logs del pago llevan el `trace_id` de su traza.

## Exportador con registro de estado (sin el perfil)

- Las réplicas siempre exportan a `http://otel-lgtm:4318` [docker-compose.yml:30](../../../docker-compose.yml#L30 "http://otel-lgtm:4318"), un nombre que `extra_hosts` resuelve a la IP fija `.40` de la subred [docker-compose.yml:51](../../../docker-compose.yml#L51 "otel-lgtm:${RED_PREFIJO:-172.28.10}.40"): sin el perfil, el envío nunca sale de la subred ni consulta DNS.
- Cada exportador se envuelve en `conRegistroDeEstado` [telemetria.ts:170](../../../apps/api/src/shared/observability/telemetria.ts#L170 "conRegistroDeEstado(new OTLPTraceExporter"): solo registra al **cambiar** de estado [exportador-con-estado.ts:23](../../../apps/api/src/shared/observability/exportador-con-estado.ts#L23 "if (exitoso !== disponible)"), una advertencia al caer [exportador-con-estado.ts:30](../../../apps/api/src/shared/observability/exportador-con-estado.ts#L30 "no está disponible") y una línea al volver [exportador-con-estado.ts:26](../../../apps/api/src/shared/observability/exportador-con-estado.ts#L26 "disponible otra vez").
- Activarlo es un comando, sin reiniciar la API: `docker compose --profile observabilidad up -d`.
- Pruebas: [exportador-con-estado.test.ts:29](../../../apps/api/test/unit/shared/observability/exportador-con-estado.test.ts#L29 "registra una sola advertencia mientras el colector no responde") y, en el entorno, [observabilidad.test.ts:62](../../../apps/api/test/entorno/observabilidad.test.ts#L62 "cada señal registra una sola advertencia").

## Vaciado acotado al apagar

El apagado ordenado tiene 10 s. Sin colector, vaciar los lotes esperaría el timeout del exportador y el apagado terminaría forzado; por eso el vaciado espera como mucho 2 s [telemetria.ts:59](../../../apps/api/src/shared/observability/telemetria.ts#L59 "ESPERA_VACIADO_TELEMETRIA_MS = 2_000") con [telemetria.ts:158](../../../apps/api/src/shared/observability/telemetria.ts#L158 "esperarComoMucho(apagar(), ESPERA_VACIADO_TELEMETRIA_MS)"). Es el último recurso que cierra el servidor [server.ts:149](../../../apps/api/src/server.ts#L149 "detenerTelemetria"). Prueba: [telemetria.test.ts:15](../../../apps/api/test/unit/shared/observability/telemetria.test.ts#L15 "sin el colector, vaciar lo pendiente no retrasa el apagado").

## Dashboard aprovisionado

- `otel-lgtm:0.36.0` fijada con digest, solo en el perfil [docker-compose.yml:180](../../../docker-compose.yml#L180 "grafana/otel-lgtm:0.36.0@sha256"); el aprovisionamiento y el dashboard se montan de solo lectura [docker-compose.yml:191](../../../docker-compose.yml#L191 "provisioning/dashboards/shopcart.yaml") desde [infra/grafana](../../../infra/grafana).
- El proveedor no permite borrar ni editar desde la interfaz: [shopcart.yaml:8](../../../infra/grafana/provisioning/dashboards/shopcart.yaml#L8 "disableDeletion: true").
- Paneles de [shopcart.json](../../../infra/grafana/dashboards/shopcart.json): latencia p95 por endpoint [shopcart.json:48](../../../infra/grafana/dashboards/shopcart.json#L48 "histogram_quantile(0.95"), peticiones y errores 4xx/5xx por endpoint, pedidos creados, exportaciones pendientes, pagos por resultado, tareas por resultado, peticiones por réplica [shopcart.json:329](../../../infra/grafana/dashboards/shopcart.json#L329 "sum by (instance)") y los logs [shopcart.json:358](../../../infra/grafana/dashboards/shopcart.json#L358 "Logs de las réplicas (con su trace_id)").
- Prueba de entorno con el perfil: [observabilidad.test.ts:84](../../../apps/api/test/entorno/observabilidad.test.ts#L84 "el dashboard ShopCart está aprovisionado") y la compra completa en Tempo y Loki [observabilidad.test.ts:95](../../../apps/api/test/entorno/observabilidad.test.ts#L95 "una compra es una traza en Tempo").

## Prueba de seguridad de las trazas

[seguridad-trazas.test.ts](../../../apps/api/test/telemetria/seguridad-trazas.test.ts) compila la API y la arranca como la imagen [api-con-telemetria.ts:145](../../../apps/api/test/telemetria/api-con-telemetria.ts#L145 "'--import', './dist/telemetria.js'"), contra `shopcart_test` y Redis real con contraseña, exportando a un receptor OTLP en memoria [api-con-telemetria.ts:56](../../../apps/api/test/telemetria/api-con-telemetria.ts#L56 "export async function receptorEnMemoria"). Recorre registro, login, perfil, refresh, carrito y un pago con tarjeta, y verifica:

| Qué | Prueba |
|---|---|
| Ningún span ni log lleva contraseña, token, refresh, contraseña de Redis, tarjeta, CVV, `Authorization` ni `Cookie` | [seguridad-trazas.test.ts:142](../../../apps/api/test/telemetria/seguridad-trazas.test.ts#L142 "ningún span ni log lleva contraseñas, tokens") |
| La traza del pago va de la petición a los SPs y a la pasarela, con un solo `requestId` | [seguridad-trazas.test.ts:153](../../../apps/api/test/telemetria/seguridad-trazas.test.ts#L153 "la traza del pago va de la petición a sus SPs y a la pasarela") |
| Los spans de SQL solo llevan el nombre del SP (el correo, que viaja como parámetro, no aparece) | [seguridad-trazas.test.ts:172](../../../apps/api/test/telemetria/seguridad-trazas.test.ts#L172 "los spans de SQL solo llevan el nombre del SP") |
| Los spans de Redis solo llevan el comando | [seguridad-trazas.test.ts:187](../../../apps/api/test/telemetria/seguridad-trazas.test.ts#L187 "los spans de Redis solo llevan el comando") |
| Los logs del pago llevan el `trace_id` de su traza | [seguridad-trazas.test.ts:196](../../../apps/api/test/telemetria/seguridad-trazas.test.ts#L196 "los logs de la petición de pago llevan el trace_id") |

Además, los spans de la pasarela nunca llevan la tarjeta: [pasarela-con-trazas.test.ts:64](../../../apps/api/test/unit/shared/observability/pasarela-con-trazas.test.ts#L64 "nunca lleva la tarjeta").

## Alternativas descartadas

- **Datadog** → requiere cuenta y API key (RNF-4).
- **ELK** → más pesado en RAM (RNF-4).
- **`@opentelemetry/sdk-node`** → trae exportadores gRPC, Zipkin, Jaeger y Prometheus que no se usan; se instalan los paquetes por señal (plan E9-H01 §1).
- **`module.register` para el hook de ESM** → funciona pero está marcado como obsoleto y el lint lo rechaza; se usa `import-in-the-middle` con los hooks síncronos de Node 24 (plan E9-H01 §1, aprobado por el PO).
- **Colector siempre levantado** → suma unos 700 MB de RAM; queda en un perfil opcional y la API no depende de él.
- **Probar la telemetría dentro de Vitest** → ahí las instrumentaciones de ioredis y pino no generan nada; se prueba la API compilada (plan E9-H01 §5).

## Preguntas probables

### ¿Por qué `node --import` y no inicializar la telemetría en `server.ts`?
Las instrumentaciones parchean las librerías al cargarlas. Si express, mssql, ioredis o pino se importan antes, quedan sin instrumentar.
**Muéstralo en:** [Dockerfile:35](../../../apps/api/Dockerfile#L35 "la telemetría se carga antes que la API")

### ¿Qué pasa si no levanto el perfil de observabilidad?
La API atiende igual: cada señal registra una advertencia al caer y una línea al volver, nunca una por lote, y el envío no sale de la subred.
**Muéstralo en:** [exportador-con-estado.ts:23](../../../apps/api/src/shared/observability/exportador-con-estado.ts#L23 "if (exitoso !== disponible)")

### ¿Pueden aparecer los parámetros de un SP en una traza?
No: tedious solo pone el nombre del SP y una prueba busca un valor real (el correo) en todos los spans de SQL.
**Muéstralo en:** [seguridad-trazas.test.ts:184](../../../apps/api/test/telemetria/seguridad-trazas.test.ts#L184 "not.toContain(correo)")

### ¿Y la contraseña de Redis en el comando `AUTH`?
El serializador de ioredis devuelve solo el nombre del comando; la prueba busca la contraseña de Redis en todo lo exportado.
**Muéstralo en:** [telemetria.ts:130](../../../apps/api/src/shared/observability/telemetria.ts#L130 "dbStatementSerializer")

### ¿Cómo llego de un error en el log a la traza completa?
La línea de log trae `trace_id` (instrumentación de pino) y `requestId`; en Grafana se filtra Loki por `trace_id` o se busca en Tempo por `shopcart.request_id`.
**Muéstralo en:** [observabilidad.test.ts:130](../../../apps/api/test/entorno/observabilidad.test.ts#L130 "span.shopcart.request_id")

### ¿Por qué no se traza `/health`?
Docker y nginx lo llaman cada pocos segundos en cada réplica; sería ruido que tapa las trazas reales.
**Muéstralo en:** [telemetria.ts:52](../../../apps/api/src/shared/observability/telemetria.ts#L52 "RUTA_HEALTH = '/api/v1/health'")

### ¿Cómo se ve en la traza qué réplica atendió?
El recurso de cada span lleva `service.instance.id` con `INSTANCIA_ID`; el dashboard agrupa peticiones por réplica.
**Muéstralo en:** [telemetria.ts:97](../../../apps/api/src/shared/observability/telemetria.ts#L97 "'service.instance.id': instancia")

### ¿Cómo sé si un job tomó el bloqueo o lo omitió porque lo tenía la otra réplica?
Cada ejecución es un span `tarea <nombre>` con `shopcart.tarea.bloqueo_tomado`, y la métrica de tareas cuenta `Omitida`.
**Muéstralo en:** [planificador.ts:47](../../../apps/api/src/shared/jobs/planificador.ts#L47 "resultado !== null")

### ¿Los servicios dependen de OpenTelemetry?
No: las métricas de negocio pasan por funciones de `shared/observability`, el pago se envuelve con un decorador y la pasarela con otro.
**Muéstralo en:** [checkout.metricas.ts:6](../../../apps/api/src/modules/checkout/checkout.metricas.ts#L6 "export function conMetricasDePago")

### ¿La telemetría puede alargar el apagado?
Como mucho 2 s: el vaciado se corta con `esperarComoMucho`, dentro de los 10 s del apagado ordenado.
**Muéstralo en:** [telemetria.test.ts:57](../../../apps/api/test/unit/shared/observability/telemetria.test.ts#L57 "el límite deja margen dentro de la espera del apagado ordenado")

### ¿Qué ve el evaluador en Grafana?
El dashboard `ShopCart` con latencia p95, peticiones y errores por endpoint, pedidos, pagos, tareas, exportaciones pendientes, peticiones por réplica y logs.
**Muéstralo en:** [shopcart.json:3](../../../infra/grafana/dashboards/shopcart.json#L3 "ShopCart")
