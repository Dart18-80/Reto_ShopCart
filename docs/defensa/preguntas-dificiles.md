# Las 30 preguntas más difíciles

Las que un evaluador usaría para buscar una penalización o una contradicción. Cada respuesta es corta, cita el código o la prueba que la demuestra y enlaza el documento de la guía donde está el detalle. Están agrupadas por tema; las primeras de cada grupo son las más probables.

## Dinero, existencia y pagos

### 1. Veinte clientes compran la última unidad al mismo tiempo. ¿Cómo garantizas que solo uno la obtiene?

La reserva nace al iniciar el pago, dentro de un SP que bloquea cada variante con `UPDLOCK, ROWLOCK` en orden de `IDVariante` y revalida el disponible ya bloqueado: la segunda petición espera el bloqueo y ve 0. No depende de la API: dos réplicas dan el mismo resultado. La prueba de concurrencia lo hace con 20 clientes reales a través de nginx: 1 pedido y 19 × 409.

**Muéstralo en:** [R__SP_Inventario_ReservarExistencia.sql:34](../../database/programmability/R__SP_Inventario_ReservarExistencia.sql#L34 "WITH (UPDLOCK, ROWLOCK)") y [checkout.concurrencia.test.ts:55](../../apps/api/test/concurrencia/checkout.concurrencia.test.ts#L55 "escenario 1: 20 clientes por la última unidad"). Detalle: [inventario](modulos/inventario.md), [concurrencia](transversal/concurrencia.md).

### 2. ¿Y por qué los 19 rechazos llegan al iniciar el pago y no al pagar?

Porque iniciar el pago reserva: quien no consigue la reserva no llega a la pasarela y no se le cobra nada. Al pagar, la unidad ya es suya hasta que vence la sesión (15 minutos).

**Muéstralo en:** [R__SP_Inventario_ReservarExistencia.sql:52](../../database/programmability/R__SP_Inventario_ReservarExistencia.sql#L52 "THROW 50301, @Error, 1;"). Detalle: [checkout](modulos/checkout.md).

### 3. El cliente pulsa «Pagar» dos veces o reintenta tras un timeout. ¿Se cobra dos veces?

No. Cada pago lleva una `Idempotency-Key`; la base tiene un `UNIQUE` sobre ella y el SP que registra el intento lo busca con bloqueo antes de insertar. Un reintento con la misma llave devuelve el mismo pedido, y uno con la misma llave pero otra tarjeta responde 422.

**Muéstralo en:** [V007__checkout.sql:97](../../database/migrations/V007__checkout.sql#L97 "UQ_IntentoPago_LlaveIdempotencia UNIQUE (LlaveIdempotencia)"). Detalle: [checkout](modulos/checkout.md).

### 4. La pasarela autoriza, pero la respuesta se pierde y la réplica muere. ¿Qué queda?

El intento quedó registrado antes de llamar a la pasarela. Si el cliente reintenta con la misma llave (en cualquier réplica), la pasarela devuelve la misma autorización y se crea el pedido con un solo cobro; si no reintenta, la tarea de conciliación consulta la pasarela y captura o anula. La prueba simula el reintento en la otra réplica con la tarjeta `4000…0119`.

**Muéstralo en:** [pagar.api.test.ts:262](../../apps/api/test/integracion/checkout/pagar.api.test.ts#L262 "el reintento de 0119 en la otra réplica") y [checkout.tareas.ts:23](../../apps/api/src/modules/checkout/checkout.tareas.ts#L23 "Checkout.ConciliarPagos"). Detalle: [checkout](modulos/checkout.md).

### 5. ¿Por qué la llamada a la pasarela no está dentro de la transacción del pedido?

Porque una transacción abierta durante una llamada externa retiene bloqueos sobre las variantes mientras la pasarela responde (o no responde), y un rollback no deshace un cobro. Se registra el intento, se llama a la pasarela fuera de toda transacción y después se crea el pedido en otra.

**Muéstralo en:** [checkout.pago.ts:51](../../apps/api/src/modules/checkout/checkout.pago.ts#L51 "Ninguna llamada a"). Detalle: [checkout](modulos/checkout.md), [arquitectura](transversal/arquitectura.md).

### 6. Una petición se queda «colgada», la conciliación retoma su intento y después la petición despierta. ¿Puede crear el pedido?

No. Cada toma del arrendamiento genera un token de fencing nuevo; crear el pedido y actualizar el intento verifican bajo `UPDLOCK` que el token sigue siendo el vigente. La petición «zombi» recibe 409 y no escribe nada.

**Muéstralo en:** [R__SP_Checkout_ActualizarIntentoPago.sql:56](../../database/programmability/R__SP_Checkout_ActualizarIntentoPago.sql#L56 "@TokenVigente <> @TokenArrendamiento") y [tareas-periodicas.test.ts:432](../../apps/api/test/integracion/secuencial/tareas-periodicas.test.ts#L432 "una petición cuyo arrendamiento retomó la conciliación no puede crear el pedido"). Detalle: [checkout](modulos/checkout.md).

### 7. El último uso de un cupón: ¿cómo evitas que dos clientes lo usen a la vez?

Con un contador atómico: `UPDATE … SET UsosComprometidos = UsosComprometidos + 1 WHERE UsosComprometidos < LimiteUsosTotal`. Si no actualiza ninguna fila, el cupón se agotó. Un `CHECK` en la tabla es la última defensa. La prueba de concurrencia lo verifica con 20 clientes.

**Muéstralo en:** [R__SP_Cupones_ReservarUso.sql:39](../../database/programmability/R__SP_Cupones_ReservarUso.sql#L39 "UsosComprometidos < LimiteUsosTotal") y [checkout.concurrencia.test.ts:77](../../apps/api/test/concurrencia/checkout.concurrencia.test.ts#L77 "escenario 2: 20 clientes por el último uso de un cupón"). Detalle: [cupones](modulos/cupones.md).

### 8. ¿Por qué no usas `float` para el dinero? ¿Dónde se calcula?

Los montos son `DECIMAL(12,2)` en la base y los cálculos (descuentos, totales, reembolsos) se hacen en los SPs. La API los recibe con un único punto de conversión a `Decimal` (`aMonto`), que falla en lugar de redondear un valor fuera de rango, y en JSON viajan como texto. Una prueba recorre todos los scripts y falla si aparece `FLOAT`, `REAL` o `MONEY`.

**Muéstralo en:** [index.ts:12](../../apps/api/src/shared/dinero/index.ts#L12 "export function aMonto(valor: number): Decimal") y [penalizaciones.test.ts:130](../../database/migrator/test/penalizaciones.test.ts#L130 "ningún FLOAT, REAL, MONEY, DATETIME, TEXT, NTEXT ni IMAGE"). Detalle: [base de datos](transversal/base-de-datos.md).

### 9. ¿Cómo sabes que el kardex y la existencia nunca se desalinean?

Un solo SP modifica `ExistenciaFisica` y escribe el kardex, en la misma transacción; el kardex es una tabla ledger que no se puede editar. La vista de conciliación compara la existencia con la suma del kardex, y las pruebas de concurrencia exigen que quede vacía.

**Muéstralo en:** [R__VW_Inventario_Conciliacion.sql:22](../../database/programmability/R__VW_Inventario_Conciliacion.sql#L22 "v.ExistenciaFisica <> k.SumaKardex") y [V005__inventario.sql:47](../../database/migrations/V005__inventario.sql#L47 "WITH (LEDGER = ON (APPEND_ONLY = ON))"). Detalle: [inventario](modulos/inventario.md).

## Base de datos

### 10. Demuéstrame que no hay SQL en el backend.

El repositorio solo llama a `ejecutarSP` con el nombre del SP y parámetros tipados; el login de la API solo tiene `EXECUTE`. Una prueba recorre todo el TypeScript del backend (también las pruebas) y falla si encuentra una sentencia SQL.

**Muéstralo en:** [penalizaciones.test.ts:185](../../database/migrator/test/penalizaciones.test.ts#L185 "ningún archivo TypeScript del backend contiene una sentencia SQL"). Detalle: [base de datos](transversal/base-de-datos.md).

### 11. La búsqueda arma SQL dinámico. ¿Cómo evitas la inyección?

Solo se concatenan fragmentos constantes; los valores viajan como parámetros de `sp_executesql` y el orden sale de una lista blanca resuelta con `CASE`. Un texto como `' OR 1=1 --` se busca como texto.

**Muéstralo en:** [R__SP_Catalogo_BuscarProductos.sql:69](../../database/programmability/R__SP_Catalogo_BuscarProductos.sql#L69 "EXEC sys.sp_executesql @Sql,"). Detalle: [catálogo](modulos/catalogo.md).

### 12. ¿Qué pasa si un SP falla a la mitad?

Todo SP que escribe usa `SET XACT_ABORT ON` y `BEGIN TRY … BEGIN TRAN … COMMIT` con `ROLLBACK` y `THROW` en el `CATCH`: cualquier error revierte todo. Una prueba verifica esa plantilla en todos los SPs que escriben.

**Muéstralo en:** [convenciones-sql.test.ts:44](../../database/migrator/test/convenciones-sql.test.ts#L44 "SET XACT_ABORT ON, TRY/CATCH con transacción y SP_Sistema_EstablecerContexto"). Detalle: [base de datos](transversal/base-de-datos.md).

### 13. ¿Cómo evitas los deadlocks, y qué pasa si ocurre uno?

Todo proceso bloquea el carrito, después las variantes en orden de `IDVariante` y después la sesión y el cupón: un orden global evita los ciclos. Si aun así SQL Server elige una víctima (error 1205), `ejecutarSP` reintenta con una espera breve y creciente.

**Muéstralo en:** [ejecutar-sp.ts:31](../../apps/api/src/shared/db/ejecutar-sp.ts#L31 "const DEADLOCK = 1205;") y [ejecutar-sp.test.ts:124](../../apps/api/test/unit/shared/db/ejecutar-sp.test.ts#L124 "reintenta ante un deadlock (1205)"). Detalle: [concurrencia](transversal/concurrencia.md).

### 14. ¿Quién modificó este precio, y puede alguien borrar ese rastro?

Los triggers de bitácora escriben una fila por fila afectada con el valor anterior y el nuevo, el usuario y el `requestId` que cada SP fija en `SESSION_CONTEXT`; sin contexto, el trigger falla. La bitácora es una tabla ledger append-only: el motor rechaza `UPDATE` y `DELETE`.

**Muéstralo en:** [R__TR_Usuarios_Bitacora.sql:12](../../database/programmability/R__TR_Usuarios_Bitacora.sql#L12 "IF SESSION_CONTEXT(N'Rol') IS NULL") y [V009__bitacora.sql:24](../../database/migrations/V009__bitacora.sql#L24 "WITH (LEDGER = ON (APPEND_ONLY = ON))"). Detalle: [bitácora](modulos/bitacora.md).

### 15. ¿Qué impide que alguien edite una migración ya aplicada?

El migrador guarda el checksum de cada script aplicado: si un `V###` cambió, falla en lugar de aplicarlo. Los `R__` (SPs, vistas, funciones y triggers) sí se reaplican al cambiar su checksum, porque son `CREATE OR ALTER`.

**Muéstralo en:** [plan.ts:22](../../database/migrator/src/plan.ts#L22 "!script.checksum.equals(aplicado.checksum)"). Detalle: [base de datos](transversal/base-de-datos.md).

## Seguridad

### 16. ¿Cómo evitas que un cliente vea los pedidos de otro cambiando el ID en la URL?

El cliente nunca envía su ID: sale del token, y los SPs filtran con `@IDUsuarioActor`. Un pedido ajeno responde 404, igual que uno inexistente. Una prueba recorre el router real y exige un caso de aislamiento por cada ruta de cliente que recibe un ID.

**Muéstralo en:** [R__SP_Pedidos_ObtenerDetalle.sql:14](../../database/programmability/R__SP_Pedidos_ObtenerDetalle.sql#L14 "p.IDUsuario = @IDUsuarioActor") y [aislamiento.api.test.ts:233](../../apps/api/test/integracion/seguridad/aislamiento.api.test.ts#L233 "el recurso de otro cliente responde 404, igual que uno inexistente"). Detalle: [seguridad](transversal/seguridad.md).

### 17. ¿Por qué 404 y no 403 para un recurso ajeno?

Un 403 confirma que el recurso existe: alguien podría enumerar los pedidos de la tienda. Con 404, un recurso ajeno es indistinguible de uno inexistente. Además, ninguna ruta de cliente acepta un `idUsuario` en su entrada.

**Muéstralo en:** [aislamiento.api.test.ts:262](../../apps/api/test/integracion/seguridad/aislamiento.api.test.ts#L262 "ninguna ruta de cliente acepta idUsuario en su entrada"). Detalle: [seguridad](transversal/seguridad.md).

### 18. Un JWT dura 15 minutos. Si desactivas a un usuario, ¿sigue entrando hasta que venza?

No. Cada token lleva la versión de sesión del usuario; desactivarlo, cambiar su rol o su contraseña la sube, y `autenticar` rechaza un token con una versión anterior en la siguiente petición.

**Muéstralo en:** [autenticar.ts:36](../../apps/api/src/shared/http/autenticar.ts#L36 "versionSesion < vigente"). Detalle: [auth](modulos/auth.md), [usuarios](modulos/usuarios.md).

### 19. Te roban el refresh token. ¿Qué pasa?

Cada refresh se rota y pertenece a una familia. Si un refresh ya rotado se vuelve a usar (el ladrón o el dueño, el segundo en llegar), se revoca toda la familia y los dos deben iniciar sesión de nuevo.

**Muéstralo en:** [R__SP_Auth_RotarRefreshToken.sql:62](../../database/programmability/R__SP_Auth_RotarRefreshToken.sql#L62 "THROW 50102") y [refresh-logout.api.test.ts:69](../../apps/api/test/integracion/auth/refresh-logout.api.test.ts#L69 "reusar un token ya rotado revoca toda la familia"). Detalle: [auth](modulos/auth.md).

### 20. ¿Qué impide que alguien cuele un `idUsuario` o un campo extra en el cuerpo?

Cada handler valida su entrada con Zod antes de ejecutarse, y los cuerpos usan `.strict()`: un campo inesperado responde 400 en lugar de ignorarse.

**Muéstralo en:** [shared/direcciones.ts:9](../../packages/shared/src/direcciones.ts#L9 "RF-01: .strict() rechaza un idUsuario colado en el cuerpo"). Detalle: [arquitectura](transversal/arquitectura.md).

### 21. ¿Las trazas de Grafana pueden filtrar una contraseña, un token o una tarjeta?

No: los spans de SQL llevan el nombre del SP y no sus parámetros, los de Redis solo el comando y nunca el `AUTH`, y HTTP no captura encabezados ni cuerpos. Una prueba arranca la API compilada con la instrumentación real, hace una compra y revisa todo lo exportado.

**Muéstralo en:** [seguridad-trazas.test.ts:142](../../apps/api/test/telemetria/seguridad-trazas.test.ts#L142 "ningún span ni log lleva contraseñas, tokens") y [seguridad-trazas.test.ts:172](../../apps/api/test/telemetria/seguridad-trazas.test.ts#L172 "los spans de SQL solo llevan el nombre del SP"). Detalle: [observabilidad](transversal/observabilidad.md).

### 22. ¿Por qué el token del dashboard en tiempo real no va en la URL, si `EventSource` no admite encabezados?

Un token en la URL queda en el log de nginx, en el historial del navegador y en el `Referer`. El stream exige `Authorization` y el cliente usa `fetch` con el cuerpo como stream (A-25). Hoy lo consumen las pruebas y `curl -N`; el dashboard web es de la Fase 2.

**Muéstralo en:** [reportes.schemas.ts:74](../../apps/api/src/modules/reportes/reportes.schemas.ts#L74 "authorization: z.string().optional()"). Detalle: [reportes](modulos/reportes.md).

## Réplicas y fallas

### 23. Apagas `api-1` en plena demo. ¿Qué ve el cliente?

Nada: nginx no logra conectar en 250 ms, reintenta en `api-2` y, tras 3 fallas en 10 s, saca a `api-1` de la rotación. La prueba de entorno lo hace con 20 peticiones seguidas y todas responden 200 desde `api-2`.

**Muéstralo en:** [rnf2.test.ts:40](../../apps/api/test/entorno/rnf2.test.ts#L40 "peticiones seguidas a través de nginx responden 200 desde api-2"). Detalle: [infraestructura](transversal/infraestructura.md).

### 24. ¿Y un pago que ya había llegado a `api-1` cuando se cayó? ¿nginx lo repite en `api-2`?

No. nginx solo reintenta ante un error de conexión o un timeout, nunca un POST que ya llegó (no tiene `non_idempotent`). Si el cliente reintenta, lo protege la `Idempotency-Key` (pregunta 3).

**Muéstralo en:** [nginx.conf:71](../../infra/nginx/nginx.conf#L71 "proxy_next_upstream       error timeout;"). Detalle: [infraestructura](transversal/infraestructura.md).

### 25. Se cae Redis. ¿Se sigue vendiendo?

Sí. Redis solo guarda lo que se puede perder (versiones de sesión, límites de intentos, caché de reportes); lo crítico vive en SQL Server. La prueba de entorno detiene Redis y hace un checkout completo: vende la última unidad una sola vez y cobra una sola vez.

**Muéstralo en:** [rnf2.test.ts:68](../../apps/api/test/entorno/rnf2.test.ts#L68 "con Redis detenido, un checkout completo vende la última unidad una sola vez"). Detalle: [infraestructura](transversal/infraestructura.md).

### 26. Las dos réplicas corren las tareas periódicas. ¿Cómo evitas que expiren las sesiones dos veces?

Cada tarea entra a un SP que toma `sp_getapplock` con `@LockTimeout = 0`: si la otra réplica lo tiene, no espera ni trabaja. Además, cada tarea es idempotente: correrla dos veces no cambia nada.

**Muéstralo en:** [R__SP_Checkout_ExpirarSesiones.sql:29](../../database/programmability/R__SP_Checkout_ExpirarSesiones.sql#L29 "sys.sp_getapplock @Resource = N'Job_Checkout_ExpirarSesiones'") y [tareas-periodicas.test.ts:91](../../apps/api/test/integracion/secuencial/tareas-periodicas.test.ts#L91 "retiene el sp_getapplock del job"). Detalle: [concurrencia](transversal/concurrencia.md).

### 27. Un reporte grande para Excel tarda minutos. ¿Bloquea la réplica? ¿Y si la réplica muere a la mitad?

La exportación es asíncrona: el POST responde 202 y la solicitud va a una cola en SQL Server que las dos réplicas consumen con `UPDLOCK, READPAST` y un arrendamiento con token de fencing. Si una réplica muere, otra la retoma al vencer el arrendamiento, y la muerta ya no puede completarla.

**Muéstralo en:** [R__SP_Exportaciones_Tomar.sql:41](../../database/programmability/R__SP_Exportaciones_Tomar.sql#L41 "WITH (UPDLOCK, ROWLOCK, READPAST)") y [R__SP_Exportaciones_Completar.sql:38](../../database/programmability/R__SP_Exportaciones_Completar.sql#L38 "TokenArrendamiento = @TokenArrendamiento"). Detalle: [exportaciones](modulos/exportaciones.md).

### 28. Un pedido se crea en `api-1` y el Admin mira el dashboard conectado a `api-2`. ¿Cómo se entera?

Cada escritura que cambia los reportes incrementa, después del commit, la versión de su dominio en Redis y publica el aviso en un canal pub/sub. Cada réplica tiene su propia conexión de suscripción y reenvía el aviso a sus streams; el dashboard vuelve a pedir el reporte, que sale de la caché nueva.

**Muéstralo en:** [avisos-redis.ts:82](../../apps/api/src/shared/adapters/avisos-redis.ts#L82 "cliente.publish(CANAL_AVISOS, JSON.stringify(aviso))") y [avisos-redis.ts:90](../../apps/api/src/shared/adapters/avisos-redis.ts#L90 "suscriptor = cliente.duplicate();"). Detalle: [reportes](modulos/reportes.md).

### 29. ¿La caché de reportes puede mostrar datos viejos?

Sí, acotados. Quien escribe ve su cambio en la siguiente consulta porque la versión sube antes de responderle; los demás lo ven al leer la versión nueva. Entre el commit y el `INCR` (milisegundos) otra réplica puede servir la versión anterior, y si el `INCR` falla, el TTL de 60 s lo acota.

**Muéstralo en:** [reportes.cache.ts:36](../../apps/api/src/modules/reportes/reportes.cache.ts#L36 "SEGUNDOS_CACHE_REPORTES = 60") y [reportes.service.ts:57](../../apps/api/src/modules/reportes/reportes.service.ts#L57 "cache.contador(claveDeVersion(d))"). Detalle: [reportes](modulos/reportes.md).

## Lo que no está

### 30. ¿Qué no está hecho, o qué cambiarías antes de producción?

- **Frontend:** `apps/web` todavía no tiene código; la tienda, el backoffice y el dashboard son la Fase 2.
- **Producción:** SQL Server Standard o Enterprise, HTTPS en nginx y secretos fuera de `.env`.
- **Cobertura:** el reporte mide solo las unitarias y no tiene un umbral mínimo.
- **Health:** nginx no lo consulta; saca una réplica solo por errores de conexión (detección pasiva).

Todo está en [README §8](../../README.md) y en [docs/revision/estado-backend.md](../revision/estado-backend.md). Detalle: [infraestructura](transversal/infraestructura.md), [pruebas](transversal/pruebas.md).
