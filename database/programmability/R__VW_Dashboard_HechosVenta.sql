-- N-11, M-07: la definición única de "venta" para todos los reportes. Una fila por línea vendida de un pedido no
-- cancelado, en su FechaPagoLocal (día de Guatemala), y una fila en negativo por línea devuelta, en la FechaLocal
-- de la devolución: un periodo ya reportado no cambia. Monto = productos neto de descuento, con IVA y sin envío
-- (el envío se reporta aparte). Los filtros por fecha usan IX_Pedido_Reportes e IX_Devolucion_FechaLocal.
CREATE OR ALTER VIEW dbo.VW_Dashboard_HechosVenta
AS
SELECT  'Venta'          AS Tipo,
        p.FechaPagoLocal AS Fecha,
        p.IDPedido,
        d.IDCategoria,
        d.IDVariante,
        d.Cantidad       AS Unidades,
        d.TotalLinea     AS Monto
FROM    dbo.Pedido AS p
JOIN    dbo.EstadoPedido AS e ON e.IDEstadoPedido = p.IDEstadoPedido
JOIN    dbo.DetallePedido AS d ON d.IDPedido = p.IDPedido
WHERE   e.Codigo <> 'Cancelado'
UNION ALL
SELECT  'Devolucion',
        dv.FechaLocal,
        dv.IDPedido,
        d.IDCategoria,
        d.IDVariante,
        -dd.Cantidad,
        -dd.MontoReembolso
FROM    dbo.Devolucion AS dv
JOIN    dbo.DetalleDevolucion AS dd ON dd.IDDevolucion = dv.IDDevolucion
JOIN    dbo.DetallePedido AS d ON d.IDDetallePedido = dd.IDDetallePedido;
GO
