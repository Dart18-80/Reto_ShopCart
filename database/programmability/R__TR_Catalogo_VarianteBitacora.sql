-- RF-09: creación, cambios y desactivación de variantes (módulo Catalogo) y cambios de existencia
-- física (módulo Inventario, cuando es lo único que cambió).
CREATE OR ALTER TRIGGER dbo.TR_Catalogo_VarianteBitacora
ON dbo.Variante
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
    SELECT  CASE
                WHEN d.IDVariante IS NOT NULL AND i.IDVariante IS NOT NULL
                 AND NOT EXISTS (SELECT i.SKU, i.FirmaAtributos, i.DescripcionAtributos, i.Activo
                                 EXCEPT SELECT d.SKU, d.FirmaAtributos, d.DescripcionAtributos, d.Activo)
                THEN 'Inventario'
                ELSE 'Catalogo'
            END,
            'Variante', CONVERT(VARCHAR(50), COALESCE(i.IDVariante, d.IDVariante)),
            CASE
                WHEN d.IDVariante IS NULL          THEN 'Crear'
                WHEN i.IDVariante IS NULL          THEN 'Eliminar'
                WHEN d.Activo = 1 AND i.Activo = 0 THEN 'Desactivar'
                WHEN d.Activo = 0 AND i.Activo = 1 THEN 'Activar'
                ELSE 'Modificar'
            END,
            CASE WHEN d.IDVariante IS NULL THEN NULL ELSE
                (SELECT d.SKU, d.DescripcionAtributos, d.ExistenciaFisica, d.Activo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
            CASE WHEN i.IDVariante IS NULL THEN NULL ELSE
                (SELECT i.SKU, i.DescripcionAtributos, i.ExistenciaFisica, i.Activo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
            @IDUsuario, @RequestId
    FROM    inserted AS i
    FULL OUTER JOIN deleted AS d ON d.IDVariante = i.IDVariante
    WHERE   i.IDVariante IS NULL OR d.IDVariante IS NULL
       OR   EXISTS (SELECT i.SKU, i.FirmaAtributos, i.DescripcionAtributos, i.ExistenciaFisica, i.Activo
                    EXCEPT SELECT d.SKU, d.FirmaAtributos, d.DescripcionAtributos, d.ExistenciaFisica, d.Activo);
END
GO
