-- Solo existe en shopcart_test: vence las reservas de una sesión de checkout (siguen Activa, pero ya no cuentan
-- para el disponible), para probar que el pedido las vuelve a validar dentro de su transacción (N-06).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_VencerReservasSesion
    @IDSesionCheckout INT,
    @IDUsuarioActor   INT              = NULL,
    @RolActor         VARCHAR(20)      = NULL,
    @RequestId        UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    BEGIN TRY
        BEGIN TRAN;
        UPDATE dbo.Reserva
        SET    FechaExpiracion = DATEADD(MILLISECOND, -10, SYSUTCDATETIME())
        WHERE  IDSesionCheckout = @IDSesionCheckout AND Estado = 'Activa';
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
