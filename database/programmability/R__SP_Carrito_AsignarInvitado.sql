-- N-05: al registrarse, el carrito de invitado Activo (@HashTokenInvitado) pasa a ser el del cliente nuevo
-- (@IDUsuarioActor), con sus líneas, precios garantizados y alertas tal cual. El hash del token se borra:
-- la cookie deja de servir. Sin carrito de invitado Activo, no hace nada.
-- UX_Carrito_ActivoPorUsuario es la autoridad: un cliente nuevo no tiene carrito, y si lo tuviera el
-- índice rechaza el cambio.
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_AsignarInvitado
    @HashTokenInvitado BINARY(32),
    @IDUsuarioActor    INT              = NULL,
    @RolActor          VARCHAR(20)      = NULL,
    @RequestId         UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @IDCliente INT = CASE WHEN @RolActor = 'Cliente' THEN @IDUsuarioActor END;
    IF @IDCliente IS NULL
        THROW 50003, N'Solo un cliente puede recibir un carrito de invitado.', 1;

    DECLARE @IDCarrito INT;

    BEGIN TRY
        BEGIN TRAN;

        EXEC dbo.SP_Carrito_BloquearActivo NULL, @HashTokenInvitado, @IDCarrito OUTPUT;

        UPDATE dbo.Carrito
        SET    IDUsuario = @IDCliente, HashTokenInvitado = NULL, FechaUltimaActividad = SYSUTCDATETIME()
        WHERE  IDCarrito = @IDCarrito;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
