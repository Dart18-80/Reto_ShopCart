-- Solo existe en shopcart_test: mueve el arrendamiento de un intento de pago @Segundos desde ahora (negativo =
-- vencido hace ese tiempo), para probar el 409 con el arrendamiento vivo, la retoma y la conciliación sin
-- esperar. La hora la decide la base.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_MoverArrendamiento
    @IDIntentoPago  BIGINT,
    @Segundos       INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    BEGIN TRY
        BEGIN TRAN;
        UPDATE dbo.IntentoPago
        SET    ArrendadoHasta = DATEADD(SECOND, @Segundos, SYSUTCDATETIME())
        WHERE  IDIntentoPago = @IDIntentoPago;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
