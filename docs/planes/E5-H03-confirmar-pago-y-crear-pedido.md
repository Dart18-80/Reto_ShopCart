# Plan E5-H03 · Confirmar el pago y crear el pedido

Estado: **aprobado por el PO con cambios** (sección 14: las decisiones y los cambios A, B y C, que mandan sobre las secciones anteriores). Depende de E5-H01 (sesión) y E5-H02 (puerto `PasarelaPago` y `PasarelaSimulada`).
Referencias: 01 §6.2 y §6.6, RF-06, N-01, N-03, N-07, N-08, N-18, A-12, A-13, M-03, M-04.

## 1. Alcance y piezas

`POST /checkout/sesion/pagos` (Cliente), con el header `Idempotency-Key` (UUID) **obligatorio**: si falta o no es UUID, responde 400. El cuerpo lleva los datos de tarjeta de la pasarela simulada. Ni el número completo ni el CVV se guardan ni se registran (E5-H02).

| Objeto | Tipo | Qué hace |
|---|---|---|
| `SP_Checkout_RegistrarIntentoPago` | SP | Candado de idempotencia y registro del intento (secciones 2 y 3) |
| `SP_Checkout_ActualizarIntentoPago` | SP | Pasa el intento a `Autorizado`, `Rechazado`, `Anulado`, `Capturado` o `Error`; cuenta los rechazos (sección 10) |
| `SP_Pedidos_CrearPedido` | SP | La transacción atómica de RF-06 (sección 5) |
| `FU_Sistema_FechaLocal(@FechaUtc)` | Función nueva | La fecha de Guatemala (UTC−6, sin horario de verano). La usan `CrearPedido` y las pruebas de medianoche |
| `CheckoutService.pagar` | Servicio | Orquesta los SPs y la pasarela. Ninguna llamada externa ocurre dentro de una transacción |
| `shared/http/idempotencia.ts` | Middleware | Lee y valida `Idempotency-Key` (UUID). Es reutilizable (sección 12) |

## 2. ¿Dónde y cómo se guarda la llave?

- En `IntentoPago.LlaveIdempotencia` (`UNIQUEIDENTIFIER`, `UQ_IntentoPago_LlaveIdempotencia`). El `UNIQUE` es la autoridad: el segundo `INSERT` falla aunque otra regla falle.
- **`HashSolicitud`** (`BINARY(32)`) se calcula en el servicio: el SHA-256 del JSON canónico `{ marca, ultimosDigitos, mesVencimiento, anioVencimiento }`.
  - **No incluye el número completo ni el CVV:** un hash sin clave de un número de tarjeta se puede revertir por fuerza bruta. Ver la decisión 2.
  - La sesión y el monto no van en el hash, pero el SP los compara aparte: el intento guarda `IDSesionCheckout` y `Monto`.
- `SP_Checkout_RegistrarIntentoPago` busca la llave con `WITH (UPDLOCK, HOLDLOCK)` (skill §9.3; bloquea también el hueco de una llave nueva). Según lo que encuentra:

| Situación | Respuesta |
|---|---|
| Llave de otro cliente, de otra sesión o con otro hash | 422 `LLAVE_REUTILIZADA` (no se revela de quién es) |
| Misma llave y mismo contenido | El resultado guardado, sin repetir efectos (tabla de la sección 3) |
| Llave nueva | Se valida la sesión y se inserta el intento `Pendiente` (sección 4) |

## 3. Misma llave mientras el primer intento sigue en curso, y lo que se devuelve después

El intento que encontró la llave decide la respuesta:

| Estado del intento | Respuesta |
|---|---|
| `Pendiente` actualizado hace menos de `@SegundosEnCurso` (30 s, mayor que el timeout de la pasarela) | **409 `PAGO_EN_CURSO`** con `Retry-After: 2`. El cliente reintenta con la misma llave y recibe el resultado final |
| `Pendiente` más viejo (la petición murió o hubo un timeout) | El SP **lo reclama** (`FechaActualizacion = ahora`, bajo bloqueo; solo uno lo reclama) y el servicio vuelve a llamar a `autorizar(K)`. La pasarela es idempotente por `K` |
| `Autorizado` sin pedido (la API murió después de autorizar) | Se reclama igual y el servicio sigue en `CrearPedido` |
| `Autorizado` o `Capturado` con pedido | 200 con el pedido existente |
| `Rechazado` | 402 `PAGO_RECHAZADO` otra vez, con el mensaje guardado |
| `Anulado` (falló la creación del pedido) | El mismo error de entonces (`CodigoRespuesta` guarda el código de negocio, por ejemplo `STOCK_INSUFICIENTE`) |

Una **llave nueva** mientras otro intento de la sesión está `Pendiente` o `Autorizado` responde 409 `PAGO_EN_CURSO`. Lo garantiza `UX_IntentoPago_EnCursoPorSesion` (el 2601 se traduce a 50602).

## 4. Flujo del servicio: la pasarela nunca dentro de una transacción

Cada paso es un SP con su propia transacción, que ya hizo `COMMIT` antes de la siguiente llamada externa:

1. **`SP_Checkout_RegistrarIntentoPago`**. Orden de bloqueo: carrito → sesión → llave.
   - Valida que la sesión esté `Activa` y no vencida (50601 si venció), que `IntentosRechazados` sea menor que el máximo (50605) y que no haya otro intento en curso (50602).
   - Inserta el intento `Pendiente` con `Monto = SesionCheckout.Total`.
   - **Sesión ya pagada** con una llave nueva: si el cliente no tiene sesión activa y su última sesión pasó a `Pagada` hace menos de `MinutosReserva`, responde 200 con ese pedido. Ver la decisión 3.
2. **`pasarela.autorizar({ monto, llave: K, tarjeta })`**, fuera de toda transacción.
3. Según el resultado:
   - **Rechazada:** `ActualizarIntentoPago(Rechazado)` y 402 (sección 10).
   - **Timeout o error de red:** sección 6.
   - **Autorizada:** `ActualizarIntentoPago(Autorizado, IDTransaccion, marca, últimos 4)` con su propio `COMMIT`.
     - Se escribe **antes** de crear el pedido para que quede constancia de una autorización que habría que anular si la API muere.
4. **`SP_Pedidos_CrearPedido(@IDIntentoPago)`** (sección 5).
   - Si falla: **`pasarela.anular(IDTransaccion)`**, luego `ActualizarIntentoPago(Anulado, CodigoRespuesta = <código de negocio>)`, y se responde el error original (por ejemplo 409 `STOCK_INSUFICIENTE`). Sin cobro.
5. **`pasarela.capturar(IDTransaccion)`**, luego `ActualizarIntentoPago(Capturado)` y **201** con el pedido.

## 5. `SP_Pedidos_CrearPedido`: la transacción atómica

Orden de bloqueo (01 §6.6): carrito de la sesión → variantes de las líneas por `IDVariante` → sesión → cupón → intento.

1. **Idempotencia:** si ya hay un pedido para la sesión (`UQ_Pedido_IDSesionCheckout`), lo devuelve. El 2627 de ese `UNIQUE` también se traduce a "devolver el existente".
2. El intento debe estar `Autorizado` con `IDTransaccionPasarela`, ser de esta sesión y la sesión del cliente (`@IDUsuarioActor`). Si no, `INVARIANTE_INTERNA`: es un error de programación, no del cliente.
3. **La sesión debe estar `Activa`.** Si vence a mitad del pago, ver la sección 7. Las reservas vencidas se vuelven a reservar (sección 8).
4. `INSERT Pedido`:
   - Copias de M-04: dirección, método y `FechaEstimadaEntrega = FechaPagoLocal + DiasMax`.
   - Montos de la sesión.
   - N-18: `BaseImponible = ROUND(Total / 1.12, 2)` e `IVA = Total − BaseImponible` (el `CHECK` lo exige).
   - `FechaPago = @Ahora` y `FechaPagoLocal = FU_Sistema_FechaLocal(@Ahora)`, con un solo `SYSUTCDATETIME()`.
   - Marca, últimos 4 dígitos e `IDTransaccion`.
5. `INSERT DetallePedido` desde `LineaSesionCheckout` con las copias de SKU, nombre, descripción y categoría.
6. `SP_Inventario_RegistrarMovimiento` (`SalidaVenta`) por línea: el único que toca la existencia y el kardex (N-07). `CK_Variante_ExistenciaNoNegativa` es la última defensa.
7. `Reserva` → `Consumida`; `UsoCupon` → `Confirmado` (con `IDPedido`; el contador ya estaba comprometido); sesión → `Pagada`; carrito → `Convertido`; historial `(ninguno) → Pagado` (N-08).
8. `COMMIT`. Con `XACT_ABORT` y una sola transacción, cualquier error no deja pedido, detalle, kardex ni cupón confirmado.

**Prueba de atomicidad:** un trigger de prueba (`R__TR_Pruebas_*`, como en E4) hace fallar el `INSERT` de `DetallePedido` ante un SKU marcado. Se verifica que no queda pedido, ni detalle, ni kardex, ni `UsoCupon` `Confirmado`, y que la autorización se anuló.

## 6. Timeout de la pasarela: estado incierto

- El intento **se queda `Pendiente`**: no se sabe si la pasarela autorizó. **Nunca se crea un pedido sin una autorización confirmada**, porque `CrearPedido` exige el intento `Autorizado` con `IDTransaccion`.
- La respuesta es **503 `PAGO_SIN_CONFIRMAR`** (código nuevo 50606, decisión 1): *"No pudimos confirmar tu pago. Reintenta: no se te cobrará dos veces."*
- El cliente reintenta **con la misma llave**:
  - Antes de 30 s → 409 `PAGO_EN_CURSO` con `Retry-After`.
  - Después → el SP reclama el intento y el servicio vuelve a llamar a `autorizar(K)`, que es idempotente: si la primera sí autorizó, devuelve la misma autorización; si no, autoriza ahora una sola vez.
- La tarjeta `4000…0119` debe demostrar esto (decisión 4): la primera llamada con una llave **autoriza pero "pierde" la respuesta** (timeout) y el reintento con la misma llave recibe la autorización. Resultado: un solo pedido y un solo cobro.
- Si el cliente nunca reintenta, el intento `Pendiente` bloquea solo esa sesión: el job de expiración (E5-H04) la vence. Ver la sección 11.

## 7. La sesión vence a mitad del pago

- **Antes de autorizar:** `RegistrarIntentoPago` responde 50601 `SESION_VENCIDA` y no se llama a la pasarela.
- **Entre autorizar y crear el pedido:** `SP_Checkout_ExpirarSesiones` (E5-H04) **no expira una sesión con un intento `Pendiente` o `Autorizado`**. Así, durante el pago la sesión sigue `Activa` y el uso del cupón sigue `Reservado`. Lo único que puede haber vencido son las reservas, y eso lo cubre la sección 8.
  - Un intento que queda colgado se resuelve como en la sección 11.

## 8. La reserva vencida se vuelve a reservar dentro de la transacción

En `CrearPedido`, con las variantes ya bloqueadas en orden:

| Situación de la línea | Qué pasa |
|---|---|
| Reserva `Activa` y no vencida | Se consume |
| Reserva vencida (sigue `Activa` pero no cuenta para el disponible) o `Liberada` | Se exige `FU_Inventario_Disponible ≥ Cantidad` bajo el bloqueo; si alcanza, se consume igual |
| No alcanza | `THROW 50301` con la lista |

Si no alcanza, toda la transacción se revierte, el servicio anula la autorización y responde 409 `STOCK_INSUFICIENTE`. Sin cobro.

## 9. `FechaPagoLocal` cerca de medianoche

- `FU_Sistema_FechaLocal(@FechaUtc) = CONVERT(DATE, DATEADD(HOUR, -6, @FechaUtc))`. Guatemala no tiene horario de verano (M-03).
- **Pruebas sin depender del reloj:** un `SP_Pruebas_FechaLocal(@FechaUtc)` llama a la misma función:
  - `2026-11-02T05:59:59.999Z` → `2026-11-01`
  - `2026-11-02T06:00:00.000Z` → `2026-11-02`
- La prueba del pedido verifica que `FechaPagoLocal = FU_Sistema_FechaLocal(FechaPago)` del mismo pedido.

## 10. Los 5 rechazos ante peticiones simultáneas

- Solo puede haber **un intento en curso por sesión** (`UX_IntentoPago_EnCursoPorSesion`). Una llave nueva mientras otro intento está en curso recibe 409 y **no cuenta** como rechazo.
- `ActualizarIntentoPago(Rechazado)` bloquea la sesión (`UPDLOCK`) e incrementa `IntentosRechazados` en una sola sentencia.
  - Si llega a `MaxIntentosPagoRechazados` (`ParametroSistema`, 5), en la misma transacción llama a `SP_Checkout_CancelarSesionActiva`, que libera las reservas y el uso del cupón (sección 6 del plan de E5-H01).
  - La respuesta es 402 con `detalles.intentosRestantes = 0` y el aviso de que la sesión se canceló.
- Un intento sobre una sesión ya cancelada por rechazos → 50605 `MAX_INTENTOS`.
- **Prueba:** 5 rechazos seguidos cancelan y liberan. Además, 10 peticiones simultáneas con llaves distintas y tarjeta rechazada: en cada ronda solo una llega a la pasarela, el contador nunca pasa de 5 y nunca se cancela dos veces.

## 11. Qué queda en la base después de cada falla

| Falla | Intento | Pedido | Reservas y cupón | Sesión | Cobro |
|---|---|---|---|---|---|
| Rechazo (1.º a 4.º) | `Rechazado` | — | Siguen | `Activa`, contador +1 | No |
| 5.º rechazo | `Rechazado` | — | `Liberada` / `Liberado` (−1) | `Cancelada` | No |
| Timeout | `Pendiente` | — | Siguen | `Activa` | Incierto; el reintento con la misma llave lo resuelve |
| Falla `CrearPedido` (stock, error forzado) | `Anulado` + código | — (nada se escribió) | Siguen hasta vencer | `Activa` | Autorización anulada |
| Falla `CrearPedido` y **falla la anulación** | `Autorizado` sin pedido | — | Siguen | `Activa` | Autorización retenida hasta conciliar (decisión 5) |
| Falla la **captura** | `Autorizado` con pedido | `Pagado` | `Consumida` / `Confirmado` | `Pagada` | Autorizado sin capturar hasta conciliar (decisión 5) |
| La API muere después de autorizar | `Autorizado` sin pedido | — | Siguen | `Activa` | El reintento con la misma llave sigue en `CrearPedido` |

- **Si falla la anulación:** se reintenta en la misma petición (3 veces, con espera breve), se registra en error y se responde el error original. Ese intento queda listado para conciliar.
- **Si falla la captura:** el pedido ya existe; se responde 201 con el pedido, se registra en warn y queda para conciliar.

## 12. `Idempotency-Key` reutilizable (inventario)

- El middleware `idempotencia` (validar y leer el header) se comparte.
- El **almacenamiento** de pagos es `IntentoPago`. Las entradas y los ajustes de inventario no tienen dónde guardar la llave.
- Propuesta (decisión 6): `V012__solicitud_idempotente.sql`, con la tabla `SolicitudIdempotente`:
  - Columnas: `LlaveIdempotencia` (UQ), `Operacion`, `IDUsuario`, `HashSolicitud` y `Resultado` (JSON con `CHECK ISJSON`).
  - La escriben `SP_Inventario_RegistrarEntrada` y `SP_Inventario_RegistrarAjuste` en su misma transacción. El `UNIQUE` es el candado.
  - Misma llave → mismo resultado; otro contenido → 422.

## 13. Pruebas (TDD)

- **Doble clic:** la misma llave, 2 y 5 peticiones simultáneas → un pedido, una autorización y una captura (contadas en una pasarela falsa), y el resto con el mismo pedido o 409 en curso.
- **Llaves y estados:** misma llave con otro contenido → 422; llave nueva con otro intento en curso → 409; sesión ya pagada → el pedido existente.
- **Atomicidad:** falla forzada con el trigger de prueba → nada escrito y la autorización anulada (la pasarela falsa registra `anular`).
- **Copias:** del pedido y del detalle; IVA (`BaseImponible + IVA = Total`); historial `(ninguno) → Pagado`; carrito `Convertido`; kardex `SalidaVenta` por línea; conciliación vacía.
- **Medianoche:** 05:59 y 06:00 UTC.
- **Reservas:** reserva vencida con stock → pedido; vencida y el stock tomado por otro → 409 y anulación.
- **Rechazos:** 402; el quinto cancela y libera; concurrencia de rechazos.
- **Timeout:** con `4000…0119`, 503 y luego un reintento con la misma llave → un pedido y un cobro.
- **Falla de captura y de anulación** con la pasarela falsa: el estado de la tabla de la sección 11.
- **Datos de tarjeta:** el número completo y el CVV nunca en logs ni en la base.

## 14. Decisiones del PO y cambios (mandan sobre las secciones anteriores)

1. **Timeout:** 50606 `PAGO_SIN_CONFIRMAR` con **HTTP 504**. El mensaje dice que puede reintentar y que no se le cobrará dos veces.
2. **`HashSolicitud`:** SHA-256 de **sesión, monto, marca y últimos 4 dígitos**. Nunca el número completo ni el CVV.
3. **Sesión ya pagada, con cualquier llave:** `200` con el pedido existente, sin crear intento ni llamar a la pasarela (N-03).
4. **Aprobado** el comportamiento de `4000…0119`: autoriza y pierde la respuesta.
5. **La conciliación se adelanta a E5-H04** (cambio C).
6. **Aprobada `SolicitudIdempotente`** en una V### nueva, con `UNIQUE (IDUsuario, LlaveIdempotencia)`, el hash y la respuesta guardada. La inserta el SP de entrada o de ajuste en la misma transacción que el movimiento, nunca el middleware por separado. El job horario purga las de más de 24 h.
7. **Aprobado:** el job de expiración no vence sesiones con un pago en curso, **pero solo mientras el arrendamiento del intento esté vivo** (cambio B).

**Cambio A · Pasarela simulada con estado compartido entre réplicas.** Una pasarela en memoria autorizaría otra vez si el reintento cae en la otra réplica. La pasarela simulada persiste sus autorizaciones por llave en tablas propias de SQL Server (`PasarelaAutorizacion`, `PasarelaReembolso`; módulo pasarela), solo por `SP_Pasarela_*`, que solo usa su adaptador y que nunca participan en una transacción del checkout: simula un sistema externo con su propia base. Sin Redis (RNF-2). Prueba: autorizar con `4000…0119` en una réplica y reintentar con la misma llave en la otra devuelve la misma autorización.

**Cambio B · Arrendamiento del intento de pago** (reemplaza los "30 s desde `FechaActualizacion`" de la sección 3).
- Un intento `Pendiente` guarda en `IntentoPago.ArrendadoHasta` hasta cuándo está tomado: `TIMEOUT_PASARELA_MS + MARGEN_ARRENDAMIENTO_MS` (constantes con nombre en el servicio).
- La misma llave con el arrendamiento vivo → `409 PAGO_EN_CURSO` con `Retry-After`.
- Con el arrendamiento vencido, la petición toma el intento con un compare-and-set bajo `UPDLOCK` y vuelve a llamar a la pasarela con la misma llave.
- Ante un timeout, el arrendamiento se libera de inmediato (`SP_Checkout_LiberarArrendamiento`) y se responde 504.
- Pruebas: reintento durante el arrendamiento → 409; reintento después → retoma y se completa con un solo cobro; dos retomas simultáneas → solo una avanza.

**Cambio C · Conciliación en E5-H04** con `sp_getapplock`, cada minuto. El puerto `PasarelaPago` agrega `consultar(llave)` (`NoExiste`, `Autorizada`, `Capturada`, `Anulada`; también `Rechazada`, porque la pasarela simulada guarda los rechazos para responder lo mismo a la misma llave), implementado en el adaptador simulado. Para los intentos con el arrendamiento vencido hace más de 2 minutos (01 §6.2):
- `Pendiente`: `consultar(llave)`. `NoExiste` → `Fallido` sin cobro. `Autorizada` → capturar si existe el pedido de la sesión; si no, anular. (`Rechazada` → `Rechazado`.)
- `Autorizado` sin captura: capturar si existe el pedido; si no, anular.
- Pedido existente con el intento sin `Capturado`: capturar.

Después, la sesión sin pedido puede expirar y liberar sus reservas. Es idempotente: correrla dos veces no cambia nada. Hay una prueba por rama, incluida la API que muere entre `CrearPedido` y la actualización del intento.

Para que dos réplicas no tomen el mismo intento, `SP_Checkout_TomarIntentosPorConciliar` toma el `sp_getapplock` (dueño: la transacción) y **arrienda** los intentos que devuelve. El servicio llama a la pasarela fuera de toda transacción y cierra cada uno con `SP_Checkout_ResolverIntentoConciliado`.
