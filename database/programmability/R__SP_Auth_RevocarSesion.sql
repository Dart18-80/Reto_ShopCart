-- A-07: cierra la sesión revocando toda la familia del refresh token recibido. Un token desconocido no
-- hace nada: el logout es idempotente.
CREATE OR ALTER PROCEDURE dbo.SP_Auth_RevocarSesion
    @HashToken      BINARY(32),
    @Motivo         VARCHAR(30),
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
        UPDATE f
        SET    FechaRevocacion = SYSUTCDATETIME(), MotivoRevocacion = @Motivo
        FROM   dbo.RefreshToken AS f
        JOIN   dbo.RefreshToken AS t ON t.IDFamilia = f.IDFamilia
        WHERE  t.HashToken = @HashToken
          AND  f.FechaRevocacion IS NULL;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
