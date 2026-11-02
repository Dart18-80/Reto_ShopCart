-- Solo existe en shopcart_test: lo que dejó S006 (SP_Semilla_GenerarDatosDemo), para comprobar E7-H03 en la base:
-- cuántos pedidos, en qué días, con qué estados; que cada venta, cancelación y devolución tiene su movimiento de
-- kardex con la misma fecha; que el historial empieza en la fecha de pago; los carritos abandonados y la
-- conciliación de inventario.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_ResumenDatosDemo
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Demo TABLE (IDPedido INT PRIMARY KEY, FechaPago DATETIME2(3), Estado VARCHAR(20));
    INSERT INTO @Demo (IDPedido, FechaPago, Estado)
    SELECT p.IDPedido, p.FechaPago, e.Codigo
    FROM   dbo.Pedido AS p JOIN dbo.EstadoPedido AS e ON e.IDEstadoPedido = p.IDEstadoPedido
    WHERE  p.IDTransaccionPasarela LIKE 'DEMO-%';

    SELECT (SELECT COUNT(*) FROM @Demo) AS Pedidos,
           (SELECT COUNT(*) FROM dbo.Usuario AS u WHERE u.Correo LIKE N'demo[0-9][0-9][0-9]@shopcart.gt') AS Clientes,
           (SELECT DATEDIFF(DAY, MIN(d.FechaPago), SYSUTCDATETIME()) FROM @Demo AS d) AS DiasDelMasAntiguo,
           (SELECT COUNT(*) FROM @Demo AS d WHERE d.FechaPago > SYSUTCDATETIME()) AS PedidosEnElFuturo,
           (SELECT COUNT(*) FROM @Demo AS d WHERE d.Estado = 'Cancelado') AS Cancelados,
           (SELECT COUNT(*) FROM @Demo AS d WHERE d.Estado IN ('DevueltoParcial', 'Devuelto')) AS ConDevolucion,
           (SELECT COUNT(*) FROM @Demo AS d WHERE d.Estado = 'Entregado') AS Entregados,
           -- Cada línea vendida tiene su salida en el kardex con la fecha de pago del pedido.
           (SELECT COUNT(*) FROM dbo.DetallePedido AS dp JOIN @Demo AS d ON d.IDPedido = dp.IDPedido
            WHERE NOT EXISTS (SELECT 1 FROM dbo.MovimientoKardex AS m
                              JOIN dbo.TipoMovimiento AS t ON t.IDTipoMovimiento = m.IDTipoMovimiento
                              WHERE m.IDPedido = dp.IDPedido AND m.IDVariante = dp.IDVariante
                                AND t.Codigo = 'SalidaVenta' AND m.Fecha = d.FechaPago)) AS VentasSinKardexEnSuFecha,
           (SELECT COUNT(*) FROM dbo.MovimientoKardex AS m JOIN @Demo AS d ON d.IDPedido = m.IDPedido
            JOIN dbo.TipoMovimiento AS t ON t.IDTipoMovimiento = m.IDTipoMovimiento
            WHERE t.Codigo = 'ReingresoDevolucion'
              AND NOT EXISTS (SELECT 1 FROM dbo.Devolucion AS dv
                              WHERE dv.IDDevolucion = m.IDDevolucion AND dv.Fecha = m.Fecha)) AS ReingresosFueraDeFecha,
           (SELECT COUNT(*) FROM dbo.HistorialEstadoPedido AS h JOIN @Demo AS d ON d.IDPedido = h.IDPedido
            WHERE h.IDEstadoAnterior IS NULL AND h.Fecha <> d.FechaPago) AS HistorialFueraDeFecha,
           (SELECT COUNT(*) FROM dbo.HistorialEstadoPedido AS h JOIN @Demo AS d ON d.IDPedido = h.IDPedido
            WHERE h.Fecha > SYSUTCDATETIME()) AS HistorialEnElFuturo,
           (SELECT COUNT(*) FROM dbo.VW_Carrito_Abandonados AS a
            JOIN dbo.Usuario AS u ON u.IDUsuario = a.IDUsuario
            WHERE u.Correo LIKE N'demo[0-9][0-9][0-9]@shopcart.gt') AS CarritosAbandonados,
           -- Solo las variantes que vendió el generador: otras pruebas rompen el kardex a propósito.
           (SELECT COUNT(*) FROM dbo.VW_Inventario_Conciliacion AS c
            WHERE EXISTS (SELECT 1 FROM dbo.DetallePedido AS dp JOIN @Demo AS d ON d.IDPedido = dp.IDPedido
                          WHERE dp.IDVariante = c.IDVariante)) AS FilasConciliacion;
END
GO
