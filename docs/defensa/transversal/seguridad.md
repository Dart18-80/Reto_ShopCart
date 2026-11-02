# Seguridad

## Qué decide

La identidad viaja en un **access JWT corto** (15 min, en el encabezado `Authorization`) y un **refresh opaco** en una cookie `httpOnly` que rota por familia y detecta el reúso (A-07). Las contraseñas se guardan con **argon2id**. El **aislamiento entre clientes** (RF-01) no depende del cliente: el `IDUsuario` sale del token y los SPs filtran por él, y un recurso ajeno responde `404`. Los datos de tarjeta nunca se guardan ni se registran, los secretos solo viven en `.env`, los contenedores corren sin root y las exportaciones, el SSE y las trazas tienen sus propias defensas.

## Autenticación: JWT + refresh (A-07)

| Pieza | Qué hace | Dónde |
| --- | --- | --- |
| Access token | HS256, vence en 15 min, lleva `sub`, `rol`, `jti` y `versionSesion` | [token-acceso.ts:8](../../../apps/api/src/shared/http/token-acceso.ts#L8 "export const VIGENCIA_ACCESO_SEG = 15 * 60;") |
| Verificación | Solo HS256 (rechaza `alg: none` y otros algoritmos) y exige `exp`, `iat`, `jti`, `sub` | [token-acceso.ts:77](../../../apps/api/src/shared/http/token-acceso.ts#L77 "algorithms: [ALGORITMO]") |
| Rol `Sistema` | Ningún token puede traerlo: solo `Cliente`, `Operador`, `Administrador` | [token-acceso.ts:14](../../../apps/api/src/shared/http/token-acceso.ts#L14 "export const ROLES_DE_USUARIO = ['Cliente', 'Operador', 'Administrador']") |
| Middleware `autenticar` | Verifica el token y la versión de sesión, y deja al usuario en el contexto | [autenticar.ts:43](../../../apps/api/src/shared/http/autenticar.ts#L43 "export function crearAutenticar") |
| Revocación inmediata | Si el usuario se desactivó, cambió de rol o de contraseña, su versión de sesión sube y el token viejo responde 401 | [autenticar.ts:47](../../../apps/api/src/shared/http/autenticar.ts#L47 "await sesionRevocada(actor, versiones)") |
| Autorización por rol | `autorizar(...roles)` después de `autenticar`: 401 sin sesión, 403 con otro rol | [autenticar.ts:79](../../../apps/api/src/shared/http/autenticar.ts#L79 "export function autorizar(...roles: Rol[])") |
| Refresh token | 256 bits aleatorios; en la base solo su SHA-256 | [token-opaco.ts:3](../../../apps/api/src/shared/http/token-opaco.ts#L3 "256 bits aleatorios; en la base solo se guarda su SHA-256") |
| Rotación y reúso | Un refresh ya usado revoca **toda la familia** y responde `401 REFRESH_REUTILIZADO` | [R__SP_Auth_RotarRefreshToken.sql:42](../../../database/programmability/R__SP_Auth_RotarRefreshToken.sql#L42 "WHERE  IDFamilia = @IDFamilia AND FechaRevocacion IS NULL") |

- Dos refresh simultáneos con el mismo token se serializan con `UPDLOCK`: el segundo es un reúso ([R__SP_Auth_RotarRefreshToken.sql:29](../../../database/programmability/R__SP_Auth_RotarRefreshToken.sql#L29 "dos refresh con el mismo token se serializan")). Prueba: [casos-borde.api.test.ts:35](../../../apps/api/test/integracion/auth/casos-borde.api.test.ts#L35 "dos refresh simultáneos con el mismo token").
- Pruebas del token: [autenticar.test.ts:180](../../../apps/api/test/unit/shared/http/autenticar.test.ts#L180 "un token sin firma (alg none) responde 401"), [autenticar.test.ts:110](../../../apps/api/test/unit/shared/http/autenticar.test.ts#L110 "A-07: un token con una versión de sesión anterior a la vigente responde 401") y [refresh-logout.api.test.ts:69](../../../apps/api/test/integracion/auth/refresh-logout.api.test.ts#L69 "reusar un token ya rotado revoca toda la familia").

## Cookies `httpOnly` y `SameSite`

- El refresh token va solo en una cookie; el cuerpo lleva el access token ([auth.controller.ts:33](../../../apps/api/src/modules/auth/auth.controller.ts#L33 "res.cookie(COOKIE_REFRESH, sesion.refreshToken, {")):
  - `httpOnly`: JavaScript no la lee, así un XSS no la roba ([auth.controller.ts:34](../../../apps/api/src/modules/auth/auth.controller.ts#L34 "httpOnly: true")).
  - `secure` ([auth.controller.ts:35](../../../apps/api/src/modules/auth/auth.controller.ts#L35 "secure: true")) y `SameSite=Strict`: no viaja en peticiones iniciadas desde otro sitio (CSRF) ([auth.controller.ts:36](../../../apps/api/src/modules/auth/auth.controller.ts#L36 "sameSite: 'strict'")).
  - `path` limitado a `/api/v1/auth`: no viaja al resto de la API ([auth.controller.ts:21](../../../apps/api/src/modules/auth/auth.controller.ts#L21 "RUTA_COOKIE_REFRESH = '/api/v1/auth'")).
- Prueba: [registro-login.api.test.ts:32](../../../apps/api/test/integracion/auth/registro-login.api.test.ts#L32 "deja el refresh token solo en una cookie segura").
- La cookie se lee sin `cookie-parser`, en un objeto sin prototipo: una cookie `__proto__` no contamina `Object.prototype` ([casos-borde.api.test.ts:78](../../../apps/api/test/integracion/auth/casos-borde.api.test.ts#L78 "una cookie llamada __proto__ no rompe la lectura de cookies")).

## Contraseñas: argon2id

- argon2id con 19 MiB de memoria, 2 iteraciones y paralelismo 1, la recomendación de OWASP ([auth.contrasenas.ts:5](../../../apps/api/src/modules/auth/auth.contrasenas.ts#L5 "type: argon2.argon2id")).
- Con un correo inexistente se verifica igual contra un hash de relleno: la respuesta tarda lo mismo y no revela qué correos existen ([auth.contrasenas.ts:25](../../../apps/api/src/modules/auth/auth.contrasenas.ts#L25 "argon2.verify(hash ?? HASH_DE_RELLENO, contrasena)")); el mensaje también es el mismo ([catalogo.ts:20](../../../apps/api/src/shared/errors/catalogo.ts#L20 "CREDENCIALES_INVALIDAS: { http: 401, mensaje: 'Correo o contraseña incorrectos.' }")).
- La bitácora nunca guarda el hash: [bitacora.test.ts:107](../../../apps/api/test/integracion/esquema/bitacora.test.ts#L107 "la creación de un usuario nunca registra su HashContrasena").

## Rate limiting

- Login: 5 por minuto por IP y correo; registro: 3 por minuto por IP ([server.ts:39](../../../apps/api/src/server.ts#L39 "const LIMITE_LOGIN = { intentos: 5, ventanaSeg: 60 };") y [auth.routes.ts:78](../../../apps/api/src/modules/auth/auth.routes.ts#L78 "limitarIntentos(limitadores.login, porIpYCorreo)")). También el cambio de contraseña (por usuario) y las exportaciones.
- Excedido el límite: `429 DEMASIADAS_PETICIONES` con `Retry-After` ([limitar-intentos.ts:17](../../../apps/api/src/shared/http/limitar-intentos.ts#L17 "new AppError('DEMASIADAS_PETICIONES', { segundosParaReintentar })")).
- El contador vive en Redis y lo comparten las réplicas. Si Redis cae, se usa un contador en memoria por réplica: la API no se bloquea, pero el límite efectivo se multiplica por el número de réplicas mientras Redis no responda ([limitador-redis.ts:60](../../../apps/api/src/shared/adapters/limitador-redis.ts#L60 "return consumirEn(enMemoria, clave)")).
- La IP sale de `X-Forwarded-For` porque se confía en un salto de proxy (nginx) ([app.ts:102](../../../apps/api/src/app.ts#L102 "app.set('trust proxy', SALTOS_DE_PROXY_CONFIABLES)")).
- Pruebas: [registro-login.api.test.ts:173](../../../apps/api/test/integracion/auth/registro-login.api.test.ts#L173 "el sexto intento de login en un minuto responde 429 con Retry-After") y [registro-login.api.test.ts:183](../../../apps/api/test/integracion/auth/registro-login.api.test.ts#L183 "el cuarto registro en un minuto desde la misma IP responde 429").

## Aislamiento entre clientes (RF-01)

| Capa | Qué garantiza | Dónde |
| --- | --- | --- |
| Entrada | Ninguna ruta de cliente acepta `idUsuario`, y los cuerpos son `.strict()` | [aislamiento.api.test.ts:262](../../../apps/api/test/integracion/seguridad/aislamiento.api.test.ts#L262 "ninguna ruta de cliente acepta idUsuario en su entrada") |
| `ejecutarSP` | El actor sale siempre del contexto, nunca del llamador | [ejecutar-sp.ts:98](../../../apps/api/src/shared/db/ejecutar-sp.ts#L98 "A-18: el actor sale siempre del contexto de la petición, nunca del llamador (RF-01)") |
| Repositorio | No recibe el ID del cliente | [direcciones.repository.ts:70](../../../apps/api/src/modules/direcciones/direcciones.repository.ts#L70 "RF-01: el dueño sale siempre de @IDUsuarioActor") |
| SP | Filtra por `@IDUsuarioActor`; uno ajeno no devuelve filas | [R__SP_Pedidos_ObtenerDetalle.sql:14](../../../database/programmability/R__SP_Pedidos_ObtenerDetalle.sql#L14 "p.IDUsuario = @IDUsuarioActor") |
| Servicio | Sin filas → `404`, igual que inexistente | [direcciones.service.ts:13](../../../apps/api/src/modules/direcciones/direcciones.service.ts#L13 "RF-01: una dirección ajena responde igual que una inexistente") |

**La prueba de aislamiento** ([aislamiento.api.test.ts](../../../apps/api/test/integracion/seguridad/aislamiento.api.test.ts)) recorre el router real, no una lista escrita a mano:

- Toda ruta declara sus roles o es una pública conocida ([aislamiento.api.test.ts:220](../../../apps/api/test/integracion/seguridad/aislamiento.api.test.ts#L220 "toda ruta declara sus roles o es una de las públicas conocidas")).
- Cada ruta de cliente con un ID tiene su caso; una ruta nueva sin caso hace fallar la prueba ([aislamiento.api.test.ts:226](../../../apps/api/test/integracion/seguridad/aislamiento.api.test.ts#L226 "cada ruta de cliente que recibe un ID tiene su caso de aislamiento")).
- Un intruso pide el pedido, la dirección y la línea del carrito del dueño: cada uno responde `404` con el mismo código que un ID inexistente ([aislamiento.api.test.ts:233](../../../apps/api/test/integracion/seguridad/aislamiento.api.test.ts#L233 "el recurso de otro cliente responde 404, igual que uno inexistente")).
- Y nada del dueño cambió ([aislamiento.api.test.ts:245](../../../apps/api/test/integracion/seguridad/aislamiento.api.test.ts#L245 "los intentos del otro cliente no cambiaron nada del dueño")).

## Encabezados: helmet, CORS y lo que no se revela

- `helmet` con CSP y `frame-ancestors 'none'` ([app.ts:112](../../../apps/api/src/app.ts#L112 "'frame-ancestors'")), sin `X-Powered-By` ([app.ts:100](../../../apps/api/src/app.ts#L100 "app.disable('x-powered-by')")) y nginx sin versión ([nginx.conf:13](../../../infra/nginx/nginx.conf#L13 "server_tokens off")).
- CORS con lista explícita desde `CORS_ORIGINS` y credenciales, nunca `*` ([app.ts:119](../../../apps/api/src/app.ts#L119 "cors({ origin: origenesCors, credentials: true })")).
- Cuerpo JSON limitado a 100 kB ([app.ts:120](../../../apps/api/src/app.ts#L120 "express.json({ limit: LIMITE_CUERPO_JSON })")).
- El `X-Request-Id` que llega solo se acepta si es un UUID ([request-id.ts:15](../../../apps/api/src/shared/http/request-id.ts#L15 "UUID.test(recibido)")).
- Pruebas a través de nginx: [seguridad-http.test.ts:48](../../../apps/api/test/entorno/seguridad-http.test.ts#L48 "lleva los encabezados de helmet"), [seguridad-http.test.ts:82](../../../apps/api/test/entorno/seguridad-http.test.ts#L82 "CORS responde con el origen permitido de la configuración y con credenciales, nunca con *") y [seguridad-http.test.ts:113](../../../apps/api/test/entorno/seguridad-http.test.ts#L113 "un 500 real no trae stack ni detalles internos").

## Tarjeta y CVV: nunca en logs, respuestas ni base

- El cuerpo del pago valida número y CVV con Zod y es estricto ([checkout.schemas.ts:54](../../../apps/api/src/modules/checkout/checkout.schemas.ts#L54 "los datos de la tarjeta solo viajan a la pasarela")).
- Al registrar el intento solo se envían la marca y los últimos 4 dígitos ([checkout.repository.ts:228](../../../apps/api/src/modules/checkout/checkout.repository.ts#L228 "UltimosDigitos: { tipo: sql.Char(4), valor: datos.ultimosDigitos }")); la columna admite exactamente 4 dígitos ([V007__checkout.sql:103](../../../database/migrations/V007__checkout.sql#L103 "CK_IntentoPago_UltimosDigitos CHECK (UltimosDigitos LIKE")). No existe columna para el número completo ni para el CVV, tampoco en la pasarela simulada ([V012__pasarela_simulada.sql:11](../../../database/migrations/V012__pasarela_simulada.sql#L11 "UltimosDigitos         CHAR(4)")).
- pino redacta `numeroTarjeta`, `cvv`, contraseñas, tokens, `authorization` y cookies, también anidados hasta dos niveles ([logger.ts:4](../../../apps/api/src/shared/observability/logger.ts#L4 "const CAMPOS_SENSIBLES = [") y [logger.ts:36](../../../apps/api/src/shared/observability/logger.ts#L36 "redact: { paths: RUTAS_REDACTADAS, censor: '[REDACTADO]' }")).
- Pruebas: [logger.test.ts:18](../../../apps/api/test/unit/shared/observability/logger.test.ts#L18 "redacta contraseñas, tarjeta, CVV, authorization y cookies"), [pago-fallas.api.test.ts:276](../../../apps/api/test/integracion/checkout/pago-fallas.api.test.ts#L276 "el número completo y el CVV nunca aparecen en los logs ni en la respuesta"), [pago-fallas.api.test.ts:301](../../../apps/api/test/integracion/checkout/pago-fallas.api.test.ts#L301 "un cuerpo inválido responde 400 por campo sin repetir el número ni el CVV") y [pasarela-simulada.test.ts:125](../../../apps/api/test/integracion/adaptadores/pasarela-simulada.test.ts#L125 "nunca guarda el número completo de la tarjeta ni el CVV").

## Secretos

- Solo en `.env`, que está en `.gitignore` ([.gitignore:12](../../../.gitignore#L12 ".env")); `.env.example` lleva valores marcados como `EJEMPLO`.
- La configuración exige un `JWT_SECRETO` de al menos 32 caracteres ([index.ts:54](../../../apps/api/src/shared/config/index.ts#L54 "JWT_SECRETO: z.string().min(LARGO_MINIMO_SECRETO_JWT)")) y en `production` rechaza arrancar con los secretos de ejemplo ([index.ts:110](../../../apps/api/src/shared/config/index.ts#L110 "rechazarSecretosDeEjemplo(variables)")).
- La contraseña de Redis no va en la línea de comandos de Compose, que se ve en `docker inspect` ([docker-compose.yml:127](../../../docker-compose.yml#L127 "La contraseña va en una variable y no en la línea de comandos de Compose")).
- **La prueba de secretos:** todo secreto de `.env.example` está marcado como ejemplo y `.env` está ignorado ([secretos.test.ts:15](../../../apps/api/test/unit/secretos.test.ts#L15 "todo secreto de .env.example está marcado como ejemplo") y [secretos.test.ts:27](../../../apps/api/test/unit/secretos.test.ts#L27 ".env (con las credenciales reales) está en .gitignore")).

## Contenedores sin root

- API y migrador: `USER node` ([Dockerfile:30](../../../apps/api/Dockerfile#L30 "USER node") y [Dockerfile:21](../../../database/migrator/Dockerfile#L21 "USER node")). Redis: `user: redis` ([docker-compose.yml:121](../../../docker-compose.yml#L121 "user: redis")). SQL Server: la imagen oficial 2022 corre como el usuario `mssql`.
- Prueba en el entorno real, leyendo el UID del proceso principal de cada contenedor: [contenedores.test.ts:15](../../../apps/api/test/entorno/contenedores.test.ts#L15 "el proceso principal de %s no corre como root").
- La base y Redis solo se publican en `127.0.0.1`.

## Exportaciones: acceso y fórmulas

- Solo el Administrador ([exportaciones.routes.ts:47](../../../apps/api/src/modules/exportaciones/exportaciones.routes.ts#L47 "const soloAdmin = [autenticar, autorizar('Administrador')]")), y solo las propias: el SP filtra por `@IDUsuarioActor` ([R__SP_Exportaciones_Obtener.sql:18](../../../database/programmability/R__SP_Exportaciones_Obtener.sql#L18 "v.IDUsuario = @IDUsuarioActor")).
- Inyección de fórmulas (OWASP): un texto que empieza con `=`, `+`, `-`, `@`, tabulador o retorno de carro se escribe con un apóstrofo delante ([exportaciones.generadores.ts:26](../../../apps/api/src/modules/exportaciones/exportaciones.generadores.ts#L26 "const INICIO_DE_FORMULA") y [exportaciones.generadores.ts:28](../../../apps/api/src/modules/exportaciones/exportaciones.generadores.ts#L28 "export const sinFormula")). Pruebas: [generadores.test.ts:60](../../../apps/api/test/unit/modules/exportaciones/generadores.test.ts#L60 "un texto que empieza como fórmula se escribe como texto con un apóstrofo") y de punta a punta [exportaciones.api.test.ts:269](../../../apps/api/test/integracion/secuencial/exportaciones.api.test.ts#L269 "se exporta como texto, nunca como fórmula").
- Los nombres de archivo los genera el servidor y el almacén rechaza cualquier otro (sin rutas ni `..`) ([almacen-disco.ts:9](../../../apps/api/src/shared/adapters/almacen-disco.ts#L9 "const NOMBRE_VALIDO")).

## SSE del dashboard: el token en `Authorization` (A-25)

- El stream `GET /admin/reportes/eventos` exige el token en el encabezado, nunca en la URL: una URL queda en el log de nginx, en el historial y en el `Referer`. Por eso el cliente usa `fetch` con streaming y no `EventSource` ([reportes.routes.ts:92](../../../apps/api/src/modules/reportes/reportes.routes.ts#L92 "El token va en `Authorization`")).
- El controlador pasa el encabezado al servicio ([reportes.controller.ts:80](../../../apps/api/src/modules/reportes/reportes.controller.ts#L80 "encabezados.authorization")), que vuelve a verificar el token para saber cuándo vence ([reportes.tiempo-real.ts:34](../../../apps/api/src/modules/reportes/reportes.tiempo-real.ts#L34 "await tokens.verificar(token)")) y cierra el stream si la sesión se revoca ([reportes.tiempo-real.ts:40](../../../apps/api/src/modules/reportes/reportes.tiempo-real.ts#L40 "sesionVigente: async () => !(await sesionRevocada(verificado, versiones))")).
- Pruebas: [tiempo-real.api.test.ts:171](../../../apps/api/test/integracion/reportes/tiempo-real.api.test.ts#L171 "sin token responde 401; un Operador o un Cliente, 403"), [reportes.eventos.test.ts:174](../../../apps/api/test/unit/modules/reportes/reportes.eventos.test.ts#L174 "cierra el stream cuando vence el access token") y [tiempo-real.api.test.ts:128](../../../apps/api/test/integracion/reportes/tiempo-real.api.test.ts#L128 "si se revoca la sesión del Admin (cambia su rol), su stream se cierra").

## Trazas sin datos sensibles

- Las trazas no llevan valores de SQL (la instrumentación de tedious solo pone el nombre del SP), argumentos de Redis, encabezados ni cuerpos ([telemetria.ts:91](../../../apps/api/src/shared/observability/telemetria.ts#L91 "Seguridad: las trazas no llevan valores de SQL")). Redis solo registra el nombre del comando ([telemetria.ts:130](../../../apps/api/src/shared/observability/telemetria.ts#L130 "dbStatementSerializer: (comando) => comando")).
- Pruebas con la API instrumentada y un receptor en memoria: [seguridad-trazas.test.ts:142](../../../apps/api/test/telemetria/seguridad-trazas.test.ts#L142 "ningún span ni log lleva contraseñas, tokens, la contraseña de Redis, la tarjeta, el CVV ni encabezados"), [seguridad-trazas.test.ts:172](../../../apps/api/test/telemetria/seguridad-trazas.test.ts#L172 "los spans de SQL solo llevan el nombre del SP") y [seguridad-trazas.test.ts:187](../../../apps/api/test/telemetria/seguridad-trazas.test.ts#L187 "los spans de Redis solo llevan el comando, sin sus argumentos").

## Alternativas descartadas

- **Refresh como JWT** → no se puede revocar; **token en `localStorage`** → expuesto a XSS (A-07).
- **Token del SSE en la URL (`?token=`) para usar `EventSource`** → se filtra en logs, historial y `Referer` (A-25).
- **bcrypt** → argon2id es la recomendación actual de OWASP (resistente a GPU por su costo de memoria).
- **Confiar en un `idUsuario` del cliente y validar dueño en el servicio** → basta un olvido para exponer datos; el dueño sale del token y lo filtra el SP (RF-01, A-18).
- **Rate limiting solo en memoria** → cada réplica llevaría su propio contador; se usa Redis y la memoria solo como respaldo.

## Preguntas probables

### ¿Cómo evitan que un cliente vea el pedido de otro?

El ID del cliente nunca viene en la petición: sale del token y `ejecutarSP` lo agrega como `@IDUsuarioActor`; el SP filtra por él y un pedido ajeno devuelve `404`, igual que uno inexistente.
**Muéstralo en:** [R__SP_Pedidos_ObtenerDetalle.sql:14](../../../database/programmability/R__SP_Pedidos_ObtenerDetalle.sql#L14 "p.IDUsuario = @IDUsuarioActor")

### ¿Cómo saben que no se les olvidó proteger una ruta nueva?

La prueba de aislamiento recorre el router real: una ruta de cliente con ID sin su caso, o una ruta sin roles que no esté en la lista de públicas, hace fallar la prueba.
**Muéstralo en:** [aislamiento.api.test.ts:226](../../../apps/api/test/integracion/seguridad/aislamiento.api.test.ts#L226 "cada ruta de cliente que recibe un ID tiene su caso de aislamiento")

### ¿Por qué `404` y no `403` para un recurso ajeno?

Un `403` confirmaría que el recurso existe; con `404` un atacante no puede enumerar IDs válidos.
**Muéstralo en:** [aislamiento.api.test.ts:233](../../../apps/api/test/integracion/seguridad/aislamiento.api.test.ts#L233 "el recurso de otro cliente responde 404, igual que uno inexistente")

### Si roban un refresh token, ¿qué pasa?

Cada uso lo rota. Si el ladrón y el dueño lo usan, el segundo uso es un reúso y se revoca toda la familia: los dos tienen que volver a iniciar sesión.
**Muéstralo en:** [R__SP_Auth_RotarRefreshToken.sql:62](../../../database/programmability/R__SP_Auth_RotarRefreshToken.sql#L62 "THROW 50102")

### Desactivan a un usuario: ¿su access token sigue sirviendo 15 minutos?

No mientras Redis responda: su versión de sesión sube, se publica en Redis y `autenticar` rechaza el token viejo. Si Redis no responde, rige la ventana de 15 minutos (N-15).
**Muéstralo en:** [autenticar.test.ts:110](../../../apps/api/test/unit/shared/http/autenticar.test.ts#L110 "A-07: un token con una versión de sesión anterior a la vigente responde 401")

### ¿Guardan el número de tarjeta o el CVV?

No. Solo marca y últimos 4 dígitos; el número completo y el CVV solo viajan a la pasarela y pino los redacta. Una prueba los busca en logs y respuestas.
**Muéstralo en:** [pago-fallas.api.test.ts:276](../../../apps/api/test/integracion/checkout/pago-fallas.api.test.ts#L276 "el número completo y el CVV nunca aparecen en los logs ni en la respuesta")

### ¿Cómo se protege el login contra fuerza bruta?

5 intentos por minuto por IP y correo, con contador compartido en Redis; el sexto responde `429` con `Retry-After`. Además argon2id hace cara cada verificación.
**Muéstralo en:** [registro-login.api.test.ts:173](../../../apps/api/test/integracion/auth/registro-login.api.test.ts#L173 "el sexto intento de login en un minuto responde 429 con Retry-After")

### ¿Por qué el refresh en cookie y el access token no?

El refresh vive 7 días y debe ser inaccesible a JavaScript (`httpOnly`). El access token vive 15 minutos, sale en el cuerpo de la respuesta y viaja en `Authorization`, así la API no autoriza con cookies y sus endpoints no quedan expuestos a CSRF. (A-07 fija que el frontend lo guarde en memoria; el frontend es de la Fase 2: hoy `apps/web` no tiene código fuente.)
**Muéstralo en:** [auth.controller.ts:34](../../../apps/api/src/modules/auth/auth.controller.ts#L34 "httpOnly: true")

### ¿Hay credenciales en el repositorio?

No: solo `.env.example` con valores marcados `EJEMPLO`, y una prueba lo verifica; en `production` la API se niega a arrancar con ellos.
**Muéstralo en:** [secretos.test.ts:15](../../../apps/api/test/unit/secretos.test.ts#L15 "todo secreto de .env.example está marcado como ejemplo")

### Un producto se llama `=HYPERLINK(...)`. ¿Qué pasa al exportarlo a Excel?

Se escribe con un apóstrofo delante, así Excel lo muestra como texto y no ejecuta la fórmula.
**Muéstralo en:** [exportaciones.generadores.ts:28](../../../apps/api/src/modules/exportaciones/exportaciones.generadores.ts#L28 "export const sinFormula")

### ¿Por qué el SSE no usa `EventSource`?

`EventSource` no envía encabezados, y poner el token en la URL lo dejaría en el log de nginx y en el historial. Se usa `fetch` con el cuerpo como stream y el token en `Authorization`.
**Muéstralo en:** [reportes.routes.ts:92](../../../apps/api/src/modules/reportes/reportes.routes.ts#L92 "El token va en `Authorization`")

### Un error interno, ¿le muestra el stack al cliente?

No, ni en `development`: responde `500 ERROR_INTERNO` con un mensaje genérico y el `requestId`; el detalle va solo al log.
**Muéstralo en:** [seguridad-http.test.ts:113](../../../apps/api/test/entorno/seguridad-http.test.ts#L113 "un 500 real no trae stack ni detalles internos")
