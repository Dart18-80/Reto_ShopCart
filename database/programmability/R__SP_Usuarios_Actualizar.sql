-- N-15: el Admin edita el nombre y el rol de un usuario (NULL = sin cambio). Un Admin no cambia su
-- propio rol y el sistema nunca se queda sin Admins activos. Cambiar el rol incrementa la versión de sesión
-- (A-07). Devuelve el usuario y su versión.
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_Actualizar
    @IDUsuario      INT,
    @Nombre         NVARCHAR(100),
    @Rol            VARCHAR(20),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @IDRolNuevo INT = (SELECT IDRol FROM dbo.Rol WHERE Codigo = @Rol);
    IF @Rol IS NOT NULL AND @IDRolNuevo IS NULL
        THROW 50003, N'El rol no es válido.', 1;

    BEGIN TRY
        BEGIN TRAN;

        -- Admins activos bloqueados ANTES que la fila objetivo, en el mismo orden que
        -- SP_Usuarios_CambiarEstado: así quitar el rol y desactivar a la vez no se cruzan en un deadlock.
        DECLARE @AdminsActivos INT;
        IF @Rol IS NOT NULL
            SELECT @AdminsActivos = COUNT(*)
            FROM   dbo.Usuario AS u WITH (UPDLOCK, HOLDLOCK)
            JOIN   dbo.Rol     AS r ON r.IDRol = u.IDRol
            WHERE  r.Codigo = 'Administrador' AND u.Activo = 1;

        DECLARE @RolActual VARCHAR(20), @ActivoActual BIT;
        SELECT @RolActual = r.Codigo, @ActivoActual = u.Activo
        FROM   dbo.Usuario AS u WITH (UPDLOCK, ROWLOCK)
        JOIN   dbo.Rol     AS r ON r.IDRol = u.IDRol
        WHERE  u.IDUsuario = @IDUsuario;

        IF @RolActual IS NULL
            THROW 50001, N'El usuario no existe.', 1;

        IF @Rol IS NOT NULL AND @Rol <> @RolActual
        BEGIN
            IF @IDUsuario = @IDUsuarioActor
                THROW 50105, N'No puedes cambiar tu propio rol.', 1;

            IF @RolActual = 'Administrador' AND @ActivoActual = 1 AND @AdminsActivos <= 1
                THROW 50104, N'El sistema debe conservar al menos un administrador activo.', 1;
        END

        UPDATE dbo.Usuario
        SET    Nombre = COALESCE(@Nombre, Nombre),
               IDRol = COALESCE(@IDRolNuevo, IDRol),
               -- A-07: con otro rol, sus access tokens dejan de servir de inmediato.
               VersionSesion = VersionSesion + CASE WHEN @IDRolNuevo <> IDRol THEN 1 ELSE 0 END,
               FechaActualizacion = SYSUTCDATETIME()
        WHERE  IDUsuario = @IDUsuario;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT u.IDUsuario, u.Correo, u.Nombre, u.Telefono, r.Codigo AS Rol, u.Activo, u.VersionSesion
    FROM   dbo.Usuario AS u
    JOIN   dbo.Rol     AS r ON r.IDRol = u.IDRol
    WHERE  u.IDUsuario = @IDUsuario;
END
GO
