-- N-03 (E5-H02): el estado de una autorización por su llave, para la conciliación (E5-H04). Sin fila, la
-- pasarela nunca recibió esa llave (NoExiste). Solo la usa el adaptador PasarelaSimulada.
CREATE OR ALTER PROCEDURE dbo.SP_Pasarela_Consultar
    @LlaveIdempotencia UNIQUEIDENTIFIER,
    @IDUsuarioActor    INT              = NULL,
    @RolActor          VARCHAR(20)      = NULL,
    @RequestId         UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT a.IDTransaccion, a.Estado, a.Marca, a.UltimosDigitos, a.CodigoRespuesta, a.MensajeRespuesta
    FROM   dbo.PasarelaAutorizacion AS a
    WHERE  a.LlaveIdempotencia = @LlaveIdempotencia;
END
GO
