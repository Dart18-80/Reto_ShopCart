# Concurrencia

## Qué decide

Dos réplicas de la API reciben peticiones a la vez, así que ninguna regla en disputa puede depender de la memoria de un proceso: la serialización la hace SQL Server. Las filas en disputa se bloquean con `UPDLOCK, ROWLOCK` en un **orden global fijo**; los límites son **contadores con `CHECK`**; la idempotencia la garantiza un **`UNIQUE`**; los cambios de estado usan **concurrencia optimista**; los jobs se coordinan con **`sp_getapplock`**; y el trabajo largo que cruza réplicas (pagos, exportaciones) usa **arrendamientos con token de fencing**. Las lecturas no bloquean gracias a `READ_COMMITTED_SNAPSHOT`.

## Mecanismos

| Mecanismo | Qué protege | Dónde | Decisión |
| --- | --- | --- | --- |
| `UPDLOCK, ROWLOCK` | La existencia de una variante mientras se reserva | [R__SP_Inventario_ReservarExistencia.sql:34](../../../database/programmability/R__SP_Inventario_ReservarExistencia.sql#L34 "WITH (UPDLOCK, ROWLOCK)") | A-05 |
| Orden global de bloqueo | Que dos SPs no se esperen en orden inverso (deadlock) | [R__SP_Checkout_IniciarSesion.sql:2](../../../database/programmability/R__SP_Checkout_IniciarSesion.sql#L2 "carrito → variantes por IDVariante → sesión → cupón") | 01 §6.6 |
| Contador con `CHECK` | El límite de usos del cupón | [V006__carrito_cupones_envios.sql:35](../../../database/migrations/V006__carrito_cupones_envios.sql#L35 "CK_Cupon_UsosComprometidos CHECK (UsosComprometidos BETWEEN 0 AND LimiteUsosTotal)") | A-13 |
| `UNIQUE` como candado | Un solo intento de pago por llave | [V007__checkout.sql:97](../../../database/migrations/V007__checkout.sql#L97 "UQ_IntentoPago_LlaveIdempotencia UNIQUE (LlaveIdempotencia)") | N-03 |
| Concurrencia optimista | El estado del pedido | [R__SP_Pedidos_CambiarEstado.sql:53](../../../database/programmability/R__SP_Pedidos_CambiarEstado.sql#L53 "IDEstadoPedido = @IDEsperado") | N-08 |
| `sp_getapplock` | Una sola réplica ejecuta cada job | [R__SP_Checkout_ExpirarSesiones.sql:29](../../../database/programmability/R__SP_Checkout_ExpirarSesiones.sql#L29 "sys.sp_getapplock @Resource = N'Job_Checkout_ExpirarSesiones'") | A-04 |
| Reintento de deadlock | Un deadlock que aun así ocurra | [ejecutar-sp.ts:67](../../../apps/api/src/shared/db/ejecutar-sp.ts#L67 "numero === DEADLOCK && intento < REINTENTOS_DEADLOCK") | 01 §7 |
| Arrendamiento + fencing | Que una petición desplazada no cree el pedido | [R__SP_Checkout_ActualizarIntentoPago.sql:56](../../../database/programmability/R__SP_Checkout_ActualizarIntentoPago.sql#L56 "@TokenVigente <> @TokenArrendamiento") | N-03, A-24 |
| `READ_COMMITTED_SNAPSHOT` | Que las lecturas no esperen a las escrituras | [preparar-servidor.sql:21](../../../database/migrator/sql/preparar-servidor.sql#L21 "SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE") | A-05 |

## `UPDLOCK, ROWLOCK` y orden global por `IDVariante`

- `UPDLOCK` toma un bloqueo de actualización al leer: dos transacciones que leen la misma variante se serializan y la segunda ve lo que dejó la primera. `ROWLOCK` lo limita a la fila: dos compras de productos distintos no se esperan.
- Las variantes se bloquean **una por una en orden ascendente de `IDVariante`**, recorriendo `MIN(IDVariante) > @ID` ([R__SP_Inventario_ReservarExistencia.sql:31](../../../database/programmability/R__SP_Inventario_ReservarExistencia.sql#L31 "SELECT MIN(p.IDVariante) FROM @Pedidas AS p")). Si el cliente A tiene las variantes 5 y 9 y el B las 9 y 5, los dos empiezan por la 5: no hay ciclo de espera.
- El orden completo cuando un SP toca más de una cosa es **carrito → variantes → sesión → cupón**:
  1. Carrito: [R__SP_Checkout_IniciarSesion.sql:53](../../../database/programmability/R__SP_Checkout_IniciarSesion.sql#L53 "EXEC dbo.SP_Carrito_BloquearActivo @IDCliente, NULL, @IDCarrito OUTPUT;") (que usa [R__SP_Carrito_BloquearActivo.sql:22](../../../database/programmability/R__SP_Carrito_BloquearActivo.sql#L22 "WITH (UPDLOCK, HOLDLOCK)")).
  2. Variantes por `IDVariante`: [R__SP_Checkout_IniciarSesion.sql:62](../../../database/programmability/R__SP_Checkout_IniciarSesion.sql#L62 "dbo.Variante AS v WITH (UPDLOCK, ROWLOCK)").
  3. Sesión: [R__SP_Checkout_IniciarSesion.sql:118](../../../database/programmability/R__SP_Checkout_IniciarSesion.sql#L118 "dbo.SesionCheckout AS s WITH (UPDLOCK, ROWLOCK)").
  4. Cupón, el último: [R__SP_Cupones_ReservarUso.sql:21](../../../database/programmability/R__SP_Cupones_ReservarUso.sql#L21 "dbo.Cupon AS c WITH (UPDLOCK, ROWLOCK)").
- Bajo esos bloqueos se valida el disponible de todas las líneas, todo o nada ([R__SP_Inventario_ReservarExistencia.sql:38](../../../database/programmability/R__SP_Inventario_ReservarExistencia.sql#L38 "N-06: todo o nada, con las variantes bloqueadas")).
- El movimiento de inventario también bloquea la variante antes de calcular el saldo nuevo ([R__SP_Inventario_RegistrarMovimiento.sql:56](../../../database/programmability/R__SP_Inventario_RegistrarMovimiento.sql#L56 "dbo.Variante AS v WITH (UPDLOCK, ROWLOCK)")).
- Prueba de variantes compartidas en orden inverso: [iniciar-sesion.api.test.ts:373](../../../apps/api/test/integracion/checkout/iniciar-sesion.api.test.ts#L373 "variantes compartidas en orden inverso entre clientes simultáneos: ningún 500").

## Contadores con `CHECK` (A-13)

El SP valida bajo bloqueo; el `CHECK` es la última defensa si un bug o una escritura directa se saltara el SP.

| Contador | Constraint | Escritura en el SP |
| --- | --- | --- |
| Existencia física ≥ 0 | [V004__catalogo.sql:88](../../../database/migrations/V004__catalogo.sql#L88 "CK_Variante_ExistenciaNoNegativa CHECK (ExistenciaFisica >= 0)") | [R__SP_Inventario_RegistrarMovimiento.sql:72](../../../database/programmability/R__SP_Inventario_RegistrarMovimiento.sql#L72 "THROW 50301, N'No hay existencia suficiente.', 1;") |
| Usos del cupón ≤ límite | [V006__carrito_cupones_envios.sql:35](../../../database/migrations/V006__carrito_cupones_envios.sql#L35 "CK_Cupon_UsosComprometidos") | [R__SP_Cupones_ReservarUso.sql:39](../../../database/programmability/R__SP_Cupones_ReservarUso.sql#L39 "UsosComprometidos < LimiteUsosTotal") |
| Reembolsado ≤ total | [V008__pedidos.sql:90](../../../database/migrations/V008__pedidos.sql#L90 "CK_Pedido_MontoReembolsado CHECK (MontoReembolsado BETWEEN 0 AND Total)") | [R__SP_Pedidos_RegistrarDevolucion.sql:173](../../../database/programmability/R__SP_Pedidos_RegistrarDevolucion.sql#L173 "A-13: el contador con CHECK") |
| Devuelto ≤ vendido | [V008__pedidos.sql:130](../../../database/migrations/V008__pedidos.sql#L130 "CK_DetallePedido_CantidadDevuelta CHECK (CantidadDevuelta BETWEEN 0 AND Cantidad)") | `SP_Pedidos_RegistrarDevolucion` |

- El cupón usa un `UPDATE` condicionado: si no afecta filas, ya no quedaba uso y responde `50505` ([R__SP_Cupones_ReservarUso.sql:42](../../../database/programmability/R__SP_Cupones_ReservarUso.sql#L42 "THROW 50505")).
- Pruebas del constraint directo: [checkout.test.ts:44](../../../apps/api/test/integracion/esquema/checkout.test.ts#L44 "rechaza UsosComprometidos mayor que LimiteUsosTotal") y [inventario.test.ts:78](../../../apps/api/test/integracion/esquema/inventario.test.ts#L78 "rechaza un saldo negativo").

## `UNIQUE` como candado de idempotencia

| Candado | Qué impide |
| --- | --- |
| [V007__checkout.sql:97](../../../database/migrations/V007__checkout.sql#L97 "UQ_IntentoPago_LlaveIdempotencia") | Dos intentos de pago con la misma `Idempotency-Key` |
| [V007__checkout.sql:107](../../../database/migrations/V007__checkout.sql#L107 "CREATE UNIQUE INDEX UX_IntentoPago_EnCursoPorSesion") | Dos pagos en curso para la misma sesión |
| [V007__checkout.sql:50](../../../database/migrations/V007__checkout.sql#L50 "CREATE UNIQUE INDEX UX_SesionCheckout_ActivaPorUsuario") | Dos sesiones de pago activas del mismo cliente |
| [V008__pedidos.sql:76](../../../database/migrations/V008__pedidos.sql#L76 "UQ_Pedido_IDSesionCheckout UNIQUE (IDSesionCheckout)") | Dos pedidos de la misma sesión (cobro doble) |
| [V008__pedidos.sql:209](../../../database/migrations/V008__pedidos.sql#L209 "UQ_Reembolso_LlaveIdempotencia UNIQUE (LlaveIdempotencia)") | Dos reembolsos con la misma llave |
| [V013__arrendamiento_y_solicitud_idempotente.sql:32](../../../database/migrations/V013__arrendamiento_y_solicitud_idempotente.sql#L32 "UQ_SolicitudIdempotente_IDUsuarioLlave UNIQUE (IDUsuario, LlaveIdempotencia)") | Repetir una entrada o un ajuste de inventario |

- El SP de pago busca la llave con `UPDLOCK, HOLDLOCK`: `HOLDLOCK` bloquea también el *hueco* de una llave que todavía no existe, así dos peticiones con la misma llave nueva no insertan las dos ([R__SP_Checkout_RegistrarIntentoPago.sql:70](../../../database/programmability/R__SP_Checkout_RegistrarIntentoPago.sql#L70 "WITH (UPDLOCK, HOLDLOCK)")).
- Si aun así el `INSERT` choca con el `UNIQUE`, el `CATCH` lo traduce a un `409` de negocio en lugar de un `500` ([R__SP_Checkout_RegistrarIntentoPago.sql:162](../../../database/programmability/R__SP_Checkout_RegistrarIntentoPago.sql#L162 "IF ERROR_NUMBER() IN (2601, 2627)") y [R__SP_Checkout_RegistrarIntentoPago.sql:165](../../../database/programmability/R__SP_Checkout_RegistrarIntentoPago.sql#L165 "THROW 50602")). Lo mismo con la sesión activa ([R__SP_Checkout_IniciarSesion.sql:175](../../../database/programmability/R__SP_Checkout_IniciarSesion.sql#L175 "UX_SesionCheckout_ActivaPorUsuario")).
- Pruebas: [iniciar-sesion.api.test.ts:357](../../../apps/api/test/integracion/checkout/iniciar-sesion.api.test.ts#L357 "cinco POST simultáneos del mismo cliente: una sola sesión") y [pagar.api.test.ts:405](../../../apps/api/test/integracion/checkout/pagar.api.test.ts#L405 "la misma llave en dos ajustes simultáneos registra uno solo").

## Concurrencia optimista en estados

- El operador envía el estado que vio (`@EstadoEsperado`); el `UPDATE` solo procede si sigue igual ([R__SP_Pedidos_CambiarEstado.sql:53](../../../database/programmability/R__SP_Pedidos_CambiarEstado.sql#L53 "WHERE  IDPedido = @IDPedido AND IDEstadoPedido = @IDEsperado")). Si no afectó filas, otro lo cambió: `409 CONFLICTO_CONCURRENCIA` ([R__SP_Pedidos_CambiarEstado.sql:55](../../../database/programmability/R__SP_Pedidos_CambiarEstado.sql#L55 "THROW 50002")).
- Prueba: [estados.api.test.ts:179](../../../apps/api/test/integracion/pedidos/estados.api.test.ts#L179 "dos operadores a la vez sobre el mismo pedido: uno gana y el otro recibe 409").
- Por qué optimista aquí: dos operadores sobre el mismo pedido es raro y el perdedor solo recarga; no hace falta retener un bloqueo mientras el operador decide.

## `sp_getapplock` en los jobs (A-04)

- Cada réplica ejecuta todas las tareas; el planificador no guarda estado compartido ([planificador.ts:32](../../../apps/api/src/shared/jobs/planificador.ts#L32 "A-04 (01 §8): cada réplica ejecuta todas las tareas")).
- El SP del job pide un bloqueo exclusivo de transacción **sin esperar** (`@LockTimeout = 0`); si la otra réplica lo tiene, revierte y devuelve `Ejecutada = 0` ([R__SP_Checkout_ExpirarSesiones.sql:30](../../../database/programmability/R__SP_Checkout_ExpirarSesiones.sql#L30 "@LockOwner = N'Transaction', @LockTimeout = 0;") y [R__SP_Checkout_ExpirarSesiones.sql:34](../../../database/programmability/R__SP_Checkout_ExpirarSesiones.sql#L34 "SELECT CONVERT(BIT, 0) AS Ejecutada")). El bloqueo es de transacción: si la réplica muere, SQL Server lo libera solo.
- Lo usan: expirar sesiones, conciliar pagos, reintentar reembolsos, expirar carritos de invitado, purgar llaves de idempotencia y purgar exportaciones.
- Prueba: [tareas-periodicas.test.ts:192](../../../apps/api/test/integracion/secuencial/tareas-periodicas.test.ts#L192 "si la otra réplica tiene el bloqueo, retorna sin hacer nada").

## Reintento de deadlocks en `ejecutarSP`

- Error 1205, hasta 3 reintentos con espera de 50, 100 y 200 ms ([ejecutar-sp.ts:31](../../../apps/api/src/shared/db/ejecutar-sp.ts#L31 "const DEADLOCK = 1205;") y [ejecutar-sp.ts:69](../../../apps/api/src/shared/db/ejecutar-sp.ts#L69 "ESPERA_BASE_DEADLOCK_MS * 2 ** intento")).
- Es seguro porque con `XACT_ABORT` el SP ya revirtió todo antes de que llegue el error ([ejecutar-sp.ts:66](../../../apps/api/src/shared/db/ejecutar-sp.ts#L66 "Con XACT_ABORT el SP ya revirtió todo")).
- Pruebas: [ejecutar-sp.test.ts:124](../../../apps/api/test/unit/shared/db/ejecutar-sp.test.ts#L124 "reintenta ante un deadlock (1205)") y [ejecutar-sp.test.ts:192](../../../apps/api/test/unit/shared/db/ejecutar-sp.test.ts#L192 "los reintentos envían el mismo actor que la primera ejecución").

## `READ_COMMITTED_SNAPSHOT`

El migrador lo activa al crear la base ([preparar-servidor.sql:17](../../../database/migrator/sql/preparar-servidor.sql#L17 "A-05: con RCSI los lectores no bloquean a los escritores")). Las lecturas (catálogo, dashboard) leen la última versión confirmada sin esperar a las escrituras; por eso las escrituras críticas no confían en una lectura simple y bloquean con `UPDLOCK` explícito.

## Arrendamientos con fencing

### Pagos (N-03)

- El intento de pago se "arrienda" a la petición que lo procesa (`ArrendadoHasta`, [V013__arrendamiento_y_solicitud_idempotente.sql:5](../../../database/migrations/V013__arrendamiento_y_solicitud_idempotente.sql#L5 "ADD ArrendadoHasta DATETIME2(3) NULL")). Mientras está vivo, un reintento con la misma llave recibe `409` con `Retry-After` y el job de expiración no vence la sesión ([R__SP_Checkout_ExpirarSesiones.sql:56](../../../database/programmability/R__SP_Checkout_ExpirarSesiones.sql#L56 "i.ArrendadoHasta > SYSUTCDATETIME()")).
- Cada toma genera un `TokenArrendamiento` nuevo ([V014__token_arrendamiento.sql:5](../../../database/migrations/V014__token_arrendamiento.sql#L5 "ADD TokenArrendamiento UNIQUEIDENTIFIER NULL")). Los SPs que escriben el intento o crean el pedido verifican bajo `UPDLOCK` que el token sigue vigente ([R__SP_Checkout_ActualizarIntentoPago.sql:56](../../../database/programmability/R__SP_Checkout_ActualizarIntentoPago.sql#L56 "@TokenVigente <> @TokenArrendamiento")).
- Si la réplica muere, la conciliación toma el intento cuando vence el arrendamiento, con un token nuevo ([R__SP_Checkout_TomarIntentosPorConciliar.sql:56](../../../database/programmability/R__SP_Checkout_TomarIntentosPorConciliar.sql#L56 "TokenArrendamiento = @Token")); `READPAST` salta el que otra transacción tiene bloqueado ([R__SP_Checkout_TomarIntentosPorConciliar.sql:48](../../../database/programmability/R__SP_Checkout_TomarIntentosPorConciliar.sql#L48 "WITH (UPDLOCK, ROWLOCK, READPAST)")).
- Pruebas: [tareas-periodicas.test.ts:432](../../../apps/api/test/integracion/secuencial/tareas-periodicas.test.ts#L432 "una petición cuyo arrendamiento retomó la conciliación no puede crear el pedido") y [vigencia-del-pago.api.test.ts:181](../../../apps/api/test/integracion/checkout/vigencia-del-pago.api.test.ts#L181 "con un token que otro proceso ya reemplazó").

### Exportaciones (A-24)

- Las dos réplicas consumen la cola en competencia, sin `sp_getapplock`: `UPDLOCK, ROWLOCK, READPAST` toma una solicitud que nadie más esté tomando ([R__SP_Exportaciones_Tomar.sql:41](../../../database/programmability/R__SP_Exportaciones_Tomar.sql#L41 "WITH (UPDLOCK, ROWLOCK, READPAST)")) y la arrienda con un token nuevo ([R__SP_Exportaciones_Tomar.sql:48](../../../database/programmability/R__SP_Exportaciones_Tomar.sql#L48 "TokenArrendamiento = @Token")).
- Solo completa quien tiene el token vigente ([R__SP_Exportaciones_Completar.sql:38](../../../database/programmability/R__SP_Exportaciones_Completar.sql#L38 "TokenArrendamiento = @TokenArrendamiento")): una réplica desplazada no sobrescribe el resultado.
- Prueba: [exportaciones.api.test.ts:311](../../../apps/api/test/integracion/secuencial/exportaciones.api.test.ts#L311 "una réplica que muere a mitad: otra la retoma al vencer el arrendamiento").

## Pruebas de concurrencia (RNF-3)

- 20 clientes sembrados ([apoyo-concurrencia.ts:8](../../../apps/api/test/concurrencia/apoyo-concurrencia.ts#L8 "export const TOTAL_CLIENTES = 20;")) compran a la vez a través de nginx, repartidos entre `api-1` y `api-2`; `Promise.all` dispara todas las peticiones en el mismo turno ([checkout.concurrencia.test.ts:40](../../../apps/api/test/concurrencia/checkout.concurrencia.test.ts#L40 "Promise.all(clientes.map((cliente) => comprar(cliente, idMetodoEnvio)))")).
- **Escenario 1, la última unidad:** exactamente 1 pedido y 19 `409 STOCK_INSUFICIENTE`, existencia 0 y conciliación de inventario vacía ([checkout.concurrencia.test.ts:55](../../../apps/api/test/concurrencia/checkout.concurrencia.test.ts#L55 "escenario 1: 20 clientes por la última unidad")).
- **Escenario 2, el último uso de un cupón:** 1 pedido con cupón y 19 `422 CUPON_AGOTADO`; `usosComprometidos = 1` ([checkout.concurrencia.test.ts:77](../../../apps/api/test/concurrencia/checkout.concurrencia.test.ts#L77 "escenario 2: 20 clientes por el último uso de un cupón")).
- Las dos réplicas atendieron peticiones ([checkout.concurrencia.test.ts:74](../../../apps/api/test/concurrencia/checkout.concurrencia.test.ts#L74 "new Set(['api-1', 'api-2'])")).
- Se corre con `pnpm test:concurrencia` y requiere el entorno levantado.

## Alternativas descartadas

- **`SERIALIZABLE` global** → bloqueos de rango y deadlocks innecesarios; se usa RCSI + `UPDLOCK` explícito donde hay disputa (A-05).
- **Solo `COUNT`/`SUM` en el SP sin `CHECK`** → correcto con bloqueo, pero sin defensa ante un bug (A-13).
- **Lock de los jobs en Redis** → depende de algo que se puede perder; **worker dedicado** → un servicio más (A-04).
- **Cola de exportaciones en Redis** → se puede perder (A-24).
- **Bloqueo distribuido en memoria o "un solo proceso hace el checkout"** → rompe RNF-2: cualquier réplica debe poder atender cualquier petición.

## Preguntas probables

### Dos clientes compran la última unidad al mismo tiempo en réplicas distintas. ¿Qué pasa?

Los dos llegan a `SP_Checkout_IniciarSesion`; el primero bloquea la variante con `UPDLOCK`, reserva y confirma. El segundo espera el bloqueo, ve disponible 0 y recibe `409 STOCK_INSUFICIENTE`. La prueba RNF-3 lo hace con 20.
**Muéstralo en:** [checkout.concurrencia.test.ts:55](../../../apps/api/test/concurrencia/checkout.concurrencia.test.ts#L55 "escenario 1: 20 clientes por la última unidad")

### ¿Por qué bloquean en orden de `IDVariante`?

Porque un deadlock necesita un ciclo de espera. Si todos los SPs bloquean en el mismo orden global, nadie espera por una fila "anterior" que otro tenga.
**Muéstralo en:** [R__SP_Inventario_ReservarExistencia.sql:31](../../../database/programmability/R__SP_Inventario_ReservarExistencia.sql#L31 "SELECT MIN(p.IDVariante) FROM @Pedidas AS p")

### Si ya bloquean, ¿para qué el `CHECK`?

Es la última defensa: un bug en un SP futuro o una escritura directa no pueden dejar existencia negativa ni pasar el límite del cupón.
**Muéstralo en:** [V004__catalogo.sql:88](../../../database/migrations/V004__catalogo.sql#L88 "CK_Variante_ExistenciaNoNegativa CHECK (ExistenciaFisica >= 0)")

### ¿Cómo evitan cobrar dos veces si el cliente reintenta el pago?

La `Idempotency-Key` es `UNIQUE` en `IntentoPago` y el SP la busca con `UPDLOCK, HOLDLOCK`; la misma llave devuelve el mismo resultado. Además, `UQ_Pedido_IDSesionCheckout` impide un segundo pedido de la sesión.
**Muéstralo en:** [R__SP_Checkout_RegistrarIntentoPago.sql:70](../../../database/programmability/R__SP_Checkout_RegistrarIntentoPago.sql#L70 "WITH (UPDLOCK, HOLDLOCK)")

### ¿Para qué `HOLDLOCK` si ya hay `UPDLOCK`?

`UPDLOCK` solo bloquea filas que existen. Con una llave nueva no hay fila: `HOLDLOCK` bloquea el rango vacío y la segunda petición espera en lugar de insertar también.
**Muéstralo en:** [R__SP_Checkout_RegistrarIntentoPago.sql:66](../../../database/programmability/R__SP_Checkout_RegistrarIntentoPago.sql#L66 "HOLDLOCK bloquea también el hueco de una llave nueva")

### La réplica muere después de autorizar el pago y antes de crear el pedido. ¿Qué queda?

Un intento `Autorizado` con el arrendamiento vencido. La conciliación lo toma con un token nuevo, consulta la pasarela y anula (o captura si ya hay pedido). La réplica muerta, si volviera, ya no tiene el token vigente.
**Muéstralo en:** [tareas-periodicas.test.ts:432](../../../apps/api/test/integracion/secuencial/tareas-periodicas.test.ts#L432 "una petición cuyo arrendamiento retomó la conciliación no puede crear el pedido")

### ¿Qué es el token de fencing y por qué no basta con la fecha del arrendamiento?

La fecha dice si el arrendamiento venció; el token dice **quién** lo tiene. Una petición lenta que despierta después de que otro proceso la desplazó tiene un token viejo y sus escrituras se rechazan.
**Muéstralo en:** [R__SP_Checkout_ActualizarIntentoPago.sql:57](../../../database/programmability/R__SP_Checkout_ActualizarIntentoPago.sql#L57 "THROW 50602, N'Otro proceso tomó este pago.")

### Hay dos réplicas: ¿el job de expiración corre dos veces?

Las dos lo intentan, pero el SP pide `sp_getapplock` sin espera: la que no lo obtiene devuelve `Ejecutada = 0` sin tocar nada.
**Muéstralo en:** [tareas-periodicas.test.ts:192](../../../apps/api/test/integracion/secuencial/tareas-periodicas.test.ts#L192 "si la otra réplica tiene el bloqueo, retorna sin hacer nada")

### ¿Qué pasa si dos operadores cambian el estado del mismo pedido a la vez?

Concurrencia optimista: el `UPDATE` exige el estado esperado; el segundo no afecta filas y recibe `409 CONFLICTO_CONCURRENCIA`.
**Muéstralo en:** [estados.api.test.ts:179](../../../apps/api/test/integracion/pedidos/estados.api.test.ts#L179 "dos operadores a la vez sobre el mismo pedido")

### ¿Y si a pesar de todo ocurre un deadlock?

SQL Server elige una víctima (error 1205); con `XACT_ABORT` ya se revirtió todo y `ejecutarSP` reintenta hasta 3 veces con backoff.
**Muéstralo en:** [ejecutar-sp.test.ts:124](../../../apps/api/test/unit/shared/db/ejecutar-sp.test.ts#L124 "reintenta ante un deadlock (1205)")

### ¿Las lecturas del catálogo se bloquean mientras alguien compra?

No: con `READ_COMMITTED_SNAPSHOT` leen la última versión confirmada sin esperar los bloqueos de escritura.
**Muéstralo en:** [preparar-servidor.sql:21](../../../database/migrator/sql/preparar-servidor.sql#L21 "SET READ_COMMITTED_SNAPSHOT ON")

### ¿Cómo saben que la prueba de concurrencia realmente usó las dos réplicas?

Cada respuesta trae el encabezado `X-Instancia`, y la prueba exige que aparezcan `api-1` y `api-2`.
**Muéstralo en:** [checkout.concurrencia.test.ts:74](../../../apps/api/test/concurrencia/checkout.concurrencia.test.ts#L74 "new Set(['api-1', 'api-2'])")
