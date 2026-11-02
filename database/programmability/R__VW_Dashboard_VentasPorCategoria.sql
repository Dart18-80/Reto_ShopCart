-- depende-de: R__VW_Dashboard_HechosVenta.sql
-- N-11: las ventas netas (ventas − devoluciones) por día de Guatemala y categoría, sobre la definición única de
-- venta (VW_Dashboard_HechosVenta). El nombre es el actual de la categoría.
CREATE OR ALTER VIEW dbo.VW_Dashboard_VentasPorCategoria
AS
SELECT  h.Fecha,
        h.IDCategoria,
        c.Nombre                                 AS Categoria,
        SUM(h.Unidades)                          AS Unidades,
        CONVERT(DECIMAL(15,2), SUM(h.Monto))     AS Monto
FROM    dbo.VW_Dashboard_HechosVenta AS h
JOIN    dbo.Categoria AS c ON c.IDCategoria = h.IDCategoria
GROUP BY h.Fecha, h.IDCategoria, c.Nombre;
GO
