-- RF-09, N-04: cambios de tarifas y plazos de los métodos de envío.
CREATE OR ALTER TRIGGER dbo.TR_Envios_Bitacora
ON dbo.MetodoEnvio
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    -- A-21: las columnas de dinero se registran como texto ("149.90"), igual que en la API.
    SET NOCOUNT ON;

    -- A-18: toda escritura auditada declara quién la hace (los jobs y el migrador, Rol = 'Sistema').
    IF NOT EXISTS (SELECT 1 FROM inserted) AND NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    IF SESSION_CONTEXT(N'Rol') IS NULL
        THROW 50004, N'Falta el contexto de la operación: llama a SP_Sistema_EstablecerContexto.', 1;

    DECLARE @IDUsuario INT              = TRY_CONVERT(INT, SESSION_CONTEXT(N'IDUsuario')),
            @RequestId UNIQUEIDENTIFIER = TRY_CONVERT(UNIQUEIDENTIFIER, SESSION_CONTEXT(N'RequestId'));

    INSERT INTO dbo.Bitacora (Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, IDUsuario, RequestId)
    SELECT  'Envios', 'MetodoEnvio', CONVERT(VARCHAR(50), COALESCE(i.IDMetodoEnvio, d.IDMetodoEnvio)),
            CASE
                WHEN d.IDMetodoEnvio IS NULL       THEN 'Crear'
                WHEN i.IDMetodoEnvio IS NULL       THEN 'Eliminar'
                WHEN d.Activo = 1 AND i.Activo = 0 THEN 'Desactivar'
                WHEN d.Activo = 0 AND i.Activo = 1 THEN 'Activar'
                ELSE 'Modificar'
            END,
            CASE WHEN d.IDMetodoEnvio IS NULL THEN NULL ELSE
                (SELECT d.Codigo, d.Nombre, CONVERT(VARCHAR(20), d.Costo) AS Costo, d.DiasMin, d.DiasMax, d.Activo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
            CASE WHEN i.IDMetodoEnvio IS NULL THEN NULL ELSE
                (SELECT i.Codigo, i.Nombre, CONVERT(VARCHAR(20), i.Costo) AS Costo, i.DiasMin, i.DiasMax, i.Activo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
            @IDUsuario, @RequestId
    FROM    inserted AS i
    FULL OUTER JOIN deleted AS d ON d.IDMetodoEnvio = i.IDMetodoEnvio
    WHERE   i.IDMetodoEnvio IS NULL OR d.IDMetodoEnvio IS NULL
       OR   EXISTS (SELECT i.Codigo, i.Nombre, i.Costo, i.DiasMin, i.DiasMax, i.Activo
                    EXCEPT SELECT d.Codigo, d.Nombre, d.Costo, d.DiasMin, d.DiasMax, d.Activo);
END
GO
