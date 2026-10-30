-- Precio vigente de una variante (N-02: el vigente es la versión sin VigenteHasta). Se usa con CROSS APPLY.
CREATE OR ALTER FUNCTION dbo.FU_Catalogo_PrecioVigente (@IDVariante INT)
RETURNS TABLE
AS
RETURN
    SELECT  pv.IDPrecioVariante, pv.Precio
    FROM    dbo.PrecioVariante AS pv
    WHERE   pv.IDVariante = @IDVariante
      AND   pv.VigenteHasta IS NULL;
GO
