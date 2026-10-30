-- RF-09, N-02: cada nueva versión de precio, con el precio anterior. Cerrar la versión vigente
-- (UPDATE de VigenteHasta) no se registra aparte: es parte del mismo cambio de precio.
CREATE OR ALTER TRIGGER dbo.TR_Catalogo_PrecioVarianteBitacora
ON dbo.PrecioVariante
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IDUsuario INT              = TRY_CONVERT(INT, SESSION_CONTEXT(N'IDUsuario')),
            @RequestId UNIQUEIDENTIFIER = TRY_CONVERT(UNIQUEIDENTIFIER, SESSION_CONTEXT(N'RequestId'));

    INSERT INTO dbo.Bitacora (Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, IDUsuario, RequestId)
    SELECT  'Catalogo', 'PrecioVariante', CONVERT(VARCHAR(50), i.IDVariante),
            CASE WHEN anterior.IDPrecioVariante IS NULL THEN 'Crear' ELSE 'Modificar' END,
            CASE WHEN anterior.IDPrecioVariante IS NULL THEN NULL ELSE
                (SELECT anterior.IDPrecioVariante, anterior.Precio FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
            (SELECT i.IDPrecioVariante, i.Precio, i.VigenteDesde FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
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
