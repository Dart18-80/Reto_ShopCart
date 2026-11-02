-- RF-01, RF-07: los pedidos del cliente de la petición (@IDUsuarioActor), los más recientes primero.
-- Dos conjuntos (sqlserver-sp §5): la página y el total. Índice IX_Pedido_Cliente (IDUsuario, FechaPago DESC).
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_ListarPropios
    @Pagina         INT              = 1,
    @Tamano         INT              = 20,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @RolActor IS NULL OR @RolActor <> 'Cliente' OR @IDUsuarioActor IS NULL
        THROW 50005, N'Solo un cliente lista sus propios pedidos.', 1;
    IF @Pagina < 1 OR @Tamano NOT BETWEEN 1 AND 100
        THROW 50003, N'Los parámetros de paginación no son válidos.', 1;

    SELECT p.IDPedido, p.NumeroPedido, e.Codigo AS Estado, p.Total, p.FechaPago, p.FechaPagoLocal,
           (SELECT SUM(d.Cantidad) FROM dbo.DetallePedido AS d WHERE d.IDPedido = p.IDPedido) AS Articulos,
           IIF(EXISTS (SELECT 1 FROM dbo.IntentoPago AS i WHERE i.IDIntentoPago = p.IDIntentoPago AND i.Estado = 'EnRevision'),
               'EnVerificacion', 'Confirmado') AS EstadoPago
    FROM   dbo.Pedido AS p
    JOIN   dbo.EstadoPedido AS e ON e.IDEstadoPedido = p.IDEstadoPedido
    WHERE  p.IDUsuario = @IDUsuarioActor
    ORDER BY p.FechaPago DESC, p.IDPedido DESC
    OFFSET (@Pagina - 1) * @Tamano ROWS
    FETCH NEXT @Tamano ROWS ONLY;

    SELECT COUNT(*) AS Total FROM dbo.Pedido AS p WHERE p.IDUsuario = @IDUsuarioActor;
END
GO
