-- Solo existe en shopcart_test: cambia lo que la pasarela simulada sabe de una llave (por ejemplo, una
-- autorización anulada), para probar que una resolución manual exige la evidencia de la pasarela (E9-H04).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_CambiarEstadoEnPasarela
    @LlaveIdempotencia UNIQUEIDENTIFIER,
    @Estado            VARCHAR(12),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Rol VARCHAR(20) = COALESCE(@RolActor, 'Sistema');
    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @Rol, @RequestId;

    BEGIN TRY
        BEGIN TRAN;
        UPDATE dbo.PasarelaAutorizacion
        SET    Estado = @Estado, FechaActualizacion = SYSUTCDATETIME()
        WHERE  LlaveIdempotencia = @LlaveIdempotencia;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
