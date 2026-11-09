-- N-15: el usuario edita su nombre y su teléfono (RF-01: solo el suyo, por @IDUsuarioActor). PATCH: NULL
-- significa "sin cambio" y @QuitarTelefono = 1 deja el perfil sin teléfono. La mezcla con lo guardado se
-- hace en el mismo UPDATE, con la fila bloqueada: dos PATCH simultáneos conservan ambos cambios.
-- Devuelve el perfil.
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_ActualizarPerfil
    @Nombre         NVARCHAR(100),
    @Telefono       VARCHAR(8),
    @QuitarTelefono BIT              = 0,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @QuitarTelefono = 1 AND @Telefono IS NOT NULL
        THROW 50003, N'No se puede enviar un teléfono y quitarlo a la vez.', 1;

    BEGIN TRY
        BEGIN TRAN;
        UPDATE dbo.Usuario
        SET    Nombre             = COALESCE(@Nombre, Nombre),
               Telefono           = CASE WHEN @QuitarTelefono = 1 THEN NULL ELSE COALESCE(@Telefono, Telefono) END,
               FechaActualizacion = SYSUTCDATETIME()
        WHERE  IDUsuario = @IDUsuarioActor;

        IF @@ROWCOUNT = 0
            THROW 50001, N'El usuario no existe.', 1;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT u.IDUsuario, u.Correo, u.Nombre, u.Telefono, r.Codigo AS Rol, u.Activo, u.FechaCreacion
    FROM   dbo.Usuario AS u
    JOIN   dbo.Rol     AS r ON r.IDRol = u.IDRol
    WHERE  u.IDUsuario = @IDUsuarioActor;
END
GO
