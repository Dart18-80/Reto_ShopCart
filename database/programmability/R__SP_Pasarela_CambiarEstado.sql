-- N-03 (E5-H02): la pasarela simulada captura o anula una autorización (@Estado = 'Capturada' o 'Anulada').
-- Idempotente: si ya está en ese estado no cambia nada. Solo se captura o anula una autorización Autorizada;
-- en otro estado responde 50002 (el adaptador lo convierte en un error de la pasarela). Solo la usa el
-- adaptador PasarelaSimulada, nunca dentro de una transacción del checkout.
CREATE OR ALTER PROCEDURE dbo.SP_Pasarela_CambiarEstado
    @IDTransaccion  VARCHAR(64),
    @Estado         VARCHAR(12),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @Estado NOT IN ('Capturada', 'Anulada')
        THROW 50003, N'La pasarela solo captura o anula.', 1;

    DECLARE @Actual VARCHAR(12);

    BEGIN TRY
        BEGIN TRAN;

        SELECT @Actual = a.Estado
        FROM   dbo.PasarelaAutorizacion AS a WITH (UPDLOCK, ROWLOCK)
        WHERE  a.IDTransaccion = @IDTransaccion;

        IF @Actual IS NULL
            THROW 50001, N'La transacción no existe en la pasarela.', 1;
        IF @Actual NOT IN ('Autorizada', @Estado)
            THROW 50002, N'La transacción no admite ese cambio en su estado actual.', 1;

        UPDATE dbo.PasarelaAutorizacion
        SET    Estado = @Estado, FechaActualizacion = SYSUTCDATETIME()
        WHERE  IDTransaccion = @IDTransaccion AND Estado = 'Autorizada';

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
