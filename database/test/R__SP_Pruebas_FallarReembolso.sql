-- Solo existe en shopcart_test: deja Fallido un reembolso, como el job después de agotar sus intentos, para
-- probar su resolución manual (E9-H04) sin esperar los cinco reintentos. @HaceSegundos fecha esa última
-- actualización en el pasado, para probar el plazo antes de resolverlo a mano.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_FallarReembolso
    @IDReembolso INT,
    @HaceSegundos INT = 0,
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
        UPDATE dbo.Reembolso
        SET    Estado = 'Fallido', Intentos = 5, UltimoError = N'Falla de prueba', FechaProximoIntento = NULL,
               TokenReclamo = NULL, FechaActualizacion = DATEADD(SECOND, -@HaceSegundos, SYSUTCDATETIME())
        WHERE  IDReembolso = @IDReembolso;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
