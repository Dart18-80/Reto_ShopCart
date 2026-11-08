-- N-10: el plazo de devolución de un pedido, contado desde que pasó a Entregado (su historial) por
-- ParametroSistema.DiasPlazoDevolucion. EnPlazo = 1 si @Ahora todavía cae dentro del plazo; un pedido que nunca
-- se entregó no tiene fila. Una sola regla para SP_Pedidos_RegistrarDevolucion (que la exige bajo bloqueo) y
-- SP_Pedidos_ObtenerDetalleGestion (que ofrece la devolución). IX_HistorialEstadoPedido_Pedido.
CREATE OR ALTER FUNCTION dbo.FU_Pedidos_PlazoDevolucion (@IDPedido INT, @Ahora DATETIME2(3))
RETURNS TABLE
AS
RETURN
    SELECT h.FechaEntrega,
           CONVERT(BIT, IIF(DATEADD(DAY, ps.DiasPlazoDevolucion, h.FechaEntrega) >= @Ahora, 1, 0)) AS EnPlazo
    FROM  (SELECT MIN(he.Fecha) AS FechaEntrega
           FROM   dbo.HistorialEstadoPedido AS he
           JOIN   dbo.EstadoPedido AS e ON e.IDEstadoPedido = he.IDEstadoNuevo
           WHERE  he.IDPedido = @IDPedido AND e.Codigo = 'Entregado') AS h
    CROSS JOIN (SELECT TOP (1) p.DiasPlazoDevolucion
                FROM dbo.ParametroSistema AS p ORDER BY p.IDParametroSistema) AS ps
    WHERE h.FechaEntrega IS NOT NULL;
GO
