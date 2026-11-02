-- Solo existe en shopcart_test: cuántas filas tiene una llave de idempotencia (0 tras la purga).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_LeerSolicitudIdempotente
    @LlaveIdempotencia UNIQUEIDENTIFIER,
    @IDUsuarioActor    INT              = NULL,
    @RolActor          VARCHAR(20)      = NULL,
    @RequestId         UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT COUNT(*) AS Filas FROM dbo.SolicitudIdempotente AS s WHERE s.LlaveIdempotencia = @LlaveIdempotencia;
END
GO
