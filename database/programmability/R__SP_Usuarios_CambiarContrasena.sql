-- N-15: guarda el hash de la contraseña nueva del usuario de la petición, revoca todas sus sesiones
-- (refresh tokens) e incrementa su versión de sesión en la misma transacción (A-07). Devuelve la versión
-- nueva: la API abre con ella la sesión de este dispositivo, y los access tokens anteriores dejan de servir.
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_CambiarContrasena
    @HashContrasena VARCHAR(255),
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

        DECLARE @Activo BIT;
        SELECT @Activo = u.Activo
        FROM   dbo.Usuario AS u WITH (UPDLOCK, ROWLOCK)
        WHERE  u.IDUsuario = @IDUsuarioActor;

        IF @Activo IS NULL
            THROW 50001, N'El usuario no existe.', 1;
        -- Su access token puede seguir vigente unos minutos si Redis no respondió al desactivarlo (N-15).
        IF @Activo = 0
            THROW 50103, N'El usuario está inactivo.', 1;

        UPDATE dbo.Usuario
        SET    HashContrasena = @HashContrasena,
               VersionSesion = VersionSesion + 1,
               FechaActualizacion = SYSUTCDATETIME()
        WHERE  IDUsuario = @IDUsuarioActor;

        UPDATE dbo.RefreshToken
        SET    FechaRevocacion = SYSUTCDATETIME(), MotivoRevocacion = 'CambioContrasena'
        WHERE  IDUsuario = @IDUsuarioActor AND FechaRevocacion IS NULL;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT u.VersionSesion
    FROM   dbo.Usuario AS u
    WHERE  u.IDUsuario = @IDUsuarioActor;
END
GO
