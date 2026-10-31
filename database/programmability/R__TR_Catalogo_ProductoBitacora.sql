-- RF-09: una fila de bitácora por cada creación, cambio o desactivación de un producto.
CREATE OR ALTER TRIGGER dbo.TR_Catalogo_ProductoBitacora
ON dbo.Producto
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
    SELECT  'Catalogo', 'Producto', CONVERT(VARCHAR(50), COALESCE(i.IDProducto, d.IDProducto)),
            CASE
                WHEN d.IDProducto IS NULL          THEN 'Crear'
                WHEN i.IDProducto IS NULL          THEN 'Eliminar'
                WHEN d.Activo = 1 AND i.Activo = 0 THEN 'Desactivar'
                WHEN d.Activo = 0 AND i.Activo = 1 THEN 'Activar'
                ELSE 'Modificar'
            END,
            CASE WHEN d.IDProducto IS NULL THEN NULL ELSE
                (SELECT d.IDCategoria, d.Nombre, d.Descripcion, d.Activo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
            CASE WHEN i.IDProducto IS NULL THEN NULL ELSE
                (SELECT i.IDCategoria, i.Nombre, i.Descripcion, i.Activo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
            @IDUsuario, @RequestId
    FROM    inserted AS i
    FULL OUTER JOIN deleted AS d ON d.IDProducto = i.IDProducto
    WHERE   i.IDProducto IS NULL OR d.IDProducto IS NULL
       OR   EXISTS (SELECT i.IDCategoria, i.Nombre, i.Descripcion, i.Activo
                    EXCEPT SELECT d.IDCategoria, d.Nombre, d.Descripcion, d.Activo);
END
GO
