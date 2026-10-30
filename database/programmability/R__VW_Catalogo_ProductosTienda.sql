-- Productos que se muestran en la tienda: activos, con al menos una variante activa con precio
-- vigente, su precio mínimo y si alguna variante tiene disponible.
CREATE OR ALTER VIEW dbo.VW_Catalogo_ProductosTienda
AS
SELECT  p.IDProducto,
        p.IDCategoria,
        p.Nombre,
        p.NombreBusqueda,
        p.Descripcion,
        MIN(pv.Precio) AS PrecioMinimo,
        CONVERT(BIT, MAX(CASE WHEN d.Disponible > 0 THEN 1 ELSE 0 END)) AS TieneDisponible
FROM    dbo.Producto AS p
JOIN    dbo.Variante AS v ON v.IDProducto = p.IDProducto AND v.Activo = 1
CROSS APPLY dbo.FU_Catalogo_PrecioVigente(v.IDVariante) AS pv
CROSS APPLY dbo.FU_Inventario_Disponible(v.IDVariante)  AS d
WHERE   p.Activo = 1
GROUP BY p.IDProducto, p.IDCategoria, p.Nombre, p.NombreBusqueda, p.Descripcion;
GO
