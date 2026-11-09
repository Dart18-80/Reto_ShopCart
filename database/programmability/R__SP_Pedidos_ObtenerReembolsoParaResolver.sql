-- E9-H04: lo que el servicio necesita antes de resolver a mano un reembolso: su llave, para consultar en la pasarela
-- si ya lo procesó; la llave del intento, para consultar si el cobro se capturó; su estado y si ya pasó el plazo
-- desde su última actualización, con la misma expresión y el mismo reloj que los SPs que resuelven (prevalidación:
-- ellos lo vuelven a exigir bajo bloqueo), y su FechaActualizacion, la versión que la resolución exige (concurrencia
-- optimista). El intento se alcanza por el pedido o, en un cobro sin pedido, directo desde el reembolso.
-- Ninguna fila si el reembolso no existe. Solo el Administrador.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_ObtenerReembolsoParaResolver
    @IDReembolso          INT,
    @SegundosEsperaMinima INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @RolActor IS NULL OR @RolActor <> 'Administrador'
        THROW 50005, N'Solo el Administrador consulta un reembolso para resolverlo.', 1;

    SELECT r.Estado, r.LlaveIdempotencia, i.LlaveIdempotencia AS LlaveIntento, r.FechaActualizacion, a.PlazoCumplido
    FROM   dbo.Reembolso AS r
    LEFT JOIN dbo.Pedido AS p ON p.IDPedido = r.IDPedido
    JOIN   dbo.IntentoPago AS i ON i.IDIntentoPago = COALESCE(p.IDIntentoPago, r.IDIntentoPago)
    CROSS APPLY dbo.FU_Pedidos_ReembolsoResoluble(r.Estado, r.FechaActualizacion, @SegundosEsperaMinima) AS a
    WHERE  r.IDReembolso = @IDReembolso;
END
GO
