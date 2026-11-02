# Plan E6-H03 · Cancelación con reembolso

Referencias: N-09, N-03, N-08, A-04, A-13, 01 §6.4 y §8, 02 (`Reembolso`, `Pedido.MontoReembolsado`). Decisiones del PO del cierre de E5 (backlog E6-H03).

## 1. Endpoints

| Ruta | Rol | Qué hace |
|---|---|---|
| `POST /pedidos/:id/cancelar {motivo}` | Cliente (pedido propio; uno ajeno → 404) | Cancela y procesa el reembolso |
| `POST /admin/pedidos/:id/cancelar {motivo}` | Operador, Admin | Lo mismo desde la gestión |
| `GET /admin/reembolsos?estado=&pagina=&tamano=` | Admin | Lista paginada (la de `Fallido` es la lista para resolver a mano) |
| `POST /admin/reembolsos/:id/reintentar` | Admin | Vuelve a `Pendiente` un `Fallido` y lo procesa ya; uno `Completado` se devuelve tal cual |

El motivo es obligatorio (`textoNvarchar(250)`, sin vacíos). La respuesta es el pedido (`Cancelado`) con el estado de su reembolso.

## 2. `SP_Pedidos_Cancelar` (una transacción)

Orden de bloqueo: **pedido → variantes (por `IDVariante`, dentro de `SP_Inventario_RegistrarMovimiento`) → cupón → intento**. Ningún otro SP espera un pedido mientras retiene una variante, un cupón o un intento (`CrearPedido` inserta un pedido nuevo; la conciliación y el pago no bloquean pedidos), así que no hay ciclo.

1. Actor: el Cliente dueño (`@IDUsuarioActor`; si no es suyo → `50001`, igual que inexistente), o un Operador o Admin.
2. `UPDLOCK` sobre el pedido; solo desde `Pagado` o `EnPreparacion`. En otro estado → `50702 NO_CANCELABLE`, incluida una segunda cancelación: **dos cancelaciones simultáneas → una cancela y la otra recibe 409**, y hay un solo reembolso (`UX_Reembolso_CancelacionPorPedido` es la última defensa).
3. Estado `Cancelado` y su historial (el trigger exige la transición para el rol).
4. `ReingresoCancelacion` por línea con `SP_Inventario_RegistrarMovimiento` (el único que escribe el kardex), en orden de `IDVariante`.
5. `UsoCupon` `Confirmado → Revertido` y `UsosComprometidos − 1` (aunque el cupón haya vencido), con el nuevo interno `SP_Cupones_RevertirUso`.
6. **Intento de pago del pedido:**
   - `Capturado` → normal: se reembolsa.
   - `Autorizado` (captura fallida, pendiente de conciliación) → el intento pasa a `Anulado` (`PEDIDO_CANCELADO`) con un `TokenArrendamiento` nuevo. La conciliación ya no lo toma, y si lo tenía tomado su compare-and-set falla: **la conciliación nunca captura el cobro de un pedido cancelado**. Además, `SP_Checkout_ResolverIntentoConciliado` rechaza `Capturado` si el pedido está `Cancelado`.
7. `INSERT Reembolso` (`Origen = 'Cancelacion'`, `Estado = 'Pendiente'`, `Monto = Total − MontoReembolsado`, envío incluido, `FechaProximoIntento = ahora`), con una **llave determinista**: `HASHBYTES('MD5', 'Reembolso|<IDPedido>|Cancelacion')` como `UNIQUEIDENTIFIER`. Todos los reintentos (la petición, el Admin y el job) envían la misma llave, y la pasarela es idempotente por llave.
8. `Pedido.MontoReembolsado += Monto`: es el contador con `CHECK (MontoReembolsado BETWEEN 0 AND Total)` (A-13). Se compromete en la misma transacción, así una devolución concurrente (E6-H04) nunca suma más que lo pagado.

## 3. Devolver el dinero (después del commit)

El servicio `procesarReembolso(idReembolso)` se usa en tres lugares: la petición que cancela, el reintento del Admin y el job.

1. `SP_Pedidos_TomarReembolso`: si está `Pendiente`, lo arrienda (`FechaProximoIntento = ahora + 5 min`). Si no, no hace nada. Devuelve la llave, el monto, la transacción del intento y la llave del intento.
2. Para una cancelación, se consulta la verdad de la pasarela (`consultar(llave del intento)`):
   - `Autorizada` → `anular`: se devuelve sin reembolsar.
   - `Anulada` → ya está.
   - `Capturada` → `reembolsar(llave del reembolso, transacción, monto)`. Esto cubre la carrera en la que la conciliación o el pago capturaron justo antes de que la cancelación los cercara.
3. `SP_Pedidos_ActualizarReembolso`:
   - Éxito → `Completado` (con la transacción del reembolso, o `NULL` si fue una anulación) y `FechaCompletado`.
   - Falla → `Intentos + 1` y `UltimoError`; al quinto intento → `Fallido`.
4. Si la pasarela falla, **la cancelación se mantiene** y el reembolso queda `Pendiente`.

**Revisión de la épica:** cada toma genera un `TokenReclamo` (V016). Un fallo solo se registra con el reclamo vigente, así un proceso desplazado no suma intentos. Un éxito de la pasarela deja el reembolso `Completado` aunque ya estuviera `Fallido`. El reintento del Admin no toca un `Pendiente` que otro proceso tiene tomado. Si la base falla después del commit, la respuesta refleja la cancelación o la devolución con el reembolso `Pendiente`.

## 4. Job (Should, incluido)

`Pedidos.ReintentarReembolsos` cada 5 min:
- `SP_Pedidos_ObtenerReembolsosPendientes` corre con `sp_getapplock` y rol `Sistema`. Toma los `Pendiente` con `FechaProximoIntento <= ahora`, como máximo 50, y les mueve `FechaProximoIntento` (reclamo).
- Después procesa cada uno con el servicio. Cinco fallos → `Fallido`, y queda en la lista del Admin.

## 5. Códigos

Reutiliza `NO_CANCELABLE` (50702), `NO_ENCONTRADO` (50001), `INVARIANTE_INTERNA` (50005) y `LLAVE_REUTILIZADA` (de la pasarela). `PEDIDO_CANCELADO` solo se guarda como `CodigoRespuesta` del intento; no es un error de la API.

## 6. Pruebas (TDD)

- Desde `Pagado` y desde `EnPreparacion`: `Cancelado`, historial, `ReingresoCancelacion` por línea con la existencia restituida, conciliación de inventario vacía, cupón `Revertido` con su contador − 1, reembolso `Completado` y pasarela con el reembolso.
- Desde `Despachado` → `409 NO_CANCELABLE`. Motivo vacío → 400. Pedido ajeno → 404.
- Pasarela caída al reembolsar: la cancelación se mantiene y el reembolso queda `Pendiente` con `Intentos = 1`. El reintento del Admin lo completa con la **misma llave** (un solo reembolso en la pasarela).
- Repetir la cancelación → 409 y un solo reembolso. Dos simultáneas → [200, 409] y un solo reembolso.
- Captura pendiente (`Autorizado`): cancelar anula la autorización (pasarela `Anulada`, sin reembolso) y la conciliación posterior no captura nada.
- Carrera: la conciliación captura después de que la cancelación cercó el intento → el reembolso detecta `Capturada` y reembolsa.
- Job: cinco fallos → `Fallido` y aparece en `GET /admin/reembolsos?estado=Fallido`. Corre con `sp_getapplock`: si la otra réplica tiene el bloqueo, devuelve `null`.
- `MontoReembolsado` nunca supera el total: el `CHECK` rechaza un exceso directo (prueba de esquema).

## 7. Verificación contra las decisiones del PO

| Decisión | Dónde |
|---|---|
| Reembolso `Pendiente` en la misma transacción; la pasarela después del commit | §2.7, §3 |
| Llave determinista por reembolso | §2.7 |
| Captura no hecha → anular en vez de reembolsar; la conciliación nunca captura un cancelado | §2.6, §3.2 |
| Job cada 5 min con `sp_getapplock`, 5 intentos → `Fallido` | §4 |
| Dos cancelaciones simultáneas: una cancelación, un reembolso | §2.2 |
| `MontoReembolsado` ≤ lo capturado (contador con `CHECK`) | §2.8 |
