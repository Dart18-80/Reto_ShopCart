-- RF-09: creación de usuarios y cambios de rol o activación. Nunca se registra HashContrasena: las
-- columnas se listan explícitamente.
CREATE OR ALTER TRIGGER dbo.TR_Usuarios_Bitacora
ON dbo.Usuario
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    -- A-18: toda escritura auditada declara quién la hace (los jobs y el migrador, Rol = 'Sistema').
    IF NOT EXISTS (SELECT 1 FROM inserted) AND NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    IF SESSION_CONTEXT(N'Rol') IS NULL
        THROW 50004, N'Falta el contexto de la operación: llama a SP_Sistema_EstablecerContexto.', 1;

    DECLARE @IDUsuario INT              = TRY_CONVERT(INT, SESSION_CONTEXT(N'IDUsuario')),
            @RequestId UNIQUEIDENTIFIER = TRY_CONVERT(UNIQUEIDENTIFIER, SESSION_CONTEXT(N'RequestId'));

    INSERT INTO dbo.Bitacora (Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, IDUsuario, RequestId)
    SELECT  'Usuarios', 'Usuario', CONVERT(VARCHAR(50), COALESCE(i.IDUsuario, d.IDUsuario)),
            CASE
                WHEN d.IDUsuario IS NULL           THEN 'Crear'
                WHEN i.IDUsuario IS NULL           THEN 'Eliminar'
                WHEN d.Activo = 1 AND i.Activo = 0 THEN 'Desactivar'
                WHEN d.Activo = 0 AND i.Activo = 1 THEN 'Activar'
                ELSE 'Modificar'
            END,
            CASE WHEN d.IDUsuario IS NULL THEN NULL ELSE
                (SELECT d.Correo, d.Nombre, d.IDRol, d.Activo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
            CASE WHEN i.IDUsuario IS NULL THEN NULL ELSE
                (SELECT i.Correo, i.Nombre, i.IDRol, i.Activo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
            @IDUsuario, @RequestId
    FROM    inserted AS i
    FULL OUTER JOIN deleted AS d ON d.IDUsuario = i.IDUsuario
    -- Solo rol y activación: los cambios de perfil o de contraseña no se registran aquí.
    WHERE   i.IDUsuario IS NULL OR d.IDUsuario IS NULL
       OR   EXISTS (SELECT i.IDRol, i.Activo EXCEPT SELECT d.IDRol, d.Activo);
END
GO
