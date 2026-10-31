-- Solo existe en shopcart_test (los "insertar si no existe" usan UPDLOCK, HOLDLOCK porque varias pruebas
-- corren a la vez sobre una base recién creada): crea un cliente con correo único y devuelve su ID.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_CrearUsuario
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
        IF NOT EXISTS (SELECT 1 FROM dbo.Rol WITH (UPDLOCK, HOLDLOCK) WHERE Codigo = 'Cliente')
            INSERT INTO dbo.Rol (Codigo, Nombre) VALUES ('Cliente', N'Cliente');

        INSERT INTO dbo.Usuario (Correo, HashContrasena, Nombre, IDRol)
        SELECT N'prueba-' + CONVERT(NVARCHAR(36), NEWID()) + N'@shopcart.test', 'hash-de-prueba',
               N'Usuario de prueba', IDRol
        FROM dbo.Rol WHERE Codigo = 'Cliente';
        COMMIT;

        SELECT CONVERT(INT, SCOPE_IDENTITY()) AS IDUsuario;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
