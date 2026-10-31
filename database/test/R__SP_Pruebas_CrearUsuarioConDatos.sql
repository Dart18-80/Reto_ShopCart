-- Solo existe en shopcart_test: crea un cliente con el correo, el teléfono y el nombre indicados, para
-- probar los CHECK y el UNIQUE de Usuario, y devuelve lo que quedó guardado.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_CrearUsuarioConDatos
    @Correo         NVARCHAR(254),
    @Telefono       VARCHAR(8),
    @Nombre         NVARCHAR(100),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- A-18: los triggers de bitácora exigen el contexto (en una prueba sin petición, Rol = 'Sistema').
    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    BEGIN TRY
        BEGIN TRAN;
        INSERT INTO dbo.Usuario (Correo, HashContrasena, Nombre, Telefono, IDRol)
        SELECT @Correo, 'hash-de-prueba', @Nombre, @Telefono, IDRol
        FROM   dbo.Rol
        WHERE  Codigo = 'Cliente';

        SELECT IDUsuario, Correo, CorreoNormalizado, Telefono, Nombre
        FROM   dbo.Usuario
        WHERE  IDUsuario = SCOPE_IDENTITY();
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
