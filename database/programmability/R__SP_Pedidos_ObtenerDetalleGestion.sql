-- M8-H01, RF-07: un pedido para el Operador o el Admin, con lo que la gestión puede hacer con él ahora, calculado
-- aquí para que la web no repita ninguna regla. Cinco conjuntos:
--   1-3. Los de SP_Pedidos_ObtenerDetalle: el pedido (con PuedeCancelar para el rol del actor), sus líneas (con
--        Devolvible = vendido − devuelto) y su historial.
--   4.   El cliente y PuedeDevolver (N-10: Entregado o DevueltoParcial dentro de FU_Pedidos_PlazoDevolucion).
--   5.   TransicionesPermitidas: los destinos desde el estado actual que SP_Pedidos_CambiarEstado acepta para el rol
--        del actor, con la misma FU_Pedidos_TransicionesGestion (sin las vías propias ni el cobro pendiente), en el
--        orden del ciclo.
-- Un pedido inexistente no devuelve nada (la API responde 404).
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_ObtenerDetalleGestion
    @IDPedido       INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @RolActor IS NULL OR @RolActor NOT IN ('Operador', 'Administrador')
        THROW 50005, N'Solo el Operador y el Administrador gestionan pedidos.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Pedido AS p WHERE p.IDPedido = @IDPedido)
        RETURN;

    EXEC dbo.SP_Pedidos_ObtenerDetalle @IDPedido = @IDPedido, @IDUsuarioActor = @IDUsuarioActor,
                                       @RolActor = @RolActor, @RequestId = @RequestId;

    SELECT u.IDUsuario AS IDCliente, u.Nombre AS NombreCliente, u.Correo AS CorreoCliente,
           CONVERT(BIT, IIF(e.Codigo IN ('Entregado', 'DevueltoParcial') AND pl.EnPlazo = 1, 1, 0)) AS PuedeDevolver
    FROM   dbo.Pedido AS p
    JOIN   dbo.Usuario AS u ON u.IDUsuario = p.IDUsuario
    JOIN   dbo.EstadoPedido AS e ON e.IDEstadoPedido = p.IDEstadoPedido
    OUTER APPLY dbo.FU_Pedidos_PlazoDevolucion(p.IDPedido, SYSUTCDATETIME()) AS pl
    WHERE  p.IDPedido = @IDPedido;

    SELECT f.Codigo AS Estado
    FROM   dbo.Pedido AS p
    CROSS APPLY dbo.FU_Pedidos_TransicionesGestion(p.IDPedido, p.IDEstadoPedido, @RolActor) AS f
    WHERE  p.IDPedido = @IDPedido AND f.ViaGestion = 1 AND f.CobroPendiente = 0
    ORDER BY f.Orden;
END
GO
