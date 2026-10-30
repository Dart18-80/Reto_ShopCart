-- Historial de estados de cada pedido con los nombres de los estados y quién hizo cada cambio.
CREATE OR ALTER VIEW dbo.VW_Pedidos_Historial
AS
SELECT  h.IDHistorialEstadoPedido,
        h.IDPedido,
        pe.NumeroPedido,
        ea.Codigo AS CodigoEstadoAnterior,
        ea.Nombre AS EstadoAnterior,
        en.Codigo AS CodigoEstadoNuevo,
        en.Nombre AS EstadoNuevo,
        h.IDUsuario,
        u.Nombre  AS NombreUsuario,
        r.Codigo  AS RolUsuario,
        h.Motivo,
        h.RequestId,
        h.Fecha
FROM    dbo.HistorialEstadoPedido AS h
JOIN    dbo.Pedido       AS pe ON pe.IDPedido = h.IDPedido
LEFT JOIN dbo.EstadoPedido AS ea ON ea.IDEstadoPedido = h.IDEstadoAnterior
JOIN    dbo.EstadoPedido AS en ON en.IDEstadoPedido = h.IDEstadoNuevo
JOIN    dbo.Usuario      AS u  ON u.IDUsuario = h.IDUsuario
JOIN    dbo.Rol          AS r  ON r.IDRol = u.IDRol;
GO
