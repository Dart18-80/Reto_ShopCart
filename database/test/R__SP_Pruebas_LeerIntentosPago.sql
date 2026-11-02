-- Solo existe en shopcart_test: los intentos de pago de una sesión (o el de una llave), con su arrendamiento,
-- para comprobar la idempotencia, el arrendamiento y la conciliación (N-03).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_LeerIntentosPago
    @IDSesionCheckout  INT              = NULL,
    @LlaveIdempotencia UNIQUEIDENTIFIER = NULL,
    @IDUsuarioActor    INT              = NULL,
    @RolActor          VARCHAR(20)      = NULL,
    @RequestId         UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT i.IDIntentoPago, i.IDSesionCheckout, i.LlaveIdempotencia, i.Estado, i.CodigoRespuesta,
           i.IDTransaccionPasarela,
           CONVERT(BIT, IIF(i.ArrendadoHasta > SYSUTCDATETIME(), 1, 0)) AS Arrendado, i.TokenArrendamiento
    FROM   dbo.IntentoPago AS i
    WHERE  i.IDSesionCheckout = @IDSesionCheckout OR i.LlaveIdempotencia = @LlaveIdempotencia
    ORDER BY i.IDIntentoPago;
END
GO
