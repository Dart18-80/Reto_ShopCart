-- E9-H04 (decisión del PO): si el Admin puede resolver a mano un reembolso ahora. PlazoCumplido: pasaron
-- @SegundosEsperaMinima desde su última actualización (una llamada a la pasarela cortada por timeout puede seguir
-- en vuelo). PuedeResolver: además está Fallido. Una sola regla para SP_Pedidos_ResolverReembolso y
-- SP_Pedidos_MarcarReembolsoNoAplica (50711), SP_Pedidos_ObtenerReembolsoParaResolver (la prevalidación del
-- servicio) y SP_Pedidos_ListarReembolsos (M8-H05).
CREATE OR ALTER FUNCTION dbo.FU_Pedidos_ReembolsoResoluble
    (@Estado VARCHAR(14), @FechaActualizacion DATETIME2(3), @SegundosEsperaMinima INT)
RETURNS TABLE
AS
RETURN
    SELECT c.PlazoCumplido,
           CONVERT(BIT, IIF(@Estado = 'Fallido' AND c.PlazoCumplido = 1, 1, 0)) AS PuedeResolver
    FROM  (SELECT CONVERT(BIT, IIF(@FechaActualizacion <= DATEADD(SECOND, -@SegundosEsperaMinima, SYSUTCDATETIME()),
                                   1, 0)) AS PlazoCumplido) AS c;
GO
