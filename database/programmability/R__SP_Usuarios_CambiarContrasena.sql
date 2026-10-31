-- N-15: guarda el hash de la contraseña nueva del usuario de la petición y revoca todas sus sesiones
-- (refresh tokens) en la misma transacción; la API abre después una sesión nueva para este dispositivo.
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
        UPDATE dbo.Usuario
        SET    HashContrasena = @HashContrasena, FechaActualizacion = SYSUTCDATETIME()
        WHERE  IDUsuario = @IDUsuarioActor AND Activo = 1;

        IF @@ROWCOUNT = 0
            THROW 50001, N'El usuario no existe.', 1;

        UPDATE dbo.RefreshToken
        SET    FechaRevocacion = SYSUTCDATETIME(), MotivoRevocacion = 'CambioContrasena'
        WHERE  IDUsuario = @IDUsuarioActor AND FechaRevocacion IS NULL;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
