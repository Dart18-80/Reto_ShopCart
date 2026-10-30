-- N-07: variantes cuya existencia física no cuadra con el kardex. Debe estar vacía: la existencia
-- solo cambia por SP_Inventario_RegistrarMovimiento, que escribe el movimiento en la misma transacción.
CREATE OR ALTER VIEW dbo.VW_Inventario_Conciliacion
AS
SELECT  v.IDVariante,
        v.SKU,
        v.ExistenciaFisica,
        k.SumaKardex,
        u.ExistenciaResultante AS ExistenciaUltimoMovimiento
FROM    dbo.Variante AS v
CROSS APPLY (
    SELECT COALESCE(SUM(m.Signo * m.Cantidad), 0) AS SumaKardex
    FROM   dbo.MovimientoKardex AS m
    WHERE  m.IDVariante = v.IDVariante
) AS k
OUTER APPLY (
    SELECT TOP (1) m.ExistenciaResultante
    FROM   dbo.MovimientoKardex AS m
    WHERE  m.IDVariante = v.IDVariante
    ORDER BY m.IDMovimientoKardex DESC
) AS u
WHERE   v.ExistenciaFisica <> k.SumaKardex
   OR   v.ExistenciaFisica <> COALESCE(u.ExistenciaResultante, 0);
GO
