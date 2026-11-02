-- Solo existe en shopcart_test: deja un reembolso Pendiente disponible ya (su próximo intento en el pasado), para
-- probar los reintentos del job sin esperar los 5 minutos. La hora la decide la base.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_AdelantarReembolso
    @IDReembolso    INT,
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
        UPDATE dbo.Reembolso
        SET    FechaProximoIntento = DATEADD(SECOND, -1, SYSUTCDATETIME())
        WHERE  IDReembolso = @IDReembolso AND Estado = 'Pendiente';
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
