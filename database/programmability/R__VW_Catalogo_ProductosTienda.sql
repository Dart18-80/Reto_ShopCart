-- Productos que se muestran en la tienda: activos, con al menos una variante activa con precio
-- vigente, su precio mínimo (el menor precio vigente entre sus variantes activas), si alguna variante
-- tiene disponible, el nombre y la ilustración de su categoría, su imagen principal y sus colores.
-- Colores (M2-H01, FE-16): los valores distintos del atributo Color de las variantes activas, en el orden de
-- ValorAtributo.Orden, hasta 5, como arreglo JSON de texto (STRING_ESCAPE: un valor con comas o comillas no
-- rompe la lista); sin atributo Color, '[]'. Sin cifras de existencia (N-06).
-- A-23: es lo único que lee el SQL dinámico de SP_Catalogo_BuscarProductos (como shopcart_busqueda), así
-- que trae todas las columnas que la búsqueda devuelve; las tablas las cubre la cadena de propiedad.
CREATE OR ALTER VIEW dbo.VW_Catalogo_ProductosTienda
AS
WITH Tienda AS (
    SELECT  p.IDProducto,
            p.IDCategoria,
            c.Nombre AS Categoria,
            c.Ilustracion,
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
    GROUP BY p.IDProducto, p.IDCategoria, c.Nombre, c.Ilustracion, p.Nombre, p.NombreBusqueda, p.Descripcion,
             p.FechaCreacion, i.Url
)
SELECT  t.IDProducto,
        t.IDCategoria,
        t.Categoria,
        t.Ilustracion,
        t.Nombre,
        t.NombreBusqueda,
        t.Descripcion,
        t.FechaCreacion,
        t.ImagenPrincipal,
        t.PrecioMinimo,
        t.TieneDisponible,
        COALESCE(col.Colores, N'[]') AS Colores
FROM    Tienda AS t
OUTER APPLY (
    SELECT N'[' + STRING_AGG(N'"' + STRING_ESCAPE(primeros.Valor, 'json') + N'"', N',')
                      WITHIN GROUP (ORDER BY primeros.Orden, primeros.IDValorAtributo) + N']' AS Colores
    FROM   (SELECT TOP (5) va.IDValorAtributo, va.Valor, va.Orden
            FROM   dbo.ValorAtributo AS va
            JOIN   dbo.Atributo      AS a ON a.IDAtributo = va.IDAtributo
            WHERE  a.Nombre = N'Color'
              AND  EXISTS (SELECT 1
                           FROM   dbo.VarianteValorAtributo AS vva
                           JOIN   dbo.Variante AS v ON v.IDVariante = vva.IDVariante
                           WHERE  vva.IDValorAtributo = va.IDValorAtributo
                             AND  v.IDProducto = t.IDProducto
                             AND  v.Activo = 1)
            ORDER BY va.Orden, va.IDValorAtributo) AS primeros
) AS col;
GO

-- A-23: el único permiso de shopcart_busqueda. Idempotente; CREATE OR ALTER conserva el permiso.
GRANT SELECT ON dbo.VW_Catalogo_ProductosTienda TO shopcart_busqueda;
GO
