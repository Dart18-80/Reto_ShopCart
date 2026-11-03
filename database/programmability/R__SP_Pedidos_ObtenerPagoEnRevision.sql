-- E9-H04: lo que el servicio necesita antes de resolver un pago en revisión: la llave para consultar la pasarela,
-- su estado (prevalidación; SP_Pedidos_ResolverPagoEnRevision vuelve a validar bajo bloqueo) y si tiene pedido.
-- Ninguna fila si el intento no existe. Solo el Administrador.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_ObtenerPagoEnRevision
    @IDIntentoPago  BIGINT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @RolActor IS NULL OR @RolActor <> 'Administrador'
        THROW 50005, N'Solo el Administrador consulta un pago en revisión.', 1;

    SELECT i.IDIntentoPago, i.LlaveIdempotencia, i.Estado, p.IDPedido
    FROM   dbo.IntentoPago AS i
    LEFT JOIN dbo.Pedido AS p ON p.IDIntentoPago = i.IDIntentoPago
    WHERE  i.IDIntentoPago = @IDIntentoPago;
END
GO
