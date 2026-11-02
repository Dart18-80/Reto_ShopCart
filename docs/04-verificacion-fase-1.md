# Verificación de la Fase 1 (E8-H02)

Revisión contra las penalizaciones directas del enunciado (§08) y recorrido de los criterios de aceptación de RF-01 a RF-09, cada uno con la prueba automatizada que lo demuestra. Las rutas de las pruebas son relativas a `apps/api/test/`, salvo las del migrador.

## 1. Checklist automatizada

Corre con `pnpm test`; cualquier violación futura rompe la suite.

| Penalización o regla | Prueba | Qué verifica |
|---|---|---|
| SQL en el backend | `database/migrator/test/penalizaciones.test.ts` → "sin SQL en el backend" | Ninguna sentencia SQL en el TypeScript de la API, sus pruebas, `packages/shared` ni el código del migrador; la API nunca llama a `query` ni `batch` de mssql (solo `execute` de un SP) |
| Concatenación en SQL dinámico | `penalizaciones.test.ts` → "el texto de un SQL dinámico nunca concatena valores" | Lo que se concatena en la variable que recibe `sp_executesql` es un literal o una variable armada solo con literales; nunca `EXEC(...)`. En los scripts del migrador, solo `QUOTENAME` (excepción documentada en la skill `sqlserver-sp` §11) |
| Tipos prohibidos | `penalizaciones.test.ts` → "§05: ningún FLOAT, REAL, MONEY…" | Todos los scripts de `database/`, sin contar comentarios ni textos |
| Secretos en el repositorio | `unit/secretos.test.ts` | Cada secreto de `.env.example` está marcado `EJEMPLO` y `.env` está en `.gitignore` (además, `cargarConfiguracion` rechaza un valor `EJEMPLO` en producción) |
| OpenAPI completo | `unit/openapi-rutas.test.ts` | Cada ruta registrada en Express bajo `/api/v1` está en el documento y cada operación documentada existe; `unit/app.api.test.ts` verifica el esquema `bearer` |
| Plantilla y nomenclatura de los SPs | `database/migrator/test/convenciones-sql.test.ts` | Todo SP que escribe tiene `XACT_ABORT`, `EstablecerContexto` y `TRY/TRAN/CATCH`; los internos exigen la transacción del llamador |

## 2. Revisión con `revisor-shopcart` sobre todo el repositorio

Sin hallazgos CRÍTICOS, ALTOS ni MEDIOS. Las tres observaciones BAJAS quedaron resueltas:

| Observación | Resolución |
|---|---|
| El healthcheck de SQL Server en `docker-compose.yml` usa `sqlcmd -Q "SELECT 1"` | Es infraestructura, no backend: `sqlcmd` necesita una consulta trivial para saber que el motor acepta conexiones. Quedó comentado en el compose; la API solo ejecuta `SP_Sistema_Health` |
| Las pruebas del lector de scripts del migrador contienen texto SQL | Es el texto de entrada del divisor de lotes y nunca se ejecuta; quedó comentado en `scripts.test.ts` y `leer-scripts.test.ts` |
| `SP_Pedidos_ListarReembolsos` ordena por fecha sin un índice que lo soporte | `V020__indice_reembolso_por_fecha.sql`: `IX_Reembolso_Fecha (FechaCreacion DESC, IDReembolso DESC) INCLUDE (Estado)` |

Al preparar el flujo de Swagger de E8-H01 apareció además un hallazgo real: las rutas protegidas declaraban `security: bearer`, pero el documento no definía el esquema y Swagger no ofrecía **Authorize**. Se corrigió en E8-H01 y lo cubre `unit/app.api.test.ts`.

### Revisión de E7-H04 y E7-H05 (alcance agregado al cierre)

`revisor-shopcart` y `typescript-reviewer` sobre la caché de reportes y la exportación asíncrona: sin hallazgos CRÍTICOS ni ALTOS.

**MEDIOS corregidos (`aa09dcb`):**
- un archivo vencido se descargaba hasta que pasara la purga; ahora responde 410;
- un fallo del almacén antes de leer el stream dejaba colgado al generador;
- un error del documento PDF quedaba sin listener;
- el apagado ordenado no esperaba las exportaciones en curso;
- dos pruebas no verificaban lo que decían.

**Resuelto (`15ffc5f`):** si la base falla al registrar un archivo ya guardado, ese archivo queda sin referencia en el almacén; no se borra en el momento, porque el COMMIT pudo ocurrir aunque se perdiera la respuesta (A-24). Por decisión del PO, la purga horaria lo barre: borra los archivos sin referencia con más de 24 h y nunca uno referenciado (`purga.test.ts` y `secuencial/exportaciones.api.test.ts`).

## 3. Criterios de aceptación de RF-01 a RF-09

| RF | Criterio | Prueba que lo demuestra |
|---|---|---|
| RF-01 | Cambiar el identificador de un pedido, carrito o dirección no expone ni modifica datos de otro cliente | `integracion/pedidos/consulta.api.test.ts` → "el pedido de otro cliente responde 404, igual que uno inexistente"; `integracion/pedidos/cancelacion.api.test.ts` → "… el pedido de otro cliente, 404"; `integracion/carrito/carrito.api.test.ts` → "la línea de otro cliente responde 404 en PATCH y DELETE, y no cambia"; `integracion/direcciones/direcciones.api.test.ts` → "RF-01: un cliente que usa el ID de una dirección de otro recibe 404 al leerla, editarla o borrarla" y "A-02: el SP rechaza editar o borrar una dirección ajena aunque el servicio no la haya filtrado"; `integracion/checkout/iniciar-sesion.api.test.ts` → "… dirección ajena o método inexistente → 404" y "… un idUsuario en el cuerpo 400" |
| RF-01 | Un token expirado devuelve 401 y un recurso no permitido, 403 | `unit/shared/http/autenticar.test.ts` → "un token vencido responde 401"; `integracion/auth/refresh-logout.api.test.ts` → "un refresh vencido responde 401"; `integracion/catalogo/productos.api.test.ts` → "un Cliente o un Operador recibe 403 en cada ruta de administración, y sin token 401"; `integracion/pedidos/consulta.api.test.ts` → "un Cliente no entra a la gestión (403)" |
| RF-02 | Un cambio de precio no altera el monto de pedidos ya realizados | `integracion/pedidos/consulta.api.test.ts` → "un cambio de precio posterior no altera el monto de un pedido ya realizado"; `integracion/checkout/iniciar-sesion.api.test.ts` → "un cambio de precio posterior no afecta la sesión" |
| RF-03 | La existencia actual coincide con la suma del kardex | `integracion/inventario/inventario.api.test.ts` → "CA: tras movimientos simultáneos, el saldo cuadra con el kardex y la conciliación no muestra la variante"; `integracion/semillas/datos-demo.test.ts` → "kardex, pedidos e historial coinciden en el tiempo y la conciliación de inventario queda vacía"; `concurrencia/checkout.concurrencia.test.ts` (conciliación vacía tras cada escenario) |
| RF-03 | Un ajuste manual exige motivo y no deja la existencia en negativo | `integracion/inventario/inventario.api.test.ts` → "CA: un ajuste %s responde 400 MOTIVO_REQUERIDO" (sin motivo, vacío y solo espacios) y "CA: un ajuste que deja la existencia negativa responde 422 AJUSTE_DEJA_NEGATIVO" |
| RF-04 | No se agrega más que la existencia disponible | `integracion/carrito/carrito.api.test.ts` → "no se puede agregar más de lo disponible…", "PATCH cambia la cantidad; por encima de lo disponible responde 409 y no cambia" y "cinco sumas simultáneas de 2 unidades con 5 disponibles nunca pasan de 5" |
| RF-04 | El total no presenta errores de redondeo | `integracion/carrito/carrito.api.test.ts` → "cuadran al centavo con DECIMAL y viajan como texto"; `integracion/carrito/cupon.api.test.ts` → "Q10.00 entre tres líneas iguales: el centavo sobrante va a la primera" |
| RF-05 | Un cupón vencido, agotado o bajo el mínimo se rechaza con un mensaje específico | `integracion/semillas/datos-demo.test.ts` → "hay un cupón para demostrar cada mensaje de rechazo de RF-05" (un código por cada caso); `integracion/carrito/cupon.api.test.ts` → "agotado responde CUPON_AGOTADO" y "el mínimo no alcanzado indica cuánto falta" |
| RF-05 | El límite total de usos se respeta con clientes simultáneos | `concurrencia/checkout.concurrencia.test.ts` → "escenario 2: 20 clientes por el último uso de un cupón → 1 pedido con cupón y 19 × 422 CUPON_AGOTADO"; `integracion/checkout/iniciar-sesion.api.test.ts` → "el cupón con un solo uso y cinco clientes simultáneos…" |
| RF-05 | Un descuento nunca deja el total por debajo de cero | `integracion/carrito/cupon.api.test.ts` → "un monto fijo mayor que el subtotal deja el total en cero, nunca negativo" |
| RF-06 | Dos clientes por la última unidad: uno compra y el otro recibe un mensaje claro; nunca hay sobreventa | `concurrencia/checkout.concurrencia.test.ts` → "escenario 1: 20 clientes por la última unidad → 1 pedido y 19 × 409 STOCK_INSUFICIENTE" (contra las dos réplicas); `integracion/checkout/iniciar-sesion.api.test.ts` → "todo o nada: si una línea no alcanza, 409 con el disponible…" |
| RF-06 | Repetir la solicitud de pago no genera dos pedidos ni dos cobros | `integracion/checkout/pagar.api.test.ts` → "doble clic con la misma llave: un solo pedido y un solo cobro; el reintento recibe el mismo pedido"; `integracion/checkout/pago-fallas.api.test.ts` → "la misma llave de un pedido fallido devuelve el mismo error sin volver a cobrar"; `integracion/checkout/vigencia-del-pago.api.test.ts` (fencing del arrendamiento) |
| RF-06 | La creación del pedido es atómica | `integracion/checkout/pago-fallas.api.test.ts` → "si el pedido falla dentro del SP no queda pedido, detalle, kardex ni cupón confirmado, y se anula la autorización" y "se revierten la salida del kardex, la existencia, las reservas, el cupón, la sesión y el carrito" |
| RF-07 | Una transición no permitida se rechaza en el backend y en la base | `integracion/pedidos/estados.api.test.ts` → "primera capa (backend)…", "segunda capa (SP)…" y "tercera defensa (trigger): un UPDATE directo con una transición inválida se revierte"; `integracion/esquema/pedidos.test.ts` → "rechaza con 50701 una transición que no existe para el rol" |
| RF-07 | Cancelar o devolver reintegra la existencia en el kardex y se refleja en los reportes | `integracion/pedidos/cancelacion.api.test.ts` → "desde Pagado: Cancelado, reingreso al kardex, cupón revertido y reembolso del total con envío"; `integracion/pedidos/devoluciones.api.test.ts` → "parcial: DevueltoParcial, reingreso al inventario y reembolso…"; `integracion/reportes/dashboard.api.test.ts` → "el resumen cuenta pedidos no cancelados…" y "las devoluciones se restan en su propio día de Guatemala" |
| RF-07 | Una reserva vencida libera la existencia sin intervención manual | `integracion/secuencial/tareas-periodicas.test.ts` → "una sesión vencida pasa a Expirada y libera sus reservas y el uso del cupón"; `integracion/inventario/inventario.api.test.ts` → "una reserva vencida no cuenta como reservada para el ajuste" |
| RF-07 | No se devuelve más de lo vendido por línea | `integracion/pedidos/devoluciones.api.test.ts` → "no se devuelve más de lo vendido: 422 DEVOLUCION_EXCEDE_VENDIDO con lo que queda por línea" |
| RF-07 | Cada cambio de estado registra usuario, fecha y hora, estado anterior y nuevo | `integracion/pedidos/estados.api.test.ts` → "recorre Pagado → EnPreparacion → Despachado → Entregado y registra quién, cuándo, de qué a qué y por qué" |
| RF-08 | Los listados usan paginación y filtros del lado del servidor | `integracion/pedidos/consulta.api.test.ts` → "filtra por cliente y por estado…" y "el rango de fechas usa FechaPagoLocal…"; `integracion/secuencial/paginacion.api.test.ts`; `integracion/secuencial/bitacora-paginacion.api.test.ts` |
| RF-08 | Los reportes excluyen cancelados y descuentan devoluciones | `integracion/reportes/dashboard.api.test.ts` → "el resumen cuenta pedidos no cancelados en su día de pago…", "las devoluciones se restan en su propio día…", "ventas por categoría y top productos del periodo" y "cada reporte responde en menos de 1 s (RNF-1)" |
| RF-09 | La bitácora no puede modificarse ni eliminarse | `integracion/esquema/ledger.test.ts` → "Bitacora rechaza Modificar" y "Bitacora rechaza Eliminar" (error 37359 del motor, también para el kardex y el historial); `integracion/esquema/bitacora.test.ts` (qué registra cada trigger, con montos como texto) |

## 4. Resultado

Cero hallazgos abiertos. Lint, tipos y las suites unitaria, de integración y de concurrencia pasan desde cero (E8-H03).
