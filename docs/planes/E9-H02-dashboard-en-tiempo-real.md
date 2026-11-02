# Plan E9-H02 · Dashboard en tiempo real con SSE

Historia grande: plan escrito y verificado contra el alcance del PO (§8) antes de implementar.

## 1. Endpoint y decisión A-25

- `GET /api/v1/admin/reportes/eventos`, `autenticar` + `autorizar('Administrador')`, `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`.
- **A-25 (nueva):** el access token viaja en `Authorization`, nunca en la URL. `EventSource` no permite encabezados, así que el frontend usará `fetch` con el cuerpo como stream. Un token en la URL quedaría en el log de nginx, en el historial del navegador y en el `Referer`, y no se puede revocar antes de que venza. Alternativas descartadas: token en la query (las fugas anteriores), una cookie solo para el stream (otra superficie de CSRF y otro mecanismo de sesión) y WebSocket (bidireccional sin necesidad; nginx y el balanceo se complican).

## 2. Canal entre réplicas (Redis pub/sub)

- Puerto nuevo `AvisosDeVersion` (`shared/avisos`): `publicar({ dominio, version })`, que nunca lanza, y `suscribir({ alRecibir, alReconectar })`.
- Adaptador de Redis: publica con el cliente de siempre; se suscribe con **una conexión propia por réplica** (`cliente.duplicate()`, que hereda la contraseña y la base). Valida cada mensaje con Zod. Registra los cambios de estado de la suscripción como el resto de los adaptadores, y avisa `alReconectar` cuando la suscripción vuelve.
- `Cache.incrementar` pasa a devolver la versión nueva (`INCR` ya la devuelve; `null` con Redis caído). `InvalidadorReportes` publica `{ dominio, version }` **después** del commit y del incremento; con `null` no publica.
- Los eventos solo avisan («cambió ventas»): el cliente vuelve a pedir el reporte, que sale de la caché.

## 3. Difusor por réplica (`modules/reportes/reportes.eventos.ts`)

Lo crea `server.ts` (uno por proceso) y lo recibe `crearApp`, igual que el procesador de exportaciones.

- **Conectar:** valida el máximo de conexiones por usuario en la réplica (`MAX_CONEXIONES_POR_USUARIO = 3`, si se pasa: 429 `CONEXIONES_MAXIMAS`, código nuevo del catálogo sin número SQL). Envía un evento inicial `versiones` con las versiones actuales (`Cache.contador`) y `id: ventas3.carritos7`. Si llega `Last-Event-ID` distinto del actual, el dato dice `recargar: true`. Sin campo `retry:`: el cliente usa `fetch` (A-25), no `EventSource`, y decide él cuánto esperar para reconectar.
- **Aviso:** actualiza la versión conocida del dominio y lo difunde como evento `cambio` (`{ dominio, version }`, `id` con las versiones de los dos dominios).
- **Agrupación:** como máximo un evento por dominio cada `VENTANA_AGRUPACION_MS = 2000` por réplica. El primero sale de inmediato; los de la ventana se guardan y al cerrarla sale solo el último.
- **Latido:** comentario SSE (`: latido`) cada `INTERVALO_LATIDO_MS = 15000`. En cada latido se revisa cada conexión: se cierra si su access token venció (`venceEn` del token) o si la versión de sesión del usuario cambió (A-07, la misma regla que `autenticar`).
- **Redis caído:** el stream sigue abierto y sin eventos (el latido continúa). Al volver la suscripción, se envían las versiones actuales a todos.
- **Apagado (SIGTERM):** `cerrarTodas()` antes de `servidor.close()`. Si no, las conexiones abiertas impedirían cerrar y el cliente no reconectaría a la otra réplica.
- **Trazas (E9-H01):** un span `sse.difundir` por evento, con el dominio, la versión y cuántos clientes lo recibieron. La conexión es su propio span HTTP.
- `TokensAcceso.verificar` devuelve también `venceEn` (del `exp` del JWT); el handler lo lee del token de la petición.

## 4. nginx

`location = /api/v1/admin/reportes/eventos`, solo para esta ruta: `proxy_buffering off`, `proxy_cache off` y `proxy_read_timeout 1h`. El resto igual que `/api/`: upstream, encabezados y `proxy_next_upstream`.

## 5. Pruebas

| Caso | Tipo |
|---|---|
| Evento inicial con las versiones y su `id`; `recargar` según `Last-Event-ID` | Unitaria (difusor) |
| Un aviso llega como `cambio` con la versión en el `id` | Unitaria |
| Ráfaga: un evento por dominio por ventana, y el último al cerrarla | Unitaria (timers falsos) |
| Latido; cierre al vencer el token y al cambiar la versión de sesión | Unitaria |
| 429 al pasar el máximo; se libera al desconectar | Unitaria + integración |
| `cerrarTodas` en el apagado; el apagado cierra los streams antes del servidor | Unitaria (difusor y `apagado.ts`) |
| Al volver Redis se envían las versiones actuales | Unitaria |
| El invalidador publica después del incremento, y nada con Redis caído | Unitaria |
| Un pedido creado en una réplica llega como evento a un cliente conectado a la otra (dos apps con Redis real) | Integración |
| 401 sin token; 403 Operador y Cliente | Integración |
| A través de nginx: el stream llega sin buffering; con Redis detenido sigue abierto y al volver llegan las versiones; detener la réplica cierra el stream | Entorno |
| Span `sse.difundir` | Unitaria (telemetría en memoria) |

## 6. Documentación

A-25 en 01 §13 y el endpoint en 01 §5.2; 01 §9 (los avisos del canal); `CONEXIONES_MAXIMAS` en 02 §8 y en el catálogo; README (el endpoint y cómo probarlo con `curl -N`).

## 7. Verificación contra el alcance

| Pedido del PO | Sección |
|---|---|
| Endpoint solo Admin, `text/event-stream`, token en `Authorization` y A-25 | §1 |
| Redis pub/sub, una conexión de suscripción por réplica, publicar después del commit, solo avisos | §2 |
| Evento inicial con las versiones y versión como `id` (`Last-Event-ID`) | §3 |
| Agrupación por dominio con una constante con nombre | §3 |
| Latido; cierre al vencer el token y al cambiar la versión de sesión; 429 por usuario y réplica; cierre en SIGTERM | §3 |
| nginx: `location` propia sin buffering y timeout largo | §4 |
| Redis caído: abierto sin eventos, log de cambio de estado; al volver, las versiones | §2, §3 |
| Pruebas pedidas y spans de E9-H01 | §5, §3 |
