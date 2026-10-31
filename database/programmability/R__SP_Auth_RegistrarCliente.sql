-- N-15: el registro público solo crea Clientes, con correo único sin distinguir mayúsculas.
-- Devuelve el usuario creado.
CREATE OR ALTER PROCEDURE dbo.SP_Auth_RegistrarCliente
    @Correo         NVARCHAR(254),
    @HashContrasena VARCHAR(255),
    @Nombre         NVARCHAR(100),
    @Telefono       VARCHAR(8),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- A-18: en el registro público no hay actor; la cuenta la crea la plataforma (Rol = 'Sistema').
    EXEC dbo.SP_Sistema_EstablecerContexto NULL, 'Sistema', @RequestId;

    DECLARE @IDUsuario INT;

    BEGIN TRY
        BEGIN TRAN;

        IF EXISTS (SELECT 1 FROM dbo.Usuario WITH (UPDLOCK, HOLDLOCK) WHERE CorreoNormalizado = LOWER(@Correo))
            THROW 50101, N'El correo ya está registrado.', 1;

        INSERT INTO dbo.Usuario (Correo, HashContrasena, Nombre, Telefono, IDRol)
        SELECT @Correo, @HashContrasena, @Nombre, @Telefono, r.IDRol
        FROM   dbo.Rol AS r
        WHERE  r.Codigo = 'Cliente';
        SET @IDUsuario = SCOPE_IDENTITY();

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        -- El UNIQUE de CorreoNormalizado es la autoridad si dos registros llegan a la vez.
        IF ERROR_NUMBER() IN (2601, 2627)
            THROW 50101, N'El correo ya está registrado.', 1;
        THROW;
    END CATCH

    SELECT u.IDUsuario, u.Correo, u.Nombre, u.Telefono, r.Codigo AS Rol
    FROM   dbo.Usuario AS u
    JOIN   dbo.Rol     AS r ON r.IDRol = u.IDRol
    WHERE  u.IDUsuario = @IDUsuario;
END
GO
