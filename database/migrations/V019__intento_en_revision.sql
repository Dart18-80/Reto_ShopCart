-- V019 (cierre de E6 y E7, N-03): estado terminal EnRevision del intento de pago. La conciliación lo usa
-- cuando un intento con pedido no se puede cobrar porque su autorización ya no existe en la pasarela (anulada
-- o desconocida). Queda para revisión manual, se registra una sola vez y no se vuelve a tomar.
ALTER TABLE dbo.IntentoPago DROP CONSTRAINT CK_IntentoPago_Estado;
ALTER TABLE dbo.IntentoPago ADD CONSTRAINT CK_IntentoPago_Estado CHECK (
    Estado IN ('Pendiente', 'Autorizado', 'Capturado', 'Rechazado', 'Anulado', 'Fallido', 'Error', 'EnRevision'));
GO
