-- N-15: el usuario edita su nombre y su teléfono (RF-01: solo el suyo, por @IDUsuarioActor).
-- Recibe los valores finales; @Telefono NULL deja el perfil sin teléfono. Devuelve el perfil.
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_ActualizarPerfil
    @Nombre         NVARCHAR(100),
    @Telefono       VARCHAR(8),
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
        SET    Nombre = @Nombre, Telefono = @Telefono, FechaActualizacion = SYSUTCDATETIME()
        WHERE  IDUsuario = @IDUsuarioActor;

        IF @@ROWCOUNT = 0
            THROW 50001, N'El usuario no existe.', 1;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT u.IDUsuario, u.Correo, u.Nombre, u.Telefono, r.Codigo AS Rol, u.Activo
    FROM   dbo.Usuario AS u
    JOIN   dbo.Rol     AS r ON r.IDRol = u.IDRol
    WHERE  u.IDUsuario = @IDUsuarioActor;
END
GO
