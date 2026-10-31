-- Solo existe en shopcart_test: crea una reserva 'Activa' que vence en @MinutosParaVencer (negativo =
-- ya vencida), en una sesión de checkout nueva de un usuario nuevo.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_CrearReserva
    @IDVariante        INT,
    @Cantidad          INT,
    @MinutosParaVencer INT,
    @IDUsuarioActor    INT              = NULL,
    @RolActor          VARCHAR(20)      = NULL,
    @RequestId         UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRAN;

        DECLARE @Usuario TABLE (IDUsuario INT);
        INSERT INTO @Usuario
        EXEC dbo.SP_Pruebas_CrearUsuario @IDUsuarioActor = @IDUsuarioActor, @RolActor = @RolActor, @RequestId = @RequestId;
        DECLARE @IDUsuario INT = (SELECT IDUsuario FROM @Usuario);

        DECLARE @Sesion TABLE (IDSesionCheckout INT);
        INSERT INTO @Sesion EXEC dbo.SP_Pruebas_CrearSesionCheckout @IDUsuario = @IDUsuario;

        INSERT INTO dbo.Reserva (IDSesionCheckout, IDVariante, Cantidad, Estado, FechaExpiracion)
        SELECT IDSesionCheckout, @IDVariante, @Cantidad, 'Activa', DATEADD(MINUTE, @MinutosParaVencer, SYSUTCDATETIME())
        FROM @Sesion;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
