-- depende-de: R__FU_Catalogo_PrecioVigente.sql, R__FU_Inventario_Disponible.sql
-- RF-04, N-02, N-06: las líneas de un carrito con su precio y su estado, calculados al consultar.
-- Precio efectivo (01 §6.5): mientras la garantía está vigente, el menor entre el garantizado y el vigente;
-- vencida, el vigente. Estado: NoDisponible (producto o variante desactivados; solo se elimina), Agotado,
-- CantidadExcedida (con "Ajustar a X") o Disponible. La cantidad nunca se corrige sola.
-- N-06: la existencia solo se muestra como etiqueta; la cifra, en el umbral o por debajo.
CREATE OR ALTER FUNCTION dbo.FU_Carrito_Lineas (@IDCarrito INT)
RETURNS TABLE
AS
RETURN
    SELECT  l.IDLineaCarrito,
            l.IDVariante,
            p.IDProducto,
            p.Nombre               AS Producto,
            v.SKU,
            v.DescripcionAtributos,
            img.Url                AS Imagen,
            l.Cantidad,
            pr.PrecioEfectivo      AS PrecioUnitario,
            CONVERT(DECIMAL(15,2), pr.PrecioEfectivo * l.Cantidad) AS TotalLinea,
            est.Estado,
            CASE WHEN est.Estado = 'CantidadExcedida' THEN d.Disponible END AS AjustarA,
            CASE WHEN d.Disponible <= 0                THEN 'Agotado'
                 WHEN d.Disponible <= u.Umbral         THEN 'UltimasUnidades'
                 ELSE 'Disponible' END AS EstadoExistencia,
            CASE WHEN d.Disponible > 0 AND d.Disponible <= u.Umbral THEN d.Disponible END AS UnidadesRestantes,
            l.FechaAgregado
    FROM    dbo.LineaCarrito AS l
    JOIN    dbo.Variante       AS v  ON v.IDVariante = l.IDVariante
    JOIN    dbo.Producto       AS p  ON p.IDProducto = v.IDProducto
    JOIN    dbo.PrecioVariante AS pg ON pg.IDPrecioVariante = l.IDPrecioVarianteGarantizado
    OUTER APPLY dbo.FU_Catalogo_PrecioVigente(l.IDVariante) AS pv
    CROSS APPLY dbo.FU_Inventario_Disponible(l.IDVariante)  AS d
    CROSS APPLY (SELECT TOP (1) ps.UmbralUltimasUnidades AS Umbral
                 FROM dbo.ParametroSistema AS ps ORDER BY ps.IDParametroSistema) AS u
    OUTER APPLY (SELECT TOP (1) i.Url
                 FROM dbo.ImagenProducto AS i
                 WHERE i.IDProducto = p.IDProducto AND i.EsPrincipal = 1) AS img
    CROSS APPLY (SELECT CASE WHEN l.FechaGarantiaHasta > SYSUTCDATETIME() AND pg.Precio < pv.Precio
                             THEN pg.Precio
                             ELSE COALESCE(pv.Precio, pg.Precio) END AS PrecioEfectivo) AS pr
    CROSS APPLY (SELECT CASE WHEN p.Activo = 0 OR v.Activo = 0 OR pv.Precio IS NULL THEN 'NoDisponible'
                             WHEN d.Disponible <= 0                                THEN 'Agotado'
                             WHEN l.Cantidad > d.Disponible                        THEN 'CantidadExcedida'
                             ELSE 'Disponible' END AS Estado) AS est
    WHERE   l.IDCarrito = @IDCarrito;
GO
