-- depende-de: R__FU_Carrito_Lineas.sql
-- RF-05, N-12, N-02: el descuento de un cupón repartido por línea del carrito. Solo las líneas de la
-- categoría del cupón (o todas si no tiene). Descuento total: porcentaje redondeado al centavo y con su
-- tope; monto fijo; en ambos casos nunca más que el subtotal de esas líneas (el total no baja de cero).
-- Reparto proporcional al total de cada línea, al centavo hacia abajo; el sobrante va a la línea de mayor
-- monto (desempate: menor IDLineaCarrito, determinista) y, si no le cabe sin pasar de su total, sigue con la
-- siguiente. La suma de los descuentos por línea es exactamente el descuento total.
-- Una fila por línea con descuento; las demás líneas no aparecen (descuento 0).
CREATE OR ALTER FUNCTION dbo.FU_Cupones_CalculoDescuento (@IDCupon INT, @IDCarrito INT)
RETURNS TABLE
AS
RETURN
    WITH Elegibles AS (
        SELECT l.IDLineaCarrito, l.TotalLinea, c.Tipo, c.Valor, c.MontoMaximoDescuento
        FROM   dbo.FU_Carrito_Lineas(@IDCarrito) AS l
        JOIN   dbo.Producto AS p ON p.IDProducto = l.IDProducto
        JOIN   dbo.Cupon    AS c ON c.IDCupon = @IDCupon
        WHERE  c.IDCategoria IS NULL OR p.IDCategoria = c.IDCategoria
    ),
    Base AS (
        SELECT e.IDLineaCarrito, e.TotalLinea, e.Tipo, e.Valor, e.MontoMaximoDescuento,
               CONVERT(DECIMAL(15,2), SUM(e.TotalLinea) OVER ()) AS Subtotal
        FROM   Elegibles AS e
    ),
    Total AS (
        SELECT b.IDLineaCarrito, b.TotalLinea, b.Subtotal,
               CONVERT(DECIMAL(15,2),
                   (SELECT MIN(x.Monto)
                    FROM (VALUES (CASE WHEN b.Tipo = 'Porcentaje' THEN ROUND(b.Subtotal * b.Valor / 100, 2)
                                       ELSE b.Valor END),
                                 (COALESCE(b.MontoMaximoDescuento, b.Subtotal)),
                                 (b.Subtotal)) AS x (Monto))) AS Descuento
        FROM   Base AS b
        WHERE  b.Subtotal > 0
    ),
    Partes AS (
        SELECT t.IDLineaCarrito, t.TotalLinea, t.Descuento,
               CONVERT(DECIMAL(15,2), FLOOR(t.Descuento * t.TotalLinea * 100 / t.Subtotal) / 100) AS Parte
        FROM   Total AS t
    ),
    Sobrante AS (
        SELECT p.IDLineaCarrito, p.TotalLinea, p.Parte,
               p.Descuento - SUM(p.Parte) OVER () AS Sobrante,
               -- Lo que ya absorbieron las líneas anteriores en el orden del reparto del sobrante.
               COALESCE(SUM(p.TotalLinea - p.Parte) OVER (ORDER BY p.TotalLinea DESC, p.IDLineaCarrito
                                                          ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0)
                   AS CapacidadAnterior
        FROM   Partes AS p
    )
    SELECT s.IDLineaCarrito,
           CONVERT(DECIMAL(15,2),
               s.Parte + CASE WHEN s.Sobrante <= s.CapacidadAnterior THEN 0
                              WHEN s.Sobrante - s.CapacidadAnterior >= s.TotalLinea - s.Parte
                                   THEN s.TotalLinea - s.Parte
                              ELSE s.Sobrante - s.CapacidadAnterior END) AS DescuentoLinea
    FROM   Sobrante AS s;
GO
