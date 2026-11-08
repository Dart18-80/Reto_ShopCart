-- N-08: los destinos de TransicionEstadoPedido desde @IDEstadoOrigen para @Rol, con lo que decide si la gestión
-- puede pedirlos con SP_Pedidos_CambiarEstado. Una sola regla para ese SP (que la exige) y para
-- SP_Pedidos_ObtenerDetalleGestion (que ofrece los botones), así no pueden discrepar:
--   ViaGestion = 0: Cancelado, DevueltoParcial y Devuelto tienen su propia vía (la cancelación con su reembolso y
--                   el SP de devoluciones, que deriva el estado de lo devuelto).
--   CobroPendiente = 1: desde Pagado solo se avanza con el cobro Capturado (decisión del PO, E9-H04).
CREATE OR ALTER FUNCTION dbo.FU_Pedidos_TransicionesGestion
    (@IDPedido INT, @IDEstadoOrigen INT, @Rol VARCHAR(20))
RETURNS TABLE
AS
RETURN
    SELECT d.IDEstadoPedido AS IDEstadoDestino, d.Codigo, d.Orden,
           CONVERT(BIT, IIF(d.Codigo IN ('Cancelado', 'DevueltoParcial', 'Devuelto'), 0, 1)) AS ViaGestion,
           CONVERT(BIT, IIF(o.Codigo = 'Pagado'
                            AND NOT EXISTS (SELECT 1
                                            FROM   dbo.Pedido AS p
                                            JOIN   dbo.IntentoPago AS i ON i.IDIntentoPago = p.IDIntentoPago
                                            WHERE  p.IDPedido = @IDPedido AND i.Estado = 'Capturado'), 1, 0))
               AS CobroPendiente
    FROM   dbo.TransicionEstadoPedido AS t
    JOIN   dbo.EstadoPedido AS o ON o.IDEstadoPedido = t.IDEstadoOrigen
    JOIN   dbo.EstadoPedido AS d ON d.IDEstadoPedido = t.IDEstadoDestino
    JOIN   dbo.Rol          AS r ON r.IDRol = t.IDRol
    WHERE  t.IDEstadoOrigen = @IDEstadoOrigen AND r.Codigo = @Rol;
GO
