-- E3-H03: un producto para el Admin, activo o no, con sus imágenes y todas sus variantes con precio vigente
-- y existencia exacta (física, reservada y disponible). Cuatro conjuntos de resultados: producto, imágenes,
-- variantes y valores de atributo. Sin filas en el primero si el producto no existe.
-- Lo invocan también los SPs de catálogo que escriben, para devolver el producto actualizado.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ObtenerProductoAdmin
    @IDProducto     INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT p.IDProducto, p.IDCategoria, c.Nombre AS Categoria, p.Nombre, p.Descripcion, p.Activo
    FROM   dbo.Producto  AS p
    JOIN   dbo.Categoria AS c ON c.IDCategoria = p.IDCategoria
    WHERE  p.IDProducto = @IDProducto;

    SELECT i.IDImagenProducto, i.Url, i.TextoAlternativo, i.Orden, i.EsPrincipal
    FROM   dbo.ImagenProducto AS i
    WHERE  i.IDProducto = @IDProducto
    ORDER BY i.Orden;

    SELECT v.IDVariante, v.SKU, v.DescripcionAtributos, v.Activo, pv.Precio,
           d.ExistenciaFisica, d.Reservado, d.Disponible
    FROM   dbo.Variante AS v
    OUTER APPLY dbo.FU_Catalogo_PrecioVigente(v.IDVariante) AS pv
    CROSS APPLY dbo.FU_Inventario_Disponible(v.IDVariante)  AS d
    WHERE  v.IDProducto = @IDProducto
    ORDER BY v.IDVariante;

    SELECT vva.IDVariante, a.IDAtributo, a.Nombre AS Atributo, va.IDValorAtributo, va.Valor
    FROM   dbo.VarianteValorAtributo AS vva
    JOIN   dbo.Variante      AS v  ON v.IDVariante = vva.IDVariante
    JOIN   dbo.ValorAtributo AS va ON va.IDValorAtributo = vva.IDValorAtributo
    JOIN   dbo.Atributo      AS a  ON a.IDAtributo = vva.IDAtributo
    WHERE  v.IDProducto = @IDProducto
    ORDER BY vva.IDVariante, a.Orden, a.IDAtributo;
END
GO
