-- RF-09, N-02: cada nueva versión de precio, con el precio anterior. Cerrar la versión vigente
-- (UPDATE de VigenteHasta) no se registra aparte: es parte del mismo cambio de precio.
CREATE OR ALTER TRIGGER dbo.TR_Catalogo_PrecioVarianteBitacora
ON dbo.PrecioVariante
AFTER INSERT
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
    -- 02 §3.10: IDEntidad es la PK del registro afectado, la nueva versión. El historial de precios de
    -- una variante se lee de PrecioVariante (SP_Catalogo_HistorialPrecios), no de la bitácora.
    SELECT  'Catalogo', 'PrecioVariante', CONVERT(VARCHAR(50), i.IDPrecioVariante),
            CASE WHEN anterior.IDPrecioVariante IS NULL THEN 'Crear' ELSE 'Modificar' END,
            CASE WHEN anterior.IDPrecioVariante IS NULL THEN NULL ELSE
                (SELECT anterior.IDPrecioVariante, i.IDVariante, CONVERT(VARCHAR(20), anterior.Precio) AS Precio
                 FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
            (SELECT i.IDPrecioVariante, i.IDVariante, CONVERT(VARCHAR(20), i.Precio) AS Precio, i.VigenteDesde
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            @IDUsuario, @RequestId
    FROM    inserted AS i
    OUTER APPLY (
        SELECT TOP (1) p.IDPrecioVariante, p.Precio
        FROM   dbo.PrecioVariante AS p
        WHERE  p.IDVariante = i.IDVariante
          AND  p.IDPrecioVariante < i.IDPrecioVariante
        ORDER BY p.IDPrecioVariante DESC
    ) AS anterior;
END
GO
