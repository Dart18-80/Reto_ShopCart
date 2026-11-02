-- Solo existe en shopcart_test: lo que dejó el pago de una sesión (pedidos, detalle, salidas del kardex,
-- historial, uso del cupón y estados de la sesión y del carrito), para comprobar la atomicidad de RF-06.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_LeerPagoDeSesion
    @IDSesionCheckout INT,
    @IDUsuarioActor   INT              = NULL,
    @RolActor         VARCHAR(20)      = NULL,
    @RequestId        UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IDPedido INT = (SELECT p.IDPedido FROM dbo.Pedido AS p WHERE p.IDSesionCheckout = @IDSesionCheckout);

    SELECT (SELECT COUNT(*) FROM dbo.Pedido AS p WHERE p.IDSesionCheckout = @IDSesionCheckout) AS Pedidos,
           (SELECT COUNT(*) FROM dbo.DetallePedido AS d WHERE d.IDPedido = @IDPedido) AS Detalles,
           (SELECT COUNT(*) FROM dbo.MovimientoKardex AS m WHERE m.IDPedido = @IDPedido) AS SalidasKardex,
           (SELECT COUNT(*) FROM dbo.HistorialEstadoPedido AS h WHERE h.IDPedido = @IDPedido) AS Historial,
           (SELECT u.Estado FROM dbo.UsoCupon AS u WHERE u.IDSesionCheckout = @IDSesionCheckout) AS EstadoUsoCupon,
           s.Estado AS EstadoSesion,
           c.Estado AS EstadoCarrito,
           (SELECT TOP (1) r.Estado FROM dbo.Reserva AS r WHERE r.IDSesionCheckout = @IDSesionCheckout) AS EstadoReserva
    FROM   dbo.SesionCheckout AS s
    JOIN   dbo.Carrito AS c ON c.IDCarrito = s.IDCarrito
    WHERE  s.IDSesionCheckout = @IDSesionCheckout;
END
GO
