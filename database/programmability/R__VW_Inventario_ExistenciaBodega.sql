-- N-07: la salida del kardex ocurre al pagar, pero la mercadería sigue en bodega hasta despacharse.
-- Para el conteo físico: existencia + unidades de pedidos pagados aún no despachados.
CREATE OR ALTER VIEW dbo.VW_Inventario_ExistenciaBodega
AS
SELECT  v.IDVariante,
        v.SKU,
        v.ExistenciaFisica,
        p.UnidadesPorDespachar,
        v.ExistenciaFisica + p.UnidadesPorDespachar AS ExistenciaBodega
FROM    dbo.Variante AS v
CROSS APPLY (
    SELECT COALESCE(SUM(dp.Cantidad), 0) AS UnidadesPorDespachar
    FROM   dbo.DetallePedido AS dp
    JOIN   dbo.Pedido        AS pe ON pe.IDPedido = dp.IDPedido
    JOIN   dbo.EstadoPedido  AS e  ON e.IDEstadoPedido = pe.IDEstadoPedido
    WHERE  dp.IDVariante = v.IDVariante
      AND  e.Codigo IN ('Pagado', 'EnPreparacion')
) AS p;
GO
