# Infraestructura

## Qué decide

Todo el entorno se levanta con `docker compose up -d`: SQL Server, un migrador que corre una vez, Redis, dos réplicas idénticas de la API y un nginx que balancea y es el único origen (`http://localhost:8080`). La red tiene subred e IPs fijas y los nombres se resuelven desde `/etc/hosts`, nunca por DNS (A-03). El orden de arranque lo dan los healthchecks. Cada réplica se apaga ordenadamente con SIGTERM. Un perfil opcional agrega Grafana LGTM. Lo crítico vive en SQL Server; Redis y una réplica se pueden perder sin vender de más ni cobrar dos veces (RNF-2).

## Servicios

| Servicio | Imagen | IP | Healthcheck | Arranca después de | Cita |
|---|---|---|---|---|---|
| `sqlserver` | `mssql/server:2022-CU27-GDR1-ubuntu-22.04` fijada con digest | `.10` | `sqlcmd` contra el motor | — | [docker-compose.yml:65](../../../docker-compose.yml#L65 "2022-CU27-GDR1-ubuntu-22.04@sha256") |
| `db-migrator` | propia, Node 24 sin compilar | `.12` | — (one-shot) | `sqlserver` saludable | [docker-compose.yml:113](../../../docker-compose.yml#L113 "condition: service_healthy") |
| `redis` | `redis:7.4.12-alpine3.21` fijada con digest | `.11` | `redis-cli ping` | — | [docker-compose.yml:123](../../../docker-compose.yml#L123 "image: redis:7.4.12-alpine3.21@sha256") |
| `api-1`, `api-2` | `shopcart-api:local` | `.21`, `.22` | `wget` a `/api/v1/health` | migrador terminado con éxito y `redis` saludable | [docker-compose.yml:41](../../../docker-compose.yml#L41 "condition: service_completed_successfully") |
| `web` | `nginx:1.28.3-alpine3.23` fijada con digest + `nginx.conf` | `.30` | `wget` a `/` | `api-1` y `api-2` saludables | [docker-compose.yml:177](../../../docker-compose.yml#L177 "condition: service_healthy") |
| `otel-lgtm` | `grafana/otel-lgtm:0.36.0` fijada con digest | `.40` | — | perfil `observabilidad` | [docker-compose.yml:194](../../../docker-compose.yml#L194 "profiles: [observabilidad]") |

- Las dos réplicas comparten el mismo bloque (`x-api`) y solo cambia `INSTANCIA_ID`: [docker-compose.yml:34](../../../docker-compose.yml#L34 "x-api: &api") y [docker-compose.yml:153](../../../docker-compose.yml#L153 "INSTANCIA_ID: api-1"). Cada respuesta lleva `X-Instancia`: [instancia.ts:6](../../../apps/api/src/shared/http/instancia.ts#L6 "res.setHeader('X-Instancia', instancia)").
- Mínimo privilegio en variables: las réplicas no reciben `MSSQL_SA_PASSWORD` ni la contraseña del migrador [docker-compose.yml:8](../../../docker-compose.yml#L8 "x-api-entorno: &api-entorno").
- SQL Server y Redis solo se publican en `127.0.0.1`: [docker-compose.yml:77](../../../docker-compose.yml#L77 "127.0.0.1:${DB_PORT:-1433}") y [docker-compose.yml:137](../../../docker-compose.yml#L137 "127.0.0.1:${REDIS_PORT:-6379}").
- `restart: unless-stopped` en las réplicas: un proceso que se cae vuelve solo; un `docker compose stop` se respeta [docker-compose.yml:56](../../../docker-compose.yml#L56 "restart: unless-stopped").

## Red: subred fija y `extra_hosts` sin DNS (A-03)

| Regla | Dónde vive | Archivo:línea | Decisión |
|---|---|---|---|
| Subred `/24` con IPs fijas de `.2` a `.127` | `networks` | [docker-compose.yml:218](../../../docker-compose.yml#L218 "subnet: ${RED_PREFIJO:-172.28.10}.0/24") | A-03 |
| Los contenedores sin IP fija toman de `.128/25`: nadie ocupa la IP de una réplica detenida | `ip_range` | [docker-compose.yml:219](../../../docker-compose.yml#L219 "ip_range: ${RED_PREFIJO:-172.28.10}.128/25") | A-03 |
| La API resuelve `sqlserver`, `redis` y `otel-lgtm` desde `/etc/hosts` | `extra_hosts` | [docker-compose.yml:48](../../../docker-compose.yml#L48 "sqlserver:${RED_PREFIJO:-172.28.10}.10") | A-03 |
| nginx resuelve las réplicas desde `/etc/hosts`, una vez al arrancar | `extra_hosts` de `web` | [docker-compose.yml:185](../../../docker-compose.yml#L185 "api-1:${RED_PREFIJO:-172.28.10}.21") | A-03 |
| El prefijo se cambia en `.env` si choca con otra red | `.env.example` | [.env.example:76](../../../.env.example#L76 "RED_PREFIJO=172.28.10") | — |

Por qué: con un contenedor detenido, el DNS de Docker reenvía el nombre al DNS del host, que puede devolver una IP pública; la API mandaría el login de SQL Server o el `AUTH` de Redis fuera de la subred [docker-compose.yml:46](../../../docker-compose.yml#L46 "la API mandaría el login de SQL Server"). Lo verifica una prueba de entorno para el colector: [observabilidad.test.ts:56](../../../apps/api/test/entorno/observabilidad.test.ts#L56 "el colector se resuelve a su IP fija de la subred").

## nginx: balanceador y único origen

| Regla | Archivo:línea |
|---|---|
| `upstream` round-robin con estado compartido entre workers (`zone`) | [nginx.conf:28](../../../infra/nginx/nginx.conf#L28 "zone api 64k") |
| Detección pasiva: 3 fallas en 10 s sacan a la réplica 10 s | [nginx.conf:29](../../../infra/nginx/nginx.conf#L29 "max_fails=3 fail_timeout=10s") |
| Conexión a una réplica con límite de 250 ms (la IP de una detenida no rechaza, se cuelga) | [nginx.conf:69](../../../infra/nginx/nginx.conf#L69 "proxy_connect_timeout     250ms") |
| Reintento en la otra réplica solo ante `error` o `timeout`, como mucho 2 intentos | [nginx.conf:71](../../../infra/nginx/nginx.conf#L71 "proxy_next_upstream       error timeout") |
| Sin `non_idempotent`: un POST que ya llegó a una réplica nunca se repite en la otra | [nginx.conf:67](../../../infra/nginx/nginx.conf#L67 "Sin non_idempotent") |
| `location` exacta del SSE sin buffering y con lectura de 1 h | [nginx.conf:39](../../../infra/nginx/nginx.conf#L39 "location = /api/v1/admin/reportes/eventos") y [nginx.conf:47](../../../infra/nginx/nginx.conf#L47 "proxy_buffering off") |
| Sin versión de nginx en encabezados ni páginas de error | [nginx.conf:13](../../../infra/nginx/nginx.conf#L13 "server_tokens off") |
| El log de acceso guarda qué réplica atendió | [nginx.conf:18](../../../infra/nginx/nginx.conf#L18 "instancia=$upstream_http_x_instancia") |
| Cuerpo máximo 1 MB en nginx (la API limita JSON a 100 kb) | [nginx.conf:35](../../../infra/nginx/nginx.conf#L35 "client_max_body_size 1m") |

Detalle importante de `proxy_next_upstream error timeout`: nginx no reenvía un método no idempotente (POST, PATCH) a la otra réplica una vez que lo envió a la primera, salvo con `non_idempotent`. Un GET sí puede repetirse si la primera réplica no responde a tiempo (`proxy_read_timeout 30s`, [nginx.conf:70](../../../infra/nginx/nginx.conf#L70 "proxy_read_timeout        30s")). nginx no usa `/health`: la versión libre solo tiene detección pasiva.

## Imágenes: multi-stage y sin root

| Regla | Archivo:línea |
|---|---|
| Etapa de build con pnpm, compila `shared` y la API | [Dockerfile:3](../../../apps/api/Dockerfile#L3 "FROM node:24.22.2-alpine3.24@sha256") |
| `pnpm deploy --prod`: solo dependencias de producción | [Dockerfile:20](../../../apps/api/Dockerfile#L20 "pnpm deploy --filter @shopcart/api --prod") |
| Imagen final sin `src/`, TypeScript ni pnpm | [Dockerfile:23](../../../apps/api/Dockerfile#L23 "FROM node:24.22.2-alpine3.24@sha256") y [imagen.test.ts:57](../../../apps/api/test/humo/imagen.test.ts#L57 "solo lleva JavaScript compilado") |
| El volumen de exportaciones pertenece a `node` | [Dockerfile:30](../../../apps/api/Dockerfile#L30 "chown node:node /var/lib/shopcart/exportaciones") |
| La API corre como `node` | [Dockerfile:31](../../../apps/api/Dockerfile#L31 "USER node") |
| Healthcheck de la réplica contra `/api/v1/health` | [Dockerfile:34](../../../apps/api/Dockerfile#L34 "http://127.0.0.1:3000/api/v1/health") |
| `node` es PID 1 y carga la telemetría antes que la API | [Dockerfile:37](../../../apps/api/Dockerfile#L37 "--import") |
| El migrador también corre como `node` | [Dockerfile:22](../../../database/migrator/Dockerfile#L22 "USER node") |
| Redis corre como `redis` (con `sh -c` el entrypoint oficial lo dejaría como root) | [docker-compose.yml:126](../../../docker-compose.yml#L126 "user: redis") |
| La contraseña de Redis va en una variable, no en la línea de comandos de Compose | [docker-compose.yml:135](../../../docker-compose.yml#L135 "--requirepass") |

La prueba de entorno lee el UID del PID 1 de `api-1`, `api-2`, `sqlserver` y `redis`: [contenedores.test.ts:15](../../../apps/api/test/entorno/contenedores.test.ts#L15 "no corre como root"). `otel-lgtm` sí corre como root (imagen de desarrollo), por eso solo publica Grafana en `127.0.0.1` [docker-compose.yml:202](../../../docker-compose.yml#L202 "127.0.0.1:${GRAFANA_PUERTO:-3001}:3000").

## Imágenes fijadas y migrador one-shot

- Todas las imágenes de un registro (SQL Server, Redis, Grafana LGTM, Node y nginx) llevan versión exacta y el digest del contenido que pasó las suites (decisión del PO en E9); se actualizan a propósito con el procedimiento del README. Las pruebas lo exigen en el compose y en cada `FROM`: [penalizaciones.test.ts:251](../../../database/migrator/test/penalizaciones.test.ts#L251 "toda imagen del compose que viene de un registro tiene versión exacta y digest") y [penalizaciones.test.ts:257](../../../database/migrator/test/penalizaciones.test.ts#L257 "toda imagen base de los Dockerfile tiene versión exacta y digest").
- El migrador termina y no se reinicia [docker-compose.yml:119](../../../docker-compose.yml#L119 "restart: 'no'"). Como `sa` crea la base, activa RCSI (A-05) [preparar-servidor.sql:21](../../../database/migrator/sql/preparar-servidor.sql#L21 "SET READ_COMMITTED_SNAPSHOT ON") y crea los logins; luego aplica los scripts como `shopcart_migrator` [preparar-servidor.sql:45](../../../database/migrator/sql/preparar-servidor.sql#L45 "LOGIN shopcart_migrator").
- Dos migradores a la vez no se pisan: `sp_getapplock` de sesión [migrador.ts:26](../../../database/migrator/src/migrador.ts#L26 "await adquirirBloqueo(bloqueo)"). Cada script corre en su transacción con su fila de historial, con el contexto `Sistema` fijado antes [migrador.ts:93](../../../database/migrator/src/migrador.ts#L93 "establecer-contexto-sistema").
- Las réplicas no arrancan si el migrador falla, porque esperan `service_completed_successfully` [docker-compose.yml:41](../../../docker-compose.yml#L41 "service_completed_successfully").

## Volumen de exportaciones compartido (A-24)

El archivo que genera una réplica se descarga desde la otra: las dos montan el volumen `exportaciones` [docker-compose.yml:55](../../../docker-compose.yml#L55 "exportaciones:/var/lib/shopcart/exportaciones") y lo reciben como `ALMACEN_DIR` [docker-compose.yml:27](../../../docker-compose.yml#L27 "ALMACEN_DIR: /var/lib/shopcart/exportaciones"). En producción sería otro adaptador del puerto `AlmacenArchivos` (S3, Azure Blob), sin volumen.

## Apagado ordenado con SIGTERM

| Paso | Archivo:línea |
|---|---|
| SIGTERM y SIGINT disparan el apagado una sola vez | [apagado.ts:84](../../../apps/api/src/apagado.ts#L84 "proceso.once('SIGTERM', alRecibirSenal)") |
| Primero se cierran los streams del dashboard, que no terminan solos | [apagado.ts:62](../../../apps/api/src/apagado.ts#L62 "for (const accion of alIniciar) accion();") y [server.ts:157](../../../apps/api/src/server.ts#L157 "difusorEventos.cerrarTodas()") |
| El servidor deja de aceptar conexiones y espera las peticiones en curso | [apagado.ts:63](../../../apps/api/src/apagado.ts#L63 "servidor.close(") |
| Luego tareas, exportaciones y el pool de SQL, en ese orden | [server.ts:143](../../../apps/api/src/server.ts#L143 ".detener()") |
| Redis (suscripción y cliente) y la telemetría | [server.ts:146](../../../apps/api/src/server.ts#L146 "avisos.cerrar().then(() => redis.quit())") y [server.ts:149](../../../apps/api/src/server.ts#L149 "detenerTelemetria") |
| Si tarda más de 10 s, salida forzada con 1 | [server.ts:36](../../../apps/api/src/server.ts#L36 "ESPERA_APAGADO_MS = 10_000") y [apagado.ts:56](../../../apps/api/src/apagado.ts#L56 "forzarSalida = setTimeout") |
| Docker espera 15 s antes del SIGKILL (réplicas, Redis y SQL Server): el SIGKILL nunca compite con la salida de la API | [docker-compose.yml:59](../../../docker-compose.yml#L59 "stop_grace_period: 15s") |

Pruebas: [apagado.test.ts:123](../../../apps/api/test/unit/apagado.test.ts#L123 "con SIGTERM termina las peticiones en curso") y, en el entorno, [apagado.test.ts:29](../../../apps/api/test/entorno/apagado.test.ts#L29 "docker stop durante una petición en curso") (un `docker stop` con una petición retenida por SQL Server pausado: la petición termina con 200 y la réplica sale con 0) y [tiempo-real.test.ts:120](../../../apps/api/test/entorno/tiempo-real.test.ts#L120 "al detener la réplica (SIGTERM) su stream se cierra enseguida").

## `.env` y `.env.example`

- Cada valor tiene una sola fuente: Compose, el migrador y la API leen las mismas variables; Compose falla si falta una obligatoria con `:?` [docker-compose.yml:13](../../../docker-compose.yml#L13 "Define CORS_ORIGINS en .env").
- `.env` está en `.gitignore` [.gitignore:12](../../../.gitignore#L12 ".env") y `.env.example` solo trae valores marcados `EJEMPLO` [.env.example:9](../../../.env.example#L9 "MSSQL_SA_PASSWORD=EJEMPLO"), lo que verifica [secretos.test.ts:15](../../../apps/api/test/unit/secretos.test.ts#L15 "todo secreto de .env.example está marcado como ejemplo").
- En `NODE_ENV=production` la API se niega a arrancar con un secreto de ejemplo: [index.ts:141](../../../apps/api/src/shared/config/index.ts#L141 "MARCA_EJEMPLO").

## Perfil `observabilidad`

`docker compose --profile observabilidad up -d` agrega `otel-lgtm` con su IP `.40`, el dashboard montado de solo lectura [docker-compose.yml:205](../../../docker-compose.yml#L205 "./infra/grafana/dashboards:/otel-lgtm/shopcart-dashboards:ro") y sin salidas a internet de Grafana [docker-compose.yml:197](../../../docker-compose.yml#L197 "GF_PLUGINS_PREINSTALL_DISABLED"). Las réplicas siempre exportan a `http://otel-lgtm:4318` [docker-compose.yml:30](../../../docker-compose.yml#L30 "OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-lgtm:4318"): no hay que reiniciarlas. Detalle en [observabilidad.md](observabilidad.md).

## Qué pasa cuando algo cae

### Se detiene `api-1`

1. nginx intenta conectar a `.21`; la IP no responde y la conexión vence a los 250 ms ([nginx.conf:69](../../../infra/nginx/nginx.conf#L69 "250ms")).
2. La petición se reintenta en `api-2` ([nginx.conf:72](../../../infra/nginx/nginx.conf#L72 "proxy_next_upstream_tries 2")); tras 3 fallas, `api-1` sale de la rotación 10 s.
3. Si `api-1` recibió SIGTERM, terminó sus peticiones en curso antes de salir (apagado ordenado). Un POST que ya estaba en `api-1` no se repite en `api-2`; si el cliente reintenta un pago, la `Idempotency-Key` y el `UNIQUE` en SQL Server evitan el cobro doble.
4. Las tareas periódicas siguen en `api-2`: la coordinación es el `sp_getapplock` de cada SP, no la réplica (A-04).

Lo prueba [rnf2.test.ts:40](../../../apps/api/test/entorno/rnf2.test.ts#L40 "peticiones seguidas a través de nginx responden 200 desde api-2"): 20 peticiones con `api-1` detenida responden 200 desde `api-2` y, al volver, nginx la reincorpora sola ([rnf2.test.ts:63](../../../apps/api/test/entorno/rnf2.test.ts#L63 "nginx vuelve a enviar peticiones a api-1")).

### Se detiene Redis

- La API arrancó o sigue sin Redis: sin cola fuera de línea y un intento por comando, falla rápido ([redis.ts:23](../../../apps/api/src/shared/adapters/redis.ts#L23 "enableOfflineQueue: false")).
- `/health` responde 200 con `redis: "degradado"`.
- El rate limiting cae a un contador en memoria por réplica ([limitador-redis.ts:60](../../../apps/api/src/shared/adapters/limitador-redis.ts#L60 "return consumirEn(enMemoria, clave)")).
- La versión de sesión no se puede leer: el token se acepta y el riesgo queda acotado a la vida del access token, 15 min ([versiones-sesion-redis.ts:42](../../../apps/api/src/shared/adapters/versiones-sesion-redis.ts#L42 "return null;")).
- La caché de reportes no responde y los reportes van a la base.
- El stream SSE sigue abierto con latidos y, al volver Redis, envía las versiones con `recargar: true` ([tiempo-real.test.ts:85](../../../apps/api/test/entorno/tiempo-real.test.ts#L85 "con Redis detenido el stream sigue abierto")).
- Stock, reservas, idempotencia y refresh tokens viven en SQL Server: se vende una sola vez y se cobra una sola vez ([rnf2.test.ts:68](../../../apps/api/test/entorno/rnf2.test.ts#L68 "vende la última unidad una sola vez y cobra una sola vez")).

### Se pausa SQL Server

- Las consultas se cancelan al vencer `DB_TIMEOUT_CONSULTA_MS` (15 s por defecto, [docker-compose.yml:21](../../../docker-compose.yml#L21 "DB_TIMEOUT_CONSULTA_MS")) y la API responde `500 ERROR_INTERNO` sin stack ni detalles del driver: [seguridad-http.test.ts:118](../../../apps/api/test/entorno/seguridad-http.test.ts#L118 "compose('pause', 'sqlserver')") y [seguridad-http.test.ts:128](../../../apps/api/test/entorno/seguridad-http.test.ts#L128 "toBe(500)").
- `/health` responde 503 cuando el SP de salud falla ([sistema.service.ts:65](../../../apps/api/src/modules/sistema/sistema.service.ts#L65 "return 'caido'")); el healthcheck de Docker, con 3 s de límite, marca la réplica como no saludable. nginx no consulta `/health` y no reintenta un 503, así que no la saca de la rotación por eso (con la base caída las dos réplicas fallan igual).
- Las tareas periódicas fallan, se registran y se reintentan en su siguiente turno; nada queda a medias porque cada SP es una transacción con `XACT_ABORT`.

## Alternativas descartadas

- **Gateway separado delante de nginx** → un contenedor más sin beneficio (A-03).
- **`deploy.replicas: 2`** → nginx resuelve los nombres al arrancar y se pierde `X-Instancia` por réplica; se usan `api-1` y `api-2` explícitas (01 §3).
- **Resolver nombres por el DNS de Docker** → con un contenedor detenido devolvía una IP pública (A-03).
- **`proxy_next_upstream ... non_idempotent`** → reenviaría un POST de pago ya recibido a la otra réplica.
- **Caché HTTP de nginx (`proxy_cache`)** → saltaría la autenticación y no permite invalidar por evento (01 §3).
- **Kubernetes** → diferido (D-04); cada servicio se traduce a un `Deployment`, `Job` o `StatefulSet` sin cambiar el código.
- **Punto único de falla reconocido:** un solo nginx. En producción, un Ingress con réplicas o un balanceador administrado (01 §3).

## Preguntas probables

### ¿Cómo se garantiza el orden de arranque?
Con `depends_on` y condiciones: el migrador espera a SQL Server saludable, las réplicas al migrador terminado y a Redis saludable, nginx a las dos réplicas saludables.
**Muéstralo en:** [docker-compose.yml:41](../../../docker-compose.yml#L41 "condition: service_completed_successfully")

### ¿Por qué IPs fijas y `extra_hosts` si Docker tiene DNS?
Con un contenedor detenido, el DNS de Docker reenvía el nombre al del host, que puede devolver una IP pública. Con `/etc/hosts` el nombre nunca sale de la subred.
**Muéstralo en:** [docker-compose.yml:47](../../../docker-compose.yml#L47 "extra_hosts:")

### Si apago api-1 a mitad de un pago, ¿se cobra dos veces?
No. nginx no reenvía un POST ya enviado (sin `non_idempotent`), y si el cliente reintenta, la misma `Idempotency-Key` devuelve el mismo pedido gracias al `UNIQUE` en SQL Server.
**Muéstralo en:** [nginx.conf:71](../../../infra/nginx/nginx.conf#L71 "proxy_next_upstream       error timeout")

### ¿Por qué 250 ms de timeout de conexión?
Una conexión sana tarda 1 ms o menos; la IP de una réplica detenida no rechaza sino que se cuelga, y sin el límite cada petición esperaría el valor por defecto de nginx.
**Muéstralo en:** [nginx.conf:64](../../../infra/nginx/nginx.conf#L64 "250 ms: una conexión sana")

### ¿Qué pasa si Redis se cae en plena demo?
Se sigue vendiendo: `/health` dice `degradado`, el rate limiting pasa a memoria por réplica y la caché va a la base. Stock e idempotencia nunca dependieron de Redis.
**Muéstralo en:** [rnf2.test.ts:79](../../../apps/api/test/entorno/rnf2.test.ts#L79 "compose('stop', 'redis')")

### ¿Algún contenedor corre como root?
La API y el migrador corren como `node`, Redis como `redis`, SQL Server con su usuario propio; lo prueba un test que lee el UID del PID 1. Solo `otel-lgtm` (opcional, de desarrollo) es root y solo se publica en `127.0.0.1`.
**Muéstralo en:** [contenedores.test.ts:15](../../../apps/api/test/entorno/contenedores.test.ts#L15 "el proceso principal de %s no corre como root")

### ¿Qué hace la réplica al recibir SIGTERM?
Cierra los streams SSE, deja de aceptar conexiones, espera las peticiones en curso, cierra tareas, pool, Redis y telemetría, y sale con 0; si tarda más de 10 s fuerza la salida con 1.
**Muéstralo en:** [apagado.ts:63](../../../apps/api/src/apagado.ts#L63 "servidor.close(")

### ¿Por qué todas las imágenes llevan digest?
Una etiqueta como `24-alpine` se mueve sola: el mismo `docker compose up --build` podría construir otra cosa mañana. Con versión exacta y digest, el entorno es el que pasó las suites, y una actualización es un cambio a propósito, con su commit, que vuelve a correr todo.
**Muéstralo en:** [penalizaciones.test.ts:257](../../../database/migrator/test/penalizaciones.test.ts#L257 "toda imagen base de los Dockerfile tiene versión exacta y digest")

### ¿Por qué el healthcheck de SQL Server ejecuta un `SELECT 1` si el backend no puede escribir SQL?
Es infraestructura, no backend: `sqlcmd` necesita una consulta trivial para saber que el motor acepta conexiones. La API solo ejecuta `SP_Sistema_Health`.
**Muéstralo en:** [docker-compose.yml:83](../../../docker-compose.yml#L83 "Healthcheck de infraestructura, no del backend")

### ¿Cómo comparte la exportación una réplica con la otra?
Las dos montan el mismo volumen `exportaciones`; la cola y el arrendamiento viven en SQL Server (A-24).
**Muéstralo en:** [docker-compose.yml:55](../../../docker-compose.yml#L55 "exportaciones:/var/lib/shopcart/exportaciones")

### ¿Cuál es el punto único de falla?
nginx: si cae, cae todo. Está reconocido en la arquitectura; en producción se reemplaza por un Ingress con réplicas o un balanceador administrado.
**Muéstralo en:** [nginx.conf:1](../../../infra/nginx/nginx.conf#L1 "nginx es el balanceador de carga")
