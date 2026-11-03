-- RF-09, E9-H04: un reembolso queda en la bitácora al crearse y en cada cambio de estado (el job, el reintento del
-- Admin y su resolución manual, con el motivo y la referencia). Los cambios del reclamo del job (token y próximo
-- intento) no se registran: no cambian el estado.
CREATE OR ALTER TRIGGER dbo.TR_Pedidos_ReembolsoBitacora
ON dbo.Reembolso
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM inserted AS i LEFT JOIN deleted AS d ON d.IDReembolso = i.IDReembolso
                   WHERE d.IDReembolso IS NULL OR i.Estado <> d.Estado) RETURN;

    -- A-18: toda escritura auditada declara quién la hace (los jobs y el migrador, Rol = 'Sistema').
    IF SESSION_CONTEXT(N'Rol') IS NULL
        THROW 50004, N'Falta el contexto de la operación: llama a SP_Sistema_EstablecerContexto.', 1;

    DECLARE @IDUsuario INT              = TRY_CONVERT(INT, SESSION_CONTEXT(N'IDUsuario')),
            @RequestId UNIQUEIDENTIFIER = TRY_CONVERT(UNIQUEIDENTIFIER, SESSION_CONTEXT(N'RequestId'));

    INSERT INTO dbo.Bitacora (Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, IDUsuario, RequestId)
    SELECT  'Pedidos', 'Reembolso', CONVERT(VARCHAR(50), i.IDReembolso),
            IIF(d.IDReembolso IS NULL, 'Crear', 'CambioEstado'),
            CASE WHEN d.IDReembolso IS NULL THEN NULL
                 ELSE (SELECT d.Estado, d.Intentos FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
            (SELECT i.Origen, i.IDPedido, i.IDIntentoPago, i.Monto, i.Estado, i.Intentos, i.MotivoResolucion,
                    i.ReferenciaResolucion
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            @IDUsuario, @RequestId
    FROM    inserted AS i
    LEFT JOIN deleted AS d ON d.IDReembolso = i.IDReembolso
    WHERE   d.IDReembolso IS NULL OR i.Estado <> d.Estado;
END
GO
