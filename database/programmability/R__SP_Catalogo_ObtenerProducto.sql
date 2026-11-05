-- RF-02, N-06: un producto de la tienda (público). Solo si se muestra en la tienda
-- (VW_Catalogo_ProductosTienda: activo, con al menos una variante activa con precio vigente); si no,
-- ningún conjunto de resultados y la API responde 404. Cuatro conjuntos: producto, imágenes, variantes
-- activas con precio vigente y valores de atributo. El producto trae además la ilustración de su categoría
-- (FE-15) y el plazo de la garantía de precio del carrito (N-02, M2-H01), que el Admin configura.
-- N-06: nunca devuelve la existencia física ni la reservada. Cada variante trae su estado (Disponible,
-- UltimasUnidades o Agotado) y las unidades restantes solo en el umbral o por debajo.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ObtenerProducto
    @IDProducto     INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.VW_Catalogo_ProductosTienda WHERE IDProducto = @IDProducto)
        RETURN;

    DECLARE @Umbral SMALLINT, @DiasGarantia TINYINT;
    SELECT TOP (1) @Umbral = ps.UmbralUltimasUnidades, @DiasGarantia = ps.DiasGarantiaPrecio
    FROM   dbo.ParametroSistema AS ps
    ORDER BY ps.IDParametroSistema;

    SELECT p.IDProducto, p.IDCategoria, c.Nombre AS Categoria, c.Ilustracion, p.Nombre, p.Descripcion,
           @DiasGarantia AS DiasGarantiaPrecio
    FROM   dbo.Producto  AS p
    JOIN   dbo.Categoria AS c ON c.IDCategoria = p.IDCategoria
    WHERE  p.IDProducto = @IDProducto;

    SELECT i.IDImagenProducto, i.Url, i.TextoAlternativo, i.Orden, i.EsPrincipal
    FROM   dbo.ImagenProducto AS i
    WHERE  i.IDProducto = @IDProducto
    ORDER BY i.Orden;

    SELECT v.IDVariante, v.SKU, v.DescripcionAtributos, pv.Precio,
           CASE WHEN d.Disponible <= 0      THEN 'Agotado'
                WHEN d.Disponible <= @Umbral THEN 'UltimasUnidades'
                ELSE 'Disponible' END AS EstadoExistencia,
           CASE WHEN d.Disponible > 0 AND d.Disponible <= @Umbral THEN d.Disponible END AS UnidadesRestantes
    FROM   dbo.Variante AS v
    CROSS APPLY dbo.FU_Catalogo_PrecioVigente(v.IDVariante) AS pv
    CROSS APPLY dbo.FU_Inventario_Disponible(v.IDVariante)  AS d
    WHERE  v.IDProducto = @IDProducto AND v.Activo = 1
    ORDER BY v.IDVariante;

    SELECT vva.IDVariante, a.IDAtributo, a.Nombre AS Atributo, va.IDValorAtributo, va.Valor
    FROM   dbo.VarianteValorAtributo AS vva
    JOIN   dbo.Variante      AS v  ON v.IDVariante = vva.IDVariante
    JOIN   dbo.ValorAtributo AS va ON va.IDValorAtributo = vva.IDValorAtributo
    JOIN   dbo.Atributo      AS a  ON a.IDAtributo = vva.IDAtributo
    WHERE  v.IDProducto = @IDProducto AND v.Activo = 1
    ORDER BY vva.IDVariante, a.Orden, a.IDAtributo;
END
GO
