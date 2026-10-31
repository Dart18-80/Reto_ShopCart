-- A-07: guarda el hash (SHA-256) de un refresh token nuevo; el token en claro nunca llega a la base.
-- @IDFamilia agrupa la cadena de rotaciones de una sesión.
CREATE OR ALTER PROCEDURE dbo.SP_Auth_RegistrarRefreshToken
    @IDUsuario      INT,
    @IDFamilia      UNIQUEIDENTIFIER,
    @HashToken      BINARY(32),
    @DiasVigencia   INT,
    @IP             VARCHAR(45),
    @UserAgent      NVARCHAR(300),
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
        INSERT INTO dbo.RefreshToken (IDUsuario, IDFamilia, HashToken, FechaExpiracion, IP, UserAgent)
        VALUES (@IDUsuario, @IDFamilia, @HashToken, DATEADD(DAY, @DiasVigencia, SYSUTCDATETIME()), @IP, @UserAgent);
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
