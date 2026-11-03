# Plan E9-H04 · Revisión manual de pagos y reembolsos

Historia grande: plan escrito y verificado contra las decisiones del PO antes de implementar.

## 1. Dónde vive

En el módulo `pedidos`: ya tiene la lista y el reintento de reembolsos, el puerto `PasarelaPago` y la cancelación. Solo Admin.

| Endpoint | SP |
|---|---|
| `GET /admin/pagos/en-revision` (paginado) | `SP_Pedidos_ListarPagosEnRevision` |
| `POST /admin/pagos/:id/resolver` `{ resolucion, motivo }` | `SP_Pedidos_ResolverPagoEnRevision` |
| `POST /admin/reembolsos/:id/resolver` `{ motivo, referencia }` | `SP_Pedidos_ResolverReembolso` |

## 2. Base de datos (V023)

- `IntentoPago`: `ResolucionManual` (`CobroVerificado`, `SinCobro` o `Reembolsar`), `MotivoResolucion`, `IDUsuarioResolucion` (FK) y `FechaResolucion`; un `CHECK` exige los cuatro juntos o ninguno. Índice filtrado de los `EnRevision` para la lista.
- `Reembolso`: `IDPedido` pasa a admitir `NULL` y se agrega `IDIntentoPago` (FK), con `CK_Reembolso_Destino`: exactamente uno de los dos. Origen nuevo `CobroSinPedido` (con el intento, sin devolución). `UX_Reembolso_PorIntento`: un solo reembolso por intento, por el monto del intento: nunca más de lo capturado. Estado nuevo `ResueltoManual` con `MotivoResolucion`, `ReferenciaResolucion`, `IDUsuarioResolucion` y `FechaResolucion`, exigidos juntos.
- `Pedido.MontoReembolsado` no cambia al resolver un reembolso a mano: ya se sumó al crearlo, así que `ResueltoManual` cuenta como reembolsado.

## 3. Resoluciones

El servicio consulta primero la llave del intento en la pasarela (`consultar`), fuera de toda transacción; después el SP bloquea el intento (`UPDLOCK`), vuelve a validar que siga `EnRevision` (si no, 50707, 409) y que la resolución aplique a su caso (50708, 422).

| Resolución | Caso | Pasarela | Efecto |
|---|---|---|---|
| `CobroVerificado` | Con pedido | Debe estar `Capturada`; si no, `COBRO_SIN_CAPTURA` (409) y nada cambia | Intento `Capturado` con la transacción; el pedido sigue su flujo |
| `SinCobro` | Con pedido | No debe estar `Capturada` («como no hubo captura»): si lo está, `COBRO_CAPTURADO` (409) | La cancelación existente: el cuerpo de `SP_Pedidos_Cancelar` pasa a un SP interno (`SP_Pedidos_AplicarCancelacion`) que usan los dos, sin un camino paralelo. Con el pago en revisión no crea reembolso. El intento pasa a `Anulado` |
| `Reembolsar` | Sin pedido | Debe estar `Capturada` | Reembolso `Pendiente` por el monto del intento, con llave determinista; lo procesa el flujo de siempre (la petición y el job). El intento queda `Capturado` |

`SP_Pedidos_ResolverReembolso`: bloquea el reembolso; solo desde `Fallido` (50709, 409). La conciliación (solo toma `Pendiente` y `Autorizado`) y el job de reembolsos (solo toma `Pendiente`) nunca tocan un intento `EnRevision` ni un reembolso `ResueltoManual`; el reintento solo acepta `Fallido` o `Pendiente`.

Los SPs del job (`TomarReembolso`, `ObtenerReembolsosPendientes`, `ListarReembolsos`) llegan al intento por el pedido o, sin pedido, directo.

## 4. Bitácora

`TR_Pedidos_PagoBitacora` (sobre `IntentoPago`, solo cuando cambia `Estado`) y `TR_Pedidos_ReembolsoBitacora` (al crearse y cuando cambia `Estado`: cubre el reintento). Módulo `Pedidos`: el `CHECK` de módulo de la tabla ledger `Bitacora` no se cambia (M-01). Sin datos de tarjeta en los valores.

## 5. Errores

50707 `PAGO_NO_EN_REVISION` (409), 50708 `RESOLUCION_NO_APLICA` (422), 50709 `REEMBOLSO_NO_FALLIDO` (409); de la API, `COBRO_SIN_CAPTURA` (409) y `COBRO_CAPTURADO` (409).

## 6. Pruebas

Integración: cada resolución con su efecto y su fila de bitácora; `CobroVerificado` rechazado sin captura sin cambiar nada; dos resoluciones simultáneas del mismo intento y del mismo reembolso (una pasa, la otra 409); 403 para Operador y Cliente; el reembolso `ResueltoManual` no lo toma el job ni lo reintenta el Admin; la cancelación existente sigue igual. Unitarias del servicio con la pasarela falsa.

## 7. Verificación contra las decisiones del PO

| Decisión | Sección |
|---|---|
| Tres resoluciones; `CobroVerificado` solo con `Capturada` | §3 |
| `SinCobro` reutiliza la cancelación, sin reembolso, con el motivo | §3 |
| `Reembolsar` con el reembolso apuntando al intento, exactamente uno, nunca más de lo capturado | §2, §3 |
| `ResueltoManual` con motivo, referencia, quién y cuándo; cuenta como reembolsado | §2 |
| Solo Admin; solo desde `EnRevision` o `Fallido`, con bloqueo; dos veces → 409; la conciliación y el job no los tocan | §1, §3 |
| Triggers de bitácora en `IntentoPago` y `Reembolso` | §4 |
| Pruebas pedidas | §6 |
