-- Solo existe en shopcart_test: vence los refresh tokens de un usuario (los 7 días no se pueden esperar
-- en una prueba).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_VencerRefreshTokens
    @IDUsuario      INT,
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
        UPDATE dbo.RefreshToken
        SET    FechaExpiracion = DATEADD(SECOND, -1, SYSUTCDATETIME())
        WHERE  IDUsuario = @IDUsuario;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
