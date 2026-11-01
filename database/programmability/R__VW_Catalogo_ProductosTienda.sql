-- Productos que se muestran en la tienda: activos, con al menos una variante activa con precio
-- vigente, su precio mínimo (el menor precio vigente entre sus variantes activas), si alguna variante
-- tiene disponible, el nombre de su categoría y su imagen principal.
-- A-23: es lo único que lee el SQL dinámico de SP_Catalogo_BuscarProductos (como shopcart_busqueda), así
-- que trae todas las columnas que la búsqueda devuelve; las tablas las cubre la cadena de propiedad.
CREATE OR ALTER VIEW dbo.VW_Catalogo_ProductosTienda
AS
SELECT  p.IDProducto,
        p.IDCategoria,
        c.Nombre AS Categoria,
        p.Nombre,
        p.NombreBusqueda,
        p.Descripcion,
        p.FechaCreacion,
        i.Url AS ImagenPrincipal,
        MIN(pv.Precio) AS PrecioMinimo,
        CONVERT(BIT, MAX(CASE WHEN d.Disponible > 0 THEN 1 ELSE 0 END)) AS TieneDisponible
FROM    dbo.Producto AS p
JOIN    dbo.Categoria AS c ON c.IDCategoria = p.IDCategoria
JOIN    dbo.Variante AS v ON v.IDProducto = p.IDProducto AND v.Activo = 1
CROSS APPLY dbo.FU_Catalogo_PrecioVigente(v.IDVariante) AS pv
CROSS APPLY dbo.FU_Inventario_Disponible(v.IDVariante)  AS d
LEFT JOIN dbo.ImagenProducto AS i ON i.IDProducto = p.IDProducto AND i.EsPrincipal = 1
WHERE   p.Activo = 1
GROUP BY p.IDProducto, p.IDCategoria, c.Nombre, p.Nombre, p.NombreBusqueda, p.Descripcion, p.FechaCreacion,
         i.Url;
GO

-- A-23: el único permiso de shopcart_busqueda. Idempotente; CREATE OR ALTER conserva el permiso.
GRANT SELECT ON dbo.VW_Catalogo_ProductosTienda TO shopcart_busqueda;
GO
