-- Solo existe en shopcart_test: vence una sesión de checkout (sin esperar los 15 minutos ni el job), para
-- probar que su reserva de cupón deja de contar. La hora la decide la base.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_VencerSesionCheckout
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
        UPDATE dbo.SesionCheckout
        SET    FechaExpiracion = DATEADD(MILLISECOND, -10, SYSUTCDATETIME())
        WHERE  IDSesionCheckout = @IDSesionCheckout;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
