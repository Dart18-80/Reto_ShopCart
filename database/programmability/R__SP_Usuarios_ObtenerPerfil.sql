-- RF-01: el perfil del usuario de la petición; el ID sale de @IDUsuarioActor (del token), nunca del cliente.
-- Incluye el hash para verificar la contraseña actual al cambiarla; la API nunca lo devuelve.
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_ObtenerPerfil
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT u.IDUsuario, u.Correo, u.Nombre, u.Telefono, r.Codigo AS Rol, u.Activo, u.HashContrasena
    FROM   dbo.Usuario AS u
    JOIN   dbo.Rol     AS r ON r.IDRol = u.IDRol
    WHERE  u.IDUsuario = @IDUsuarioActor;
END
GO
