-- RF-08, N-11, N-13: el resumen del periodo (días de Guatemala, por defecto los últimos 30) sobre la definición
-- única de venta: ventas netas (productos con IVA, sin envío, menos las devoluciones en su fecha), pedidos pagados
-- no cancelados, ticket promedio (ventas netas / pedidos), unidades, devoluciones, envío cobrado aparte y los
-- carritos abandonados cuya última actividad cae en el periodo, con su monto potencial perdido.
CREATE OR ALTER PROCEDURE dbo.SP_Dashboard_Resumen
    @Desde          DATE             = NULL,
    @Hasta          DATE             = NULL,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @RolActor IS NULL OR @RolActor <> 'Administrador'
        THROW 50005, N'Solo el Administrador consulta el dashboard.', 1;

    -- A-12: sin rango, los últimos 30 días de Guatemala (hoy incluido).
    SET @Hasta = COALESCE(@Hasta, (SELECT f.FechaLocal FROM dbo.FU_Sistema_FechaLocal(SYSUTCDATETIME()) AS f));
    SET @Desde = COALESCE(@Desde, DATEADD(DAY, -29, @Hasta));
    IF @Desde > @Hasta
        THROW 50003, N'La fecha inicial no puede ser posterior a la final.', 1;

    DECLARE @Ventas DECIMAL(15,2), @Pedidos INT, @Unidades INT, @Devoluciones DECIMAL(15,2);

    SELECT @Ventas       = CONVERT(DECIMAL(15,2), COALESCE(SUM(h.Monto), 0)),
           @Pedidos      = COUNT(DISTINCT CASE WHEN h.Tipo = 'Venta' THEN h.IDPedido END),
           @Unidades     = COALESCE(SUM(h.Unidades), 0),
           @Devoluciones = CONVERT(DECIMAL(15,2), -COALESCE(SUM(CASE WHEN h.Tipo = 'Devolucion' THEN h.Monto END), 0))
    FROM   dbo.VW_Dashboard_HechosVenta AS h
    WHERE  h.Fecha BETWEEN @Desde AND @Hasta;

    SELECT @Desde AS Desde, @Hasta AS Hasta, @Ventas AS Ventas, @Pedidos AS Pedidos,
           CONVERT(DECIMAL(15,2), IIF(@Pedidos = 0, 0, @Ventas / @Pedidos)) AS TicketPromedio,
           @Unidades AS Unidades, @Devoluciones AS Devoluciones,
           (SELECT CONVERT(DECIMAL(15,2), COALESCE(SUM(p.CostoEnvio), 0))
            FROM   dbo.Pedido AS p
            JOIN   dbo.EstadoPedido AS e ON e.IDEstadoPedido = p.IDEstadoPedido
            WHERE  p.FechaPagoLocal BETWEEN @Desde AND @Hasta AND e.Codigo <> 'Cancelado') AS Envio,
           (SELECT COUNT(*) FROM dbo.VW_Carrito_Abandonados AS a
            WHERE  a.FechaLocalUltimaActividad BETWEEN @Desde AND @Hasta) AS CarritosAbandonados,
           (SELECT CONVERT(DECIMAL(15,2), COALESCE(SUM(a.MontoPotencial), 0)) FROM dbo.VW_Carrito_Abandonados AS a
            WHERE  a.FechaLocalUltimaActividad BETWEEN @Desde AND @Hasta) AS MontoPotencialPerdido;
END
GO
