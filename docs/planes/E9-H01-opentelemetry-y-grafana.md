# Plan E9-H01 · OpenTelemetry y Grafana LGTM

Historia grande (CLAUDE.md, flujo por historia): plan escrito, verificado contra el alcance del PO (§9) antes de implementar.

## 1. Dependencias (A-16)

Solo paquetes de la familia `@opentelemetry`, en el último conjunto compatible con más de dos semanas (6 de octubre de 2026). La serie `0.300`/`3.0.0` del 20 de octubre es un salto de versión mayor demasiado reciente.

| Paquete | Versión | Para qué |
|---|---|---|
| `@opentelemetry/api` | 1.9.1 | API global (no-op si no hay SDK) para spans y métricas propios |
| `@opentelemetry/api-logs` | 0.223.0 | Registro global del proveedor de logs (lo usa la instrumentación de pino) |
| `@opentelemetry/sdk-trace-node` | 2.12.0 | SDK de trazas de Node (contexto con `AsyncLocalStorage`); trae `InMemorySpanExporter` para las pruebas |
| `@opentelemetry/sdk-metrics` | 2.12.0 | SDK de métricas |
| `@opentelemetry/sdk-logs` | 0.223.0 | SDK de logs (pino → Loki) |
| `@opentelemetry/resources`, `@opentelemetry/semantic-conventions` | 2.12.0, 1.43.0 | `service.name`, `service.instance.id` |
| `@opentelemetry/exporter-trace-otlp-http`, `-metrics-otlp-http`, `-logs-otlp-http` | 0.223.0 | Exportadores OTLP por HTTP al colector de `otel-lgtm` |
| `@opentelemetry/instrumentation` | 0.223.0 | `registerInstrumentations` y el hook de ESM (`hook.mjs`) |
| `@opentelemetry/instrumentation-http` | 0.223.0 | Spans y métrica de duración HTTP |
| `@opentelemetry/instrumentation-express` | 0.71.1 | `http.route` y spans de middlewares |
| `@opentelemetry/instrumentation-tedious` | 0.42.0 | Un span por llamada a SQL Server, con el nombre del SP |
| `@opentelemetry/instrumentation-ioredis` | 0.71.0 | Un span por comando de Redis (solo el nombre del comando) |
| `@opentelemetry/instrumentation-pino` | 0.69.0 | `trace_id` y `span_id` en cada línea y envío de logs por OTLP |
| `@opentelemetry/core` | 2.12.0 | `ExportResultCode` para el registro de estado de los exportadores |
| `import-in-the-middle` | 3.5.3 | **Agregado durante la implementación, con aprobación del PO:** el hook de ESM con los hooks síncronos de Node 24 (`register-hooks.mjs`). `require-in-the-middle` solo ve `require`, y el código ESM importa express, ioredis y pino directamente. La alternativa era `module.register`, que funciona pero está marcado como obsoleto y el lint lo rechaza |

**Por qué no `@opentelemetry/sdk-node`:** trae como dependencias los exportadores gRPC (con `@grpc/grpc-js`), Zipkin, Jaeger y Prometheus, que no se usan. Con los paquetes por señal no entra nada de eso. Las dependencias transitivas que no son de la familia (`import-in-the-middle`, `require-in-the-middle` y `protobufjs`) las trae `@opentelemetry/instrumentation` o los exportadores; no se instalan directamente.

## 2. Arranque (`node --import`)

- `apps/api/src/telemetria.ts` (compilado a `dist/telemetria.js`) es lo primero que carga Node: registra el hook de ESM (`import-in-the-middle/register-hooks.mjs`, solo para los paquetes instrumentados), crea los proveedores de trazas, métricas y logs y registra las instrumentaciones **antes** de que se importe express, mssql, ioredis o pino.
- `Dockerfile` (CMD) y `pnpm start`: `node --import ./dist/telemetria.js dist/server.js`.
- El armado vive en `shared/observability/telemetria.ts` (`iniciarTelemetria(opciones)`): recibe los exportadores, así las pruebas pasan `InMemorySpanExporter` y la producción los OTLP.
- Apagado ordenado: `registrarApagadoOrdenado` llama a `telemetria.detener()` (vacía los lotes pendientes) después de cerrar el servidor.

## 3. Activación y comportamiento sin el perfil

**Decisión:** las réplicas siempre tienen `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-lgtm:4318`. El colector es opcional y se levanta con **un solo comando**: `docker compose --profile observabilidad up -d`. No hay que reiniciar la API ni cambiar `.env`: en cuanto el colector responde, los lotes siguientes llegan.

- `otel-lgtm` ya tiene su IP reservada en la subred (`.40`) y su nombre en `extra_hosts` de las réplicas: sin el perfil, el envío se intenta contra esa IP de la subred y nunca sale de ella ni consulta DNS.
- Cada exportador se envuelve en `conRegistroDeEstado`: una sola línea `warn` al pasar a no disponible y una `info` al volver, como el adaptador de Redis. No hay errores repetidos (el `diag` de OpenTelemetry queda sin logger).
- Sin `OTEL_EXPORTER_OTLP_ENDPOINT` (la API en el host, las pruebas): el SDK de trazas corre igual (los `trace_id` siguen en los logs), pero sin exportadores.
- `OTEL_SEMCONV_STABILITY_OPT_IN=http` para la métrica estable `http.server.request.duration` (segundos, con `http.route` y `http.response.status_code`).

## 4. Perfil `observabilidad` en compose

- `otel-lgtm`: `grafana/otel-lgtm:0.36.0@sha256:57c04cbd…` (9 de octubre), `profiles: [observabilidad]`, IP fija `${RED_PREFIJO}.40`, puertos `127.0.0.1:${GRAFANA_PUERTO:-3001}:3000` (solo Grafana; los OTLP no se publican).
- Sin salidas a internet: `GF_PLUGINS_PREINSTALL_DISABLED=true` (el arranque de la imagen preinstala `grafana-llm-app`), `GF_ANALYTICS_REPORTING_ENABLED=false`, `GF_ANALYTICS_CHECK_FOR_UPDATES=false`, `GF_ANALYTICS_CHECK_FOR_PLUGIN_UPDATES=false`.
- Aprovisionamiento desde `infra/grafana`: `provisioning/dashboards/shopcart.yaml` y `dashboards/shopcart.json`, montados de solo lectura. Las fuentes de datos ya vienen en la imagen con UID fijos (`prometheus`, `tempo`, `loki`).
- La imagen corre como root y Grafana entra como Admin anónimo: es una imagen de desarrollo, publicada solo en `127.0.0.1`. Se documenta.
- `GRAFANA_PUERTO=3001` en `.env.example` y en la tabla de puertos del README.

## 5. Seguridad de las trazas

| Fuga posible | Cómo se evita |
|---|---|
| Valores de parámetros de SQL | La instrumentación de tedious solo pone el nombre del SP; los parámetros no se registran. Prueba que lo verifica |
| Argumentos de Redis (incluido `AUTH`) | `dbStatementSerializer` devuelve solo el nombre del comando |
| `Authorization`, `Cookie` | La instrumentación HTTP no captura encabezados salvo que se le pidan; no se configura ninguno |
| Cuerpos y datos de tarjeta | Ni http ni express registran cuerpos; los spans propios de la pasarela solo llevan la operación, el resultado y la marca |
| Logs por OTLP | Salen de la línea ya serializada por pino, después de la redacción (se verifica en la prueba) |

**Prueba con exportador en memoria:** un proyecto de Vitest (`test/telemetria/`). **Cambio durante la implementación:** dentro del cargador de módulos de Vitest, las instrumentaciones de ioredis y pino no generan nada aunque el módulo quede envuelto. Por eso la prueba compila la API y la arranca igual que la imagen (`node --import ./dist/telemetria.js dist/server.js`, contra `shopcart_test` y Redis), apuntando el exportador OTLP a un receptor en memoria dentro de la prueba: se revisa exactamente lo que sale del proceso. Recorre login (cookie y `Authorization`), un pago con tarjeta, escrituras con parámetros. Busca en todos los atributos de todos los spans y logs: la contraseña de Redis, la contraseña del usuario, el token, el refresh, el número de tarjeta, el CVV y valores de parámetros de SQL conocidos. Además verifica que hay spans de SQL con el nombre del SP y de Redis con solo el comando.

## 6. Trazas

- `requestId` (`shopcart.request_id`) en cada span: un `SpanProcessor` que lo toma de `obtenerContexto()` al iniciar el span, y el middleware `requestId` lo pone en el span HTTP raíz (que empieza antes del middleware) con `getRPCMetadata`.
- `trace_id` y `span_id` en cada línea de pino escrita dentro de un span (instrumentación de pino).
- Spans propios con `@opentelemetry/api` (no-op sin SDK), detrás de un helper `enSpan` en `shared/observability`:
  - **Pasarela:** decorador `conTrazas(pasarela)` del puerto, compuesto en `server.ts`: `pasarela.autorizar`, `capturar`, `anular`, `consultar` y `reembolsar`, con el resultado y el error si no respondió. Nunca la tarjeta.
  - **Planificador:** `tarea <nombre>` con `shopcart.replica` y `shopcart.tarea.bloqueo_tomado`.
  - **Exportaciones:** `exportacion.procesar` por solicitud, con su ID, reporte, formato y resultado.
- SQL: los spans de tedious se llaman con el SP (`execute SP_…`); se verifica en la prueba.

## 7. Métricas

| Métrica | Tipo | Atributos | Dónde |
|---|---|---|---|
| `http.server.request.duration` | Histograma | `http.route`, `http.request.method`, `http.response.status_code` | Instrumentación HTTP |
| `shopcart.pedidos.creados` | Contador | — | Decorador de métricas del servicio de pago (`creado: true`) |
| `shopcart.pagos` | Contador | `resultado` (`PedidoCreado`, `Repetido` o el código del error) | El mismo decorador |
| `shopcart.tareas.ejecuciones` | Contador | `tarea`, `resultado` (`ConTrabajo`, `SinTrabajo`, `Omitida`, `Fallida`) | Planificador |
| `shopcart.exportaciones.pendientes` | Gauge observable | — | `SP_Exportaciones_ContarPendientes` (nuevo, solo lectura, rol Sistema), leído al exportar las métricas |

Las métricas de negocio pasan por funciones de `shared/observability/metricas.ts`; los servicios no importan OpenTelemetry.

## 8. Logs a Loki

La instrumentación de pino envía cada línea al `LoggerProvider` global (OTLP → Loki) con el contexto de su span: en Grafana, desde una traza se llega a sus logs por `trace_id` (la fuente Loki de la imagen ya tiene el enlace).

## 9. Verificación del plan contra el alcance

| Pedido del PO | Sección |
|---|---|
| Paquetes de la familia, con versión en A-16 y el README | §1 |
| SDK antes que todo (`node --import`) | §2 |
| Perfil `observabilidad`, versión fija, IP fija, `extra_hosts`, Grafana en 127.0.0.1 y puerto en `.env` | §4 |
| Sin el perfil: igual, sin errores repetidos, sin conexiones fuera de la subred; un comando | §3 |
| Trazas sin SQL, Redis, `Authorization`, `Cookie`, cuerpos ni tarjeta, probado con exportador en memoria | §5 |
| `requestId` en cada span; `trace_id`/`span_id` en pino | §6 |
| Spans de pasarela, tareas (réplica y bloqueo) y exportaciones; SQL con el nombre del SP | §6 |
| Duración HTTP por ruta y estado; pedidos, pagos, tareas y exportaciones pendientes | §7 |
| Logs a Loki correlacionados | §8 |
| Dashboard aprovisionado y recorrido de demo en el README | §4, §10 |
| RNF-4, 01 §11 y el diagrama sin «planificado» | §10 |

## 10. Documentación y pruebas

- A-16 con los paquetes y sus versiones; RNF-4 y 01 §11 en presente; README: activación, puertos, recorrido de demo (comprar en Swagger → Explore de Tempo → la traza con la réplica, los SPs y la pasarela → sus logs en Loki → el dashboard).
- Diagrama de arquitectura: el perfil `observabilidad` deja de ser «Fase 2».
- Pruebas: unitarias (envoltorio de estado, decorador de la pasarela, planificador, decorador de pagos, procesador) con exportador y lector de métricas en memoria; el proyecto de telemetría (§5); y en `test:entorno`, con el perfil activo, que una compra deja una traza en Tempo con la petición, los SPs y la pasarela.
