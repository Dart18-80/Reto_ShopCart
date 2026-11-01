-- N-15: activa o desactiva un usuario. Un Admin no puede desactivarse a sí mismo y el sistema nunca queda
-- sin Admins activos. Desactivar revoca todos sus refresh tokens e incrementa su versión de sesión en la
-- misma transacción; la API publica después la versión en Redis (A-07). Devuelve el usuario y su versión.
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_CambiarEstado
    @IDUsuario      INT,
    @Activo         BIT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @Activo = 0 AND @IDUsuario = @IDUsuarioActor
        THROW 50105, N'No puedes desactivar tu propia cuenta.', 1;

    BEGIN TRY
        BEGIN TRAN;

        -- Toda operación que puede reducir los Admins activos toma primero el UPDLOCK de la fila del rol
        -- Administrador y después la fila objetivo, igual que SP_Usuarios_Actualizar: se serializan entre
        -- sí (dos Admins que se desactivan a la vez no dejan el sistema sin ninguno) y, con el mismo orden
        -- de bloqueo, no se cruzan en un deadlock. Un UPDLOCK no bloquea lecturas ni validaciones de FK.
        DECLARE @AdminsActivos INT, @IDRolAdmin INT;
        IF @Activo = 0
        BEGIN
            SELECT @IDRolAdmin = r.IDRol
            FROM   dbo.Rol AS r WITH (UPDLOCK, ROWLOCK)
            WHERE  r.Codigo = 'Administrador';

            SELECT @AdminsActivos = COUNT(*)
            FROM   dbo.Usuario AS u
            WHERE  u.IDRol = @IDRolAdmin AND u.Activo = 1;
        END

        DECLARE @RolActual VARCHAR(20), @ActivoActual BIT;
        SELECT @RolActual = r.Codigo, @ActivoActual = u.Activo
        FROM   dbo.Usuario AS u WITH (UPDLOCK, ROWLOCK)
        JOIN   dbo.Rol     AS r ON r.IDRol = u.IDRol
        WHERE  u.IDUsuario = @IDUsuario;

        IF @RolActual IS NULL
            THROW 50001, N'El usuario no existe.', 1;

        IF @Activo = 0 AND @ActivoActual = 1 AND @RolActual = 'Administrador' AND @AdminsActivos <= 1
            THROW 50104, N'El sistema debe conservar al menos un administrador activo.', 1;

        IF @ActivoActual <> @Activo
        BEGIN
            UPDATE dbo.Usuario
            SET    Activo = @Activo,
                   FechaDesactivacion = CASE WHEN @Activo = 0 THEN SYSUTCDATETIME() END,
                   -- A-07: desactivar invalida sus access tokens; reactivar no los revive (la versión no baja).
                   VersionSesion = VersionSesion + CASE WHEN @Activo = 0 THEN 1 ELSE 0 END,
                   FechaActualizacion = SYSUTCDATETIME()
            WHERE  IDUsuario = @IDUsuario;

            IF @Activo = 0
                UPDATE dbo.RefreshToken
                SET    FechaRevocacion = SYSUTCDATETIME(), MotivoRevocacion = 'Desactivacion'
                WHERE  IDUsuario = @IDUsuario AND FechaRevocacion IS NULL;
        END

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
