-- V014 (cierre de E5, N-03): token de fencing del arrendamiento del intento de pago. Cada toma del arrendamiento
-- (la petición que registra o retoma el intento, o la conciliación) genera un token nuevo; los SPs que escriben
-- el intento o crean el pedido reciben el token y verifican bajo UPDLOCK que sigue siendo el vigente. Así una
-- petición "zombi", cuyo arrendamiento ya tomó otro proceso, no puede crear el pedido ni cambiar el intento.
ALTER TABLE dbo.IntentoPago ADD TokenArrendamiento UNIQUEIDENTIFIER NULL;
GO
