-- RF-04, N-06: quita una línea del carrito de quien pide (resuelto como en SP_Carrito_Obtener), en
-- cualquier estado. Una línea de otro carrito responde 404, igual que una inexistente (RF-01). El carrito
-- queda Activo aunque se vacíe. Devuelve el carrito completo (SP_Carrito_Obtener).
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_EliminarLinea
    @IDLineaCarrito    INT,
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

        DELETE FROM dbo.LineaCarrito
        WHERE  IDLineaCarrito = @IDLineaCarrito AND IDCarrito = @IDCarrito;

        IF @@ROWCOUNT = 0
            THROW 50001, N'La línea no existe en tu carrito.', 1;

        UPDATE dbo.Carrito SET FechaUltimaActividad = SYSUTCDATETIME() WHERE IDCarrito = @IDCarrito;

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
