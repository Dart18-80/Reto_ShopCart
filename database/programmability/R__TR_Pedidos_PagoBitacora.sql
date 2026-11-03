-- RF-09, E9-H04: en IntentoPago solo se registra el cambio de estado, con la resolución manual del Admin cuando la
-- hay (quién, cuándo y el motivo). Nunca los datos de la tarjeta. Módulo Pedidos: el pago es del pedido, y el CHECK
-- de módulo de la tabla ledger Bitacora no cambia (M-01).
CREATE OR ALTER TRIGGER dbo.TR_Pedidos_PagoBitacora
ON dbo.IntentoPago
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT UPDATE(Estado) RETURN;
    IF NOT EXISTS (SELECT 1 FROM inserted AS i JOIN deleted AS d ON d.IDIntentoPago = i.IDIntentoPago
                   WHERE i.Estado <> d.Estado) RETURN;

    -- A-18: toda escritura auditada declara quién la hace (los jobs y el migrador, Rol = 'Sistema').
    IF SESSION_CONTEXT(N'Rol') IS NULL
        THROW 50004, N'Falta el contexto de la operación: llama a SP_Sistema_EstablecerContexto.', 1;

    DECLARE @IDUsuario INT              = TRY_CONVERT(INT, SESSION_CONTEXT(N'IDUsuario')),
            @RequestId UNIQUEIDENTIFIER = TRY_CONVERT(UNIQUEIDENTIFIER, SESSION_CONTEXT(N'RequestId'));

    INSERT INTO dbo.Bitacora (Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, IDUsuario, RequestId)
    SELECT  'Pedidos', 'IntentoPago', CONVERT(VARCHAR(50), i.IDIntentoPago), 'CambioEstado',
            (SELECT d.Estado, d.CodigoRespuesta FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            (SELECT i.Estado, i.CodigoRespuesta, i.ResolucionManual, i.MotivoResolucion
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            @IDUsuario, @RequestId
    FROM    inserted AS i
    JOIN    deleted  AS d ON d.IDIntentoPago = i.IDIntentoPago
    WHERE   i.Estado <> d.Estado;
END
GO
