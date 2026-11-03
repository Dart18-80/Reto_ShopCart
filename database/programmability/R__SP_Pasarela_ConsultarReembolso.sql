-- N-09 (E9-H04): el reembolso de una llave, si la pasarela lo procesó, aunque su respuesta se haya perdido. Sin
-- fila, la pasarela nunca recibió esa llave (NoExiste). Solo la usa el adaptador PasarelaSimulada.
CREATE OR ALTER PROCEDURE dbo.SP_Pasarela_ConsultarReembolso
    @LlaveIdempotencia UNIQUEIDENTIFIER,
    @IDUsuarioActor    INT              = NULL,
    @RolActor          VARCHAR(20)      = NULL,
    @RequestId         UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT r.IDReembolso
    FROM   dbo.PasarelaReembolso AS r
    WHERE  r.LlaveIdempotencia = @LlaveIdempotencia;
END
GO
