-- RF-06, N-03: el pedido creado con un intento de pago, si existe (UQ_Pedido_IDIntentoPago). Lo usa el pago
-- cuando SP_Pedidos_CrearPedido falla sin respuesta clara (por ejemplo, un timeout después de su COMMIT): solo
-- se anula la autorización si la base confirma que no hay pedido. El Cliente solo ve los suyos (RF-01).
-- Mismos dos conjuntos que SP_Pedidos_ObtenerDetalle; ninguno si no hay pedido.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_ObtenerDeIntento
    @IDIntentoPago  BIGINT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IDPedido INT = (SELECT p.IDPedido FROM dbo.Pedido AS p WHERE p.IDIntentoPago = @IDIntentoPago);

    IF @IDPedido IS NULL
        RETURN;

    EXEC dbo.SP_Pedidos_ObtenerDetalle @IDPedido = @IDPedido, @IDUsuarioActor = @IDUsuarioActor,
                                       @RolActor = @RolActor, @RequestId = @RequestId;
END
GO
