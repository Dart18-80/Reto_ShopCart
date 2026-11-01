-- N-15: activa o desactiva un usuario. Un Admin no puede desactivarse a sí mismo y el sistema nunca queda
-- sin Admins activos. Desactivar revoca todos sus refresh tokens en la misma transacción; la API agrega
-- después al usuario a la lista de revocados de Redis. Devuelve el usuario.
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

        -- UPDLOCK + HOLDLOCK sobre los Admins activos ANTES que la fila objetivo, igual que
        -- SP_Usuarios_Actualizar: dos Admins que se desactivan a la vez no pueden dejar el sistema sin
        -- ninguno, y como todos piden los bloqueos en el mismo orden no se cruzan en un deadlock.
        DECLARE @AdminsActivos INT;
        IF @Activo = 0
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

        IF @Activo = 0 AND @ActivoActual = 1 AND @RolActual = 'Administrador' AND @AdminsActivos <= 1
            THROW 50104, N'El sistema debe conservar al menos un administrador activo.', 1;

        IF @ActivoActual <> @Activo
        BEGIN
            UPDATE dbo.Usuario
            SET    Activo = @Activo,
                   FechaDesactivacion = CASE WHEN @Activo = 0 THEN SYSUTCDATETIME() END,
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

    SELECT u.IDUsuario, u.Correo, u.Nombre, u.Telefono, r.Codigo AS Rol, u.Activo
    FROM   dbo.Usuario AS u
    JOIN   dbo.Rol     AS r ON r.IDRol = u.IDRol
    WHERE  u.IDUsuario = @IDUsuario;
END
GO
