-- Solo existe en shopcart_test: todo lo que la pasarela simulada guardó para una llave (autorización y
-- reembolsos), para comprobar que nunca guarda el número completo de la tarjeta ni el CVV.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_LeerPasarela
    @LlaveIdempotencia UNIQUEIDENTIFIER,
    @IDUsuarioActor    INT              = NULL,
    @RolActor          VARCHAR(20)      = NULL,
    @RequestId         UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT a.IDPasarelaAutorizacion, a.LlaveIdempotencia, a.IDTransaccion, a.Monto, a.Marca, a.UltimosDigitos,
           a.Estado, a.CodigoRespuesta, a.MensajeRespuesta,
           (SELECT r.IDReembolso, r.Monto FROM dbo.PasarelaReembolso AS r
            WHERE r.IDTransaccion = a.IDTransaccion FOR JSON PATH) AS Reembolsos
    FROM   dbo.PasarelaAutorizacion AS a
    WHERE  a.LlaveIdempotencia = @LlaveIdempotencia;
END
GO
