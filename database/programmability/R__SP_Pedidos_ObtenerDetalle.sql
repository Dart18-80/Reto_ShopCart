-- RF-06, RF-01: un pedido con su detalle. El Cliente solo ve los suyos (@IDUsuarioActor); uno ajeno no devuelve
-- nada, igual que uno inexistente (la API responde 404). Dos conjuntos: el pedido y sus líneas.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_ObtenerDetalle
    @IDPedido       INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Pedido AS p
                   WHERE p.IDPedido = @IDPedido AND (@RolActor <> 'Cliente' OR p.IDUsuario = @IDUsuarioActor))
        RETURN;

    SELECT p.IDPedido, p.NumeroPedido, e.Codigo AS Estado, p.Subtotal, p.Descuento, p.CostoEnvio, p.Total,
           p.BaseImponible, p.IVA, p.CodigoCupon, p.NombreMetodoEnvio, p.FechaEstimadaEntrega, p.FechaPago,
           p.FechaPagoLocal, p.MarcaTarjeta, p.UltimosDigitos, p.NombreRecibe, p.TelefonoRecibe, p.Departamento,
           p.Municipio, p.DireccionLinea, p.Referencia
    FROM   dbo.Pedido AS p
    JOIN   dbo.EstadoPedido AS e ON e.IDEstadoPedido = p.IDEstadoPedido
    WHERE  p.IDPedido = @IDPedido;

    SELECT d.IDVariante, d.SKU, d.NombreProducto, d.DescripcionVariante, d.NombreCategoria, d.Cantidad,
           d.PrecioUnitario, d.DescuentoLinea, d.TotalLinea
    FROM   dbo.DetallePedido AS d
    WHERE  d.IDPedido = @IDPedido
    ORDER BY d.IDVariante;
END
GO
