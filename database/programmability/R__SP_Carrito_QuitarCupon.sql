-- RF-05: quita el cupón del carrito de quien pide (resuelto como en SP_Carrito_Obtener). Idempotente: sin
-- cupón no cambia nada. Sin carrito Activo, ningún conjunto. Devuelve el carrito completo.
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_QuitarCupon
    @HashTokenInvitado BINARY(32)       = NULL,
    @IDUsuarioActor    INT              = NULL,
    @RolActor          VARCHAR(20)      = NULL,
    @RequestId         UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @IDCliente      INT        = CASE WHEN @RolActor = 'Cliente' THEN @IDUsuarioActor END;
    DECLARE @HashDelCarrito BINARY(32) = CASE WHEN @IDCliente IS NULL THEN @HashTokenInvitado END;
    DECLARE @IDCarrito INT;

    BEGIN TRY
        BEGIN TRAN;

        EXEC dbo.SP_Carrito_BloquearActivo @IDCliente, @HashDelCarrito, @IDCarrito OUTPUT;

        UPDATE dbo.Carrito
        SET    IDCupon = NULL, FechaUltimaActividad = SYSUTCDATETIME()
        WHERE  IDCarrito = @IDCarrito AND IDCupon IS NOT NULL;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    EXEC dbo.SP_Carrito_Obtener @HashTokenInvitado = @HashDelCarrito, @IDUsuarioActor = @IDUsuarioActor,
                                @RolActor = @RolActor, @RequestId = @RequestId;
END
GO
