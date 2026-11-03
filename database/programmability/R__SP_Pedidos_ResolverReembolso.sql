-- E9-H04 (decisión del PO): el Admin resuelve a mano un reembolso Fallido (por ejemplo, devolvió el dinero por
-- transferencia): pasa a ResueltoManual con el motivo, la referencia, quién y cuándo, distinto de Completado.
-- Para los montos ya cuenta como reembolsado: Pedido.MontoReembolsado se sumó al crearlo. Bajo bloqueo: solo
-- desde Fallido (50709; resolver dos veces responde 409). El job y el reintento nunca lo vuelven a tomar (solo
-- toman Pendiente y Fallido). Queda en la bitácora (TR_Pedidos_ReembolsoBitacora). Solo el Administrador.
-- Antes, el servicio consulta el reembolso en la pasarela por su llave: si ya lo procesó, no llega aquí
-- (SP_Pedidos_CompletarReembolsoProcesado lo deja Completado).
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_ResolverReembolso
    @IDReembolso    INT,
    @Motivo         NVARCHAR(250),
    @Referencia     NVARCHAR(100),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @RolActor IS NULL OR @RolActor <> 'Administrador' OR @IDUsuarioActor IS NULL
        THROW 50005, N'Solo el Administrador resuelve un reembolso a mano.', 1;
    IF NULLIF(LTRIM(RTRIM(@Motivo)), N'') IS NULL OR NULLIF(LTRIM(RTRIM(@Referencia)), N'') IS NULL
        THROW 50003, N'La resolución requiere un motivo y una referencia.', 1;

    DECLARE @Estado VARCHAR(14);

    BEGIN TRY
        BEGIN TRAN;

        SELECT @Estado = r.Estado
        FROM   dbo.Reembolso AS r WITH (UPDLOCK, ROWLOCK)
        WHERE  r.IDReembolso = @IDReembolso;

        IF @Estado IS NULL
            THROW 50001, N'El reembolso no existe.', 1;
        IF @Estado <> 'Fallido'
            THROW 50709, N'Solo se resuelve a mano un reembolso Fallido; este ya no lo está.', 1;

        UPDATE dbo.Reembolso
        SET    Estado = 'ResueltoManual', MotivoResolucion = LTRIM(RTRIM(@Motivo)),
               ReferenciaResolucion = LTRIM(RTRIM(@Referencia)), IDUsuarioResolucion = @IDUsuarioActor,
               FechaResolucion = SYSUTCDATETIME(), FechaProximoIntento = NULL, TokenReclamo = NULL,
               FechaActualizacion = SYSUTCDATETIME()
        WHERE  IDReembolso = @IDReembolso;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT r.IDReembolso, r.IDPedido, p.NumeroPedido, r.IDIntentoPago, r.IDDevolucion, r.Origen, r.Monto, r.Estado,
           r.Intentos, r.UltimoError, r.IDTransaccionReembolso, r.FechaProximoIntento, r.FechaCompletado,
           r.FechaCreacion, r.MotivoResolucion, r.ReferenciaResolucion, r.FechaResolucion
    FROM   dbo.Reembolso AS r
    LEFT JOIN dbo.Pedido AS p ON p.IDPedido = r.IDPedido
    WHERE  r.IDReembolso = @IDReembolso;
END
GO
