# SPs y triggers de prueba (`R__SP_Pruebas_*`, `R__TR_Pruebas_*`)

Solo existen en la base `shopcart_test`: el migrador agrega esta carpeta únicamente cuando la base es `shopcart_test` (`carpetasPara` en `database/migrator/src/scripts.ts`), y `leer-scripts.test.ts` lo verifica. Nunca llegan a `ShopCart`.

Sirven para que las pruebas de `apps/` no contengan SQL: preparan datos y provocan los casos que hay que probar. Los triggers de prueba (`R__TR_Pruebas_*`) provocan una falla real dentro de la transacción de un SP, solo ante datos marcados por la prueba (por ejemplo, `TR_Pruebas_FallarPaseDeCarrito` con un SKU `FALLA-…`).

**Excepción deliberada a N-07 y M-01.** Algunos escriben `Variante.ExistenciaFisica`, `MovimientoKardex` o `HistorialEstadoPedido` sin pasar por el SP que lo hace en producción (`SP_Inventario_RegistrarMovimiento`, `SP_Pedidos_*`), o intentan un `UPDATE`/`DELETE` sobre un ledger. Es a propósito: así se prueban los constraints, los triggers y el rechazo del motor contra escrituras directas.

Aun así, todo SP de prueba que escribe sigue la plantilla de `CLAUDE.md` (`SET XACT_ABORT ON`, `TRY`/`TRAN`/`CATCH` y `SP_Sistema_EstablecerContexto`). Lo verifica `database/migrator/test/convenciones-sql.test.ts`.
