-- N-15: datos para verificar un inicio de sesión. Sin filas si el correo no existe: la API responde el
-- mismo mensaje genérico que con una contraseña incorrecta.
CREATE OR ALTER PROCEDURE dbo.SP_Auth_ObtenerCredenciales
    @Correo         NVARCHAR(254),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT u.IDUsuario, u.Correo, u.Nombre, u.HashContrasena, u.Activo, r.Codigo AS Rol
    FROM   dbo.Usuario AS u
    JOIN   dbo.Rol     AS r ON r.IDRol = u.IDRol
    WHERE  u.CorreoNormalizado = LOWER(@Correo);
END
GO
