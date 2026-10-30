-- RF-09: una fila de bitácora por cada creación, cambio o desactivación de una categoría.
CREATE OR ALTER TRIGGER dbo.TR_Catalogo_CategoriaBitacora
ON dbo.Categoria
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IDUsuario INT              = TRY_CONVERT(INT, SESSION_CONTEXT(N'IDUsuario')),
            @RequestId UNIQUEIDENTIFIER = TRY_CONVERT(UNIQUEIDENTIFIER, SESSION_CONTEXT(N'RequestId'));

    INSERT INTO dbo.Bitacora (Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, IDUsuario, RequestId)
    SELECT  'Catalogo', 'Categoria', CONVERT(VARCHAR(50), COALESCE(i.IDCategoria, d.IDCategoria)),
            CASE
                WHEN d.IDCategoria IS NULL         THEN 'Crear'
                WHEN i.IDCategoria IS NULL         THEN 'Eliminar'
                WHEN d.Activo = 1 AND i.Activo = 0 THEN 'Desactivar'
                WHEN d.Activo = 0 AND i.Activo = 1 THEN 'Activar'
                ELSE 'Modificar'
            END,
            CASE WHEN d.IDCategoria IS NULL THEN NULL ELSE
                (SELECT d.Nombre, d.Descripcion, d.Activo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
            CASE WHEN i.IDCategoria IS NULL THEN NULL ELSE
                (SELECT i.Nombre, i.Descripcion, i.Activo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
            @IDUsuario, @RequestId
    FROM    inserted AS i
    FULL OUTER JOIN deleted AS d ON d.IDCategoria = i.IDCategoria
    -- Un UPDATE que no cambió datos de negocio (solo FechaActualizacion) no se registra.
    WHERE   i.IDCategoria IS NULL OR d.IDCategoria IS NULL
       OR   EXISTS (SELECT i.Nombre, i.Descripcion, i.Activo EXCEPT SELECT d.Nombre, d.Descripcion, d.Activo);
END
GO
