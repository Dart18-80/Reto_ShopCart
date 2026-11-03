-- E9-H04: lo que el servicio necesita antes de resolver a mano un reembolso: su llave, para consultar en la pasarela
-- si ya lo procesó; la llave del intento, para consultar si el cobro se capturó; su estado y los segundos desde su
-- última actualización, medidos con el reloj de la base (prevalidación; los SPs que resuelven vuelven a validar bajo
-- bloqueo), y su FechaActualizacion, la versión que la resolución exige (concurrencia optimista). El intento se
-- alcanza por el pedido o, en un cobro sin pedido, directo desde el reembolso.
-- Ninguna fila si el reembolso no existe. Solo el Administrador.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_ObtenerReembolsoParaResolver
    @IDReembolso    INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @RolActor IS NULL OR @RolActor <> 'Administrador'
        THROW 50005, N'Solo el Administrador consulta un reembolso para resolverlo.', 1;

    SELECT r.Estado, r.LlaveIdempotencia, i.LlaveIdempotencia AS LlaveIntento, r.FechaActualizacion,
           DATEDIFF_BIG(SECOND, r.FechaActualizacion, SYSUTCDATETIME()) AS SegundosDesdeActualizacion
    FROM   dbo.Reembolso AS r
    LEFT JOIN dbo.Pedido AS p ON p.IDPedido = r.IDPedido
    JOIN   dbo.IntentoPago AS i ON i.IDIntentoPago = COALESCE(p.IDIntentoPago, r.IDIntentoPago)
    WHERE  r.IDReembolso = @IDReembolso;
END
GO
