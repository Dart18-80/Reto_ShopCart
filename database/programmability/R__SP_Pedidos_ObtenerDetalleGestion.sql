-- M8-H01, RF-07: un pedido para el Operador o el Admin, con lo que la gestión puede hacer con él ahora, calculado
-- aquí para que la web no repita ninguna regla. Cinco conjuntos:
--   1-3. Los de SP_Pedidos_ObtenerDetalle: el pedido (con PuedeCancelar para el rol del actor), sus líneas (con
--        Devolvible = vendido − devuelto) y su historial.
--   4.   El cliente y PuedeDevolver (N-10: Entregado o DevueltoParcial dentro de FU_Pedidos_PlazoDevolucion).
--   5.   TransicionesPermitidas: los destinos de TransicionEstadoPedido desde el estado actual para el rol del
--        actor que acepta SP_Pedidos_CambiarEstado (sin Cancelado, DevueltoParcial ni Devuelto, que tienen su
--        propia vía) y, desde Pagado, solo con el cobro Capturado (50710), en el orden del ciclo.
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

    SELECT d.Codigo AS Estado
    FROM   dbo.Pedido AS p
    JOIN   dbo.EstadoPedido AS o ON o.IDEstadoPedido = p.IDEstadoPedido
    JOIN   dbo.TransicionEstadoPedido AS t ON t.IDEstadoOrigen = p.IDEstadoPedido
    JOIN   dbo.EstadoPedido AS d ON d.IDEstadoPedido = t.IDEstadoDestino
    JOIN   dbo.Rol AS r ON r.IDRol = t.IDRol
    WHERE  p.IDPedido = @IDPedido
      AND  r.Codigo = @RolActor
      AND  d.Codigo NOT IN ('Cancelado', 'DevueltoParcial', 'Devuelto')
      AND  (o.Codigo <> 'Pagado'
            OR EXISTS (SELECT 1 FROM dbo.IntentoPago AS i
                       WHERE i.IDIntentoPago = p.IDIntentoPago AND i.Estado = 'Capturado'))
    ORDER BY d.Orden;
END
GO
