-- Solo existe en shopcart_test: lleva la fecha de una llave de idempotencia @Horas horas atrás, para probar
-- la purga horaria sin esperar. La hora la decide la base.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_EnvejecerSolicitudIdempotente
    @LlaveIdempotencia UNIQUEIDENTIFIER,
    @Horas             INT,
    @IDUsuarioActor    INT              = NULL,
    @RolActor          VARCHAR(20)      = NULL,
    @RequestId         UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    BEGIN TRY
        BEGIN TRAN;
        UPDATE dbo.SolicitudIdempotente
        SET    FechaCreacion = DATEADD(HOUR, -@Horas, SYSUTCDATETIME())
        WHERE  LlaveIdempotencia = @LlaveIdempotencia;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
