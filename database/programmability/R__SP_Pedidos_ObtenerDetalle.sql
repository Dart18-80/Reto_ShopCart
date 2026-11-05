-- RF-06, RF-01, N-08: un pedido con su detalle y su historial de estados. El Cliente solo ve los suyos
-- (@IDUsuarioActor); uno ajeno no devuelve nada, igual que uno inexistente (la API responde 404).
-- Tres conjuntos: el pedido, sus líneas (con lo devuelto, N-10) y su historial (VW_Pedidos_Historial).
-- PuedeCancelar (M5-H01): el rol del actor tiene la transición del estado actual a Cancelado en
-- TransicionEstadoPedido y el pago no está en verificación (las mismas reglas que SP_Pedidos_AplicarCancelacion),
-- así la web no repite el mapa de transiciones.
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
           p.BaseImponible, p.IVA, p.MontoReembolsado, p.CodigoCupon, p.NombreMetodoEnvio, p.FechaEstimadaEntrega,
           p.FechaPago, p.FechaPagoLocal, p.MarcaTarjeta, p.UltimosDigitos, p.NombreRecibe, p.TelefonoRecibe,
           p.Departamento, p.Municipio, p.DireccionLinea, p.Referencia,
           -- El cobro de un pedido con el intento en revisión manual (V019) se muestra "en verificación".
           IIF(r.EnRevision = 1, 'EnVerificacion', 'Confirmado') AS EstadoPago,
           CONVERT(BIT, IIF(r.EnRevision = 0 AND EXISTS (
               SELECT 1
               FROM   dbo.TransicionEstadoPedido AS t
               JOIN   dbo.EstadoPedido AS d ON d.IDEstadoPedido = t.IDEstadoDestino
               JOIN   dbo.Rol          AS ro ON ro.IDRol = t.IDRol
               WHERE  t.IDEstadoOrigen = p.IDEstadoPedido AND d.Codigo = 'Cancelado' AND ro.Codigo = @RolActor), 1, 0))
               AS PuedeCancelar
    FROM   dbo.Pedido AS p
    JOIN   dbo.EstadoPedido AS e ON e.IDEstadoPedido = p.IDEstadoPedido
    CROSS APPLY (SELECT CONVERT(BIT, IIF(EXISTS (SELECT 1 FROM dbo.IntentoPago AS i
                                                 WHERE i.IDIntentoPago = p.IDIntentoPago AND i.Estado = 'EnRevision'),
                                     1, 0)) AS EnRevision) AS r
    WHERE  p.IDPedido = @IDPedido;

    SELECT d.IDDetallePedido, d.IDVariante, d.SKU, d.NombreProducto, d.DescripcionVariante, d.NombreCategoria,
           d.Cantidad, d.CantidadDevuelta, d.PrecioUnitario, d.DescuentoLinea, d.TotalLinea
    FROM   dbo.DetallePedido AS d
    WHERE  d.IDPedido = @IDPedido
    ORDER BY d.IDVariante;

    -- IX_HistorialEstadoPedido_Pedido.
    SELECT h.CodigoEstadoAnterior, h.CodigoEstadoNuevo, h.RolUsuario, h.Motivo, h.Fecha
    FROM   dbo.VW_Pedidos_Historial AS h
    WHERE  h.IDPedido = @IDPedido
    ORDER BY h.Fecha, h.IDHistorialEstadoPedido;
END
GO
