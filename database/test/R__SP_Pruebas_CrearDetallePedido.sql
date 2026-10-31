-- Solo existe en shopcart_test: agrega una línea al pedido con el precio vigente de la variante y sus
-- copias, como lo hará SP_Pedidos_CrearPedido.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_CrearDetallePedido
    @IDPedido       INT,
    @IDVariante     INT,
    @Cantidad       INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    INSERT INTO dbo.DetallePedido (IDPedido, IDVariante, IDPrecioVariante, SKU, NombreProducto, DescripcionVariante,
                                   IDCategoria, NombreCategoria, Cantidad, PrecioUnitario, DescuentoLinea, TotalLinea)
    SELECT @IDPedido, v.IDVariante, pv.IDPrecioVariante, v.SKU, p.Nombre, v.DescripcionAtributos,
           c.IDCategoria, c.Nombre, @Cantidad, pv.Precio, 0, @Cantidad * pv.Precio
    FROM   dbo.Variante  AS v
    JOIN   dbo.Producto  AS p ON p.IDProducto = v.IDProducto
    JOIN   dbo.Categoria AS c ON c.IDCategoria = p.IDCategoria
    CROSS APPLY dbo.FU_Catalogo_PrecioVigente(v.IDVariante) AS pv
    WHERE  v.IDVariante = @IDVariante;
END
GO
