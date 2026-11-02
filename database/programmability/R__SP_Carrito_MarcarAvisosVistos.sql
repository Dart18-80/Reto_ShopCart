-- N-02: el cliente vio las alertas "El precio cambió de Q… a Q…" de su carrito (resuelto como en
-- SP_Carrito_Obtener): se borran. Los avisos que dependen del precio vigente (garantizado, bajó de precio)
-- no se guardan y no cambian. Sin carrito Activo, ningún conjunto. Devuelve el carrito completo.
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_MarcarAvisosVistos
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

        UPDATE dbo.LineaCarrito
        SET    PrecioAnteriorAviso = NULL, FechaActualizacion = SYSUTCDATETIME()
        WHERE  IDCarrito = @IDCarrito AND PrecioAnteriorAviso IS NOT NULL;

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
