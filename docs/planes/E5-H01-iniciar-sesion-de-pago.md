# Plan E5-H01 · Iniciar la sesión de pago

Estado: **aprobado por el PO** (decisiones en la sección 10).
Referencias: 01 §6.1 y §6.6, RF-06, N-01, N-02, N-05, N-06, N-12, A-13, M-04.

## 1. Alcance

| Ruta | Rol | Qué hace |
|---|---|---|
| `POST /checkout/sesion {idDireccion, idMetodoEnvio}` | Cliente | Crea la sesión de pago, o devuelve la activa si el contenido no cambió |
| `GET /checkout/sesion` | Cliente | La sesión activa del cliente (404 si no tiene) |
| `DELETE /checkout/sesion` | Cliente | Cancela la sesión activa y libera todo lo que tenía apartado |

Un invitado recibe 401 y el Operador o el Admin, 403. El cliente nunca envía el ID de la sesión ni del carrito: los dos salen del token.

## 2. Objetos de base de datos

| Objeto | Tipo | Qué hace |
|---|---|---|
| `SP_Checkout_IniciarSesion` | SP | El flujo de la sección 3, en una sola transacción |
| `SP_Checkout_ObtenerSesion` | SP | La sesión activa del cliente con sus líneas (lectura) |
| `SP_Checkout_CancelarSesion` | SP | `DELETE`: bloquea carrito → sesión y llama a `SP_Checkout_CancelarSesionActiva` |
| `SP_Checkout_CancelarSesionActiva` | SP interno (ya existe) | Pasa a llamar a los dos SPs de liberación. **No queda otra ruta de liberación** |
| `SP_Inventario_LiberarReservas(@IDSesionCheckout)` | SP interno, nuevo | Reservas `Activa` → `Liberada`. Lo usan la cancelación, la expiración (E5-H04) y el quinto rechazo (E5-H03) |
| `SP_Cupones_LiberarUso(@IDSesionCheckout)` | SP interno, nuevo | `UsoCupon` `Reservado` → `Liberado` y `UsosComprometidos − 1`, con el cupón bloqueado |
| `SP_Cupones_ReservarUso(@IDCupon, @IDSesionCheckout, @Monto)` | SP interno, nuevo | `UsosComprometidos + 1` (el CHECK de A-13 es la autoridad) e `INSERT UsoCupon` (`Reservado`) |
| `FU_Carrito_Lineas` | Función (cambio) | Agrega `IDPrecioVarianteEfectivo`: la versión de precio que se cobra (la garantizada si es la menor y sigue vigente; si no, la vigente) |
| `FU_Checkout_ContenidoCarrito(@IDCarrito, @IDCupon, @IDMetodoEnvio, @IDDireccion)` | Función nueva | El JSON canónico del contenido, ordenado por `IDVariante`, con el que se calcula `HashContenido` (sección 4) |

**Códigos de error:** se usan los existentes:

| Código | Cuándo |
|---|---|
| 50403 `CARRITO_VACIO` | No hay carrito o no tiene líneas |
| 50402 `LINEAS_NO_DISPONIBLES` | Alguna línea está `NoDisponible`. `detalles`: las líneas |
| 50301 `STOCK_INSUFICIENTE` | Alguna línea no alcanza. `detalles`: las líneas con su disponible |
| 505xx | Cada causa de rechazo del cupón |
| 50602 `PAGO_EN_CURSO` | La sesión anterior tiene un pago en curso |
| 50001 | Dirección o método de envío inexistente, ajeno o inactivo |
| 50002 | Violación de `UX_SesionCheckout_ActivaPorUsuario`. Es la última defensa; el bloqueo del carrito ya la evita |

No se necesitan códigos nuevos.

## 3. Flujo de `SP_Checkout_IniciarSesion` y orden de bloqueo

Orden global (01 §6.6): **carrito → variantes por `IDVariante` → sesión → cupón**. Todo ocurre dentro de una transacción.

1. **Carrito.** `SP_Carrito_BloquearActivo(@IDUsuarioActor)`. Sin carrito o sin líneas: 50403.
   - Este bloqueo **serializa todo lo que el cliente hace con su checkout**: iniciar, cancelar, pagar y fusionar.
2. **Variantes.** Ciclo explícito que bloquea con `UPDLOCK, ROWLOCK`, en orden de `IDVariante`, las variantes de todas las líneas (skill §9.1).
   - Con las variantes bloqueadas, los precios y el disponible quedan estables: `SP_Catalogo_CambiarPrecio` también bloquea la variante.
3. **Instantánea.** Se lee el carrito con `FU_Carrito_Lineas` y `FU_Cupones_CalculoDescuento` (si tiene cupón):
   - precio efectivo y su versión, descuento por línea y subtotal;
   - el costo de envío con `FU_Envios_Costos` (envío gratis sobre el subtotal comprable después del cupón);
   - la dirección del cliente, con `WHERE IDDireccion = @IDDireccion AND IDUsuario = @IDUsuarioActor` (una ajena responde 404, RF-01).

   Con eso se calcula `HashContenido` (sección 4).
4. **Sesión anterior.** `SELECT … WITH (UPDLOCK, ROWLOCK)` de la sesión `Activa` del cliente.
   - Si existe, tiene el mismo `HashContenido` y `FechaExpiracion > SYSUTCDATETIME()`: se devuelve tal cual (`COMMIT`, **200**). No se reserva nada otra vez.
   - Si existe y difiere (o venció sin que el job la marcara): si tiene un intento de pago en curso (`Pendiente` o `Autorizado`), responde 50602 `PAGO_EN_CURSO` y no se toca nada. Si no, `SP_Checkout_CancelarSesionActiva` (sección 6).
5. **Líneas.** Se validan **bajo el bloqueo** de las variantes:
   - Si alguna está `NoDisponible`: 50402 con la lista de líneas.
   - Disponible ≥ cantidad para **todas**. Si alguna falla: 50301 con `[{ idVariante, producto, cantidad, disponible }]` de todas las que fallan. Todo o nada: el `THROW` revierte la transacción, así que no queda ninguna reserva ni la cancelación del paso 4.
6. **Cupón.** Si el carrito tiene cupón:
   - Se bloquea la fila del cupón (`UPDLOCK`).
   - Se revalida con `FU_Cupones_Validar` (cada causa con su código).
   - `SP_Cupones_ReservarUso`: el `CHECK` del contador es la autoridad del límite total. El límite por cliente se cuenta bajo el bloqueo del cupón.
7. **Escritura.** `INSERT` de `SesionCheckout`, con la dirección, el método, el cupón y los montos copiados (M-04), y de `LineaSesionCheckout` (precio, versión de precio y descuento por línea).
   - Una `Reserva` por línea, todas con `FechaExpiracion = SYSUTCDATETIME() + MinutosReserva` (`ParametroSistema`).
8. `COMMIT` y **201** con la sesión.

El servicio no decide nada de esto: llama al SP y traduce 200/201.

## 4. ¿Cómo se detecta que "el carrito no cambió"?

- `HashContenido = HASHBYTES('SHA2_256', <JSON canónico>)`, calculado **en el SP, bajo los bloqueos del paso 2**. El JSON lo arma `FU_Checkout_ContenidoCarrito` con `FOR JSON PATH`, ordenado por `IDVariante`, e incluye:
  - por línea: `IDVariante`, `Cantidad`, `IDPrecioVarianteEfectivo`, `PrecioUnitario` y `DescuentoLinea`;
  - `IDCupon`, `IDMetodoEnvio`, el `CostoEnvio` calculado, `IDDireccion` y los campos de la dirección que se copian.
- Por qué entran el precio y el descuento: N-02 dice que el cliente "puede volver al carrito y reiniciar el pago para obtener la baja". Si el hash solo tuviera variantes y cantidades, una baja de precio devolvería la sesión vieja con el precio viejo.
- Por qué entran el costo de envío y la dirección: un cambio de tarifa o de la dirección guardada también es otra compra.
- No entran las fechas ni la existencia: que cambie el stock no es "otro contenido". El stock se valida al reservar.

## 5. Si el cupón dejó de ser válido o el precio cambió entre el carrito y el inicio

- **Cupón inválido:** el SP responde **su código de rechazo (422)** y no reserva nada.
  - No lo quita del carrito: la transacción se revierte.
  - El cliente vuelve al carrito, y `GET /carrito` lo quita con el aviso del motivo (N-12).
  - No se inicia un pago con un monto distinto del que el cliente vio sin decírselo.
- **Precio cambiado:** la sesión se calcula con el precio efectivo **en ese instante y bajo el bloqueo**, con las mismas reglas que el carrito:
  - Con la garantía vigente, manda el menor.
  - Con la garantía vencida, manda el vigente; `GET /carrito` muestra la alerta "cambió de Q… a Q…".
  - La respuesta trae los precios y el total congelados, que son lo que se cobra (N-02). Nada se cobra al iniciar: el cliente ve el total antes del pago (E5-H03).
- **Alternativa que descarto (decisión 1):** que el cliente envíe el total que vio y responder 409 si cambió. Agrega un campo al contrato y la sesión ya muestra el total antes de cobrar.

## 6. ¿Cómo se libera todo al cancelar la sesión anterior?

Hay una sola ruta: `SP_Checkout_CancelarSesionActiva(@IDUsuario)`, interno y dentro de la transacción del llamador. Bloquea la sesión y luego:

1. `SP_Inventario_LiberarReservas(@IDSesionCheckout)`: `Reserva` `Activa` → `Liberada` con `FechaCierre`.
   - No necesita bloquear las variantes: liberar solo aumenta el disponible (skill §9.1).
   - En este flujo las variantes ya están bloqueadas, así que el disponible calculado en el paso 5 ya cuenta lo liberado.
2. `SP_Cupones_LiberarUso(@IDSesionCheckout)`: `UsoCupon` `Reservado` → `Liberado`, y `UsosComprometidos − 1` con el cupón bloqueado.
   - El orden carrito → variantes → sesión → cupón se mantiene.
3. `SesionCheckout` → `Cancelada`, con `FechaCierre`.

La usan cuatro caminos: el `POST` con contenido distinto, el `DELETE`, la fusión del carrito (E4-H03) y, en E5-H03, el quinto rechazo. La expiración (E5-H04) usa los mismos dos SPs de liberación.

**Una sesión con un pago en curso no se cancela:** responde 50602.
- Cancelarla dejaría una autorización sin sesión y un pedido imposible.
- La fusión del login hereda esta regla: si hay un pago en curso, la fusión falla y responde `FusionPendiente`.

## 7. ¿Qué responde ante una línea que no está Disponible?

| Estado de la línea | Respuesta | Detalles |
|---|---|---|
| `NoDisponible` (producto o variante desactivados, o sin precio) | 409 `LINEAS_NO_DISPONIBLES` | `[{ idLinea, idVariante, producto, estado }]` |
| `Agotado` o `CantidadExcedida` | 409 `STOCK_INSUFICIENTE` | `[{ idVariante, producto, cantidad, disponible }]`, todas las que fallan |

- El checkout exige que **todas** las líneas estén `Disponible` (N-06). No hay compra parcial.
- La prevalidación con `FU_Carrito_Lineas` da el mensaje, y la validación **bajo el bloqueo** (paso 5) es la autoridad.
- Si un producto se desactiva después de crear la sesión, la sesión se respeta (N-06).

## 8. Dos POST simultáneos del mismo cliente

- Los dos piden `SP_Carrito_BloquearActivo` (`UPDLOCK, HOLDLOCK`): **el segundo espera** a que el primero haga `COMMIT`.
  - Mismo contenido: el segundo encuentra la sesión del primero con el mismo hash y la devuelve (200). Un solo juego de reservas y un solo uso del cupón.
  - Contenido distinto (por ejemplo, otra dirección): el segundo cancela la del primero y crea la suya (201). Gana el último.
- `UX_SesionCheckout_ActivaPorUsuario` es la última defensa. Si algún camino futuro no bloqueara el carrito, el 2601 se traduce a 50002 (409), nunca 500.
- Entre clientes distintos con variantes en común, el orden por `IDVariante` evita deadlocks; `ejecutarSP` reintenta el 1205 si aun así ocurre.

## 9. Pruebas (TDD, integración contra `shopcart_test` salvo indicación)

- **Todo o nada:** 3 líneas, una sin existencia → 409 con el disponible de esa línea, cero reservas y el cupón sin reservar. Se verifica en la base con `SP_Pruebas_*`.
- **Orden de bloqueo:** 10 parejas de clientes, con las mismas dos variantes agregadas en orden inverso, inician a la vez → ningún 500 ni deadlock agotado. La conciliación queda limpia.
- **Cupón:** `UsosComprometidos + 1` y `UsoCupon` `Reservado`. Límite total con 5 clientes simultáneos y 1 uso restante: 1 éxito y 4 con 422 `CUPON_AGOTADO`. Límite por cliente.
- **Congelamiento:** cambiar el precio después de iniciar no cambia la sesión.
- **Reutilización:** el mismo `POST` devuelve el mismo `IDSesionCheckout` (200).
  - Con una cantidad distinta, otra dirección o una baja de precio: sesión nueva, la anterior queda `Cancelada` con sus reservas `Liberada` y su cupón `Liberado` (contador −1).
- **Sesión con un pago en curso:** `POST` con otro contenido y `DELETE` → 409 `PAGO_EN_CURSO`, sin cambios.
- **Líneas no disponibles:** `NoDisponible` → 50402; `Agotado` y `CantidadExcedida` → 50301.
- **Cupón inválido al iniciar** (desactivado entre el carrito y el inicio) → su 422, sin reservas. `GET /carrito` después lo quita con aviso.
- **Concurrencia del mismo cliente:** 5 `POST` simultáneos con el mismo contenido → una sola sesión, un solo juego de reservas y 4 respuestas 200 más una 201.
- **Aislamiento (RF-01):** la dirección de otro cliente → 404.
- **Roles:** invitado 401; Operador y Admin 403.
- **`DELETE`:** cancela y libera. Sin sesión → 404.
- **Unitarias del servicio:** traducción 200/201 y nada de lógica de negocio.

## 10. Decisiones del PO

1. **Aprobado:** el cliente no envía un "total esperado".
2. **Aprobado el contenido del hash.** El SP lo calcula con los datos en orden canónico (por `IDVariante`) y con los decimales en formato fijo (`CONVERT(VARCHAR(20), monto)`, siempre con dos decimales). Prueba: dos carritos iguales (las mismas líneas agregadas en otro orden) dan el mismo hash, y el `POST` reutiliza la sesión.
3. **Aprobado:** una sesión con un pago en curso no se cancela (`409 PAGO_EN_CURSO`). La fusión del login tampoco: se pospone con el aviso `FusionPendiente` y la cookie se conserva.
4. **Aprobado:** `200` al reutilizar y `201` al crear.
