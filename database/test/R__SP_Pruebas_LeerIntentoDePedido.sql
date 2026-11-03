-- Solo existe en shopcart_test: el intento de pago de un pedido con su resolución manual (E9-H04).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_LeerIntentoDePedido
    @IDPedido       INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT i.IDIntentoPago, i.Estado, i.ResolucionManual, i.MotivoResolucion, i.IDUsuarioResolucion
    FROM   dbo.IntentoPago AS i
    JOIN   dbo.Pedido AS p ON p.IDIntentoPago = i.IDIntentoPago
    WHERE  p.IDPedido = @IDPedido;
END
GO
