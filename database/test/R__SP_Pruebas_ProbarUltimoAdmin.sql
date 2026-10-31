-- Solo existe en shopcart_test: deja a @IDAdmin como único Admin activo y le aplica una acción
-- ('Desactivar' o 'QuitarRol') con SP_Usuarios_CambiarEstado o SP_Usuarios_Actualizar, dentro de una
-- transacción que siempre se revierte: prueba ULTIMO_ADMIN sin dejar la base sin Admins para las demás pruebas.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_ProbarUltimoAdmin
    @IDAdmin        INT,
    @Accion         VARCHAR(20),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto NULL, 'Sistema', @RequestId;

    BEGIN TRY
        BEGIN TRAN;
        UPDATE u
        SET    Activo = 0, FechaDesactivacion = SYSUTCDATETIME()
        FROM   dbo.Usuario AS u
        JOIN   dbo.Rol     AS r ON r.IDRol = u.IDRol
        WHERE  r.Codigo = 'Administrador' AND u.Activo = 1 AND u.IDUsuario <> @IDAdmin;

        IF @Accion = 'Desactivar'
            EXEC dbo.SP_Usuarios_CambiarEstado @IDUsuario = @IDAdmin, @Activo = 0,
                 @IDUsuarioActor = @IDUsuarioActor, @RolActor = 'Administrador', @RequestId = @RequestId;
        ELSE
            EXEC dbo.SP_Usuarios_Actualizar @IDUsuario = @IDAdmin, @Nombre = NULL, @Rol = 'Operador',
                 @IDUsuarioActor = @IDUsuarioActor, @RolActor = 'Administrador', @RequestId = @RequestId;
        ROLLBACK;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
