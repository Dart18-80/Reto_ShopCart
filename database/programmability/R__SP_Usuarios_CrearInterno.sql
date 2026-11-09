-- N-15: el Admin crea Operadores y Admins con una contraseña inicial (los Clientes solo se registran).
-- Devuelve el usuario creado.
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_CrearInterno
    @Correo         NVARCHAR(254),
    @HashContrasena VARCHAR(255),
    @Nombre         NVARCHAR(100),
    @Telefono       VARCHAR(8),
    @Rol            VARCHAR(20),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @Rol NOT IN ('Operador', 'Administrador')
        THROW 50003, N'Solo se pueden crear Operadores y Administradores.', 1;

    DECLARE @IDUsuario INT;

    BEGIN TRY
        BEGIN TRAN;

        IF EXISTS (SELECT 1 FROM dbo.Usuario WITH (UPDLOCK, HOLDLOCK) WHERE CorreoNormalizado = LOWER(@Correo))
            THROW 50101, N'El correo ya está registrado.', 1;

        INSERT INTO dbo.Usuario (Correo, HashContrasena, Nombre, Telefono, IDRol)
        SELECT @Correo, @HashContrasena, @Nombre, @Telefono, r.IDRol
        FROM   dbo.Rol AS r
        WHERE  r.Codigo = @Rol;
        SET @IDUsuario = SCOPE_IDENTITY();

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        IF ERROR_NUMBER() IN (2601, 2627)
            THROW 50101, N'El correo ya está registrado.', 1;
        THROW;
    END CATCH

    SELECT u.IDUsuario, u.Correo, u.Nombre, u.Telefono, r.Codigo AS Rol, u.Activo, u.FechaCreacion
    FROM   dbo.Usuario AS u
    JOIN   dbo.Rol     AS r ON r.IDRol = u.IDRol
    WHERE  u.IDUsuario = @IDUsuario;
END
GO
