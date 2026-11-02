-- Solo existe en shopcart_test: lo que dejó la cancelación de un pedido (estado, monto reembolsado, uso del
-- cupón, reingresos al kardex, intento de pago y la llave del intento) y, en un segundo conjunto, sus reembolsos,
-- para comprobar N-09 en la base.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_LeerCancelacion
    @IDPedido       INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT e.Codigo AS Estado, p.Total, p.MontoReembolsado,
           (SELECT u.Estado FROM dbo.UsoCupon AS u WHERE u.IDPedido = p.IDPedido) AS EstadoUsoCupon,
           (SELECT COUNT(*) FROM dbo.MovimientoKardex AS m
            JOIN dbo.TipoMovimiento AS t ON t.IDTipoMovimiento = m.IDTipoMovimiento
            WHERE m.IDPedido = p.IDPedido AND t.Codigo = 'ReingresoCancelacion') AS Reingresos,
           i.Estado AS EstadoIntento, i.CodigoRespuesta AS CodigoIntento, i.LlaveIdempotencia AS LlaveIntento,
           i.IDTransaccionPasarela
    FROM   dbo.Pedido AS p
    JOIN   dbo.EstadoPedido AS e ON e.IDEstadoPedido = p.IDEstadoPedido
    JOIN   dbo.IntentoPago AS i ON i.IDIntentoPago = p.IDIntentoPago
    WHERE  p.IDPedido = @IDPedido;

    SELECT r.IDReembolso, r.Origen, r.Monto, r.Estado, r.Intentos, r.LlaveIdempotencia, r.IDTransaccionReembolso
    FROM   dbo.Reembolso AS r
    WHERE  r.IDPedido = @IDPedido
    ORDER BY r.IDReembolso;
END
GO
