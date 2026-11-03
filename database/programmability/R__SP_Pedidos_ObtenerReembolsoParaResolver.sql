-- E9-H04: lo que el servicio necesita antes de resolver a mano un reembolso: su llave, para consultar en la pasarela
-- si ya lo procesó, y su estado (prevalidación; SP_Pedidos_ResolverReembolso vuelve a validar bajo bloqueo).
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

    SELECT r.Estado, r.LlaveIdempotencia
    FROM   dbo.Reembolso AS r
    WHERE  r.IDReembolso = @IDReembolso;
END
GO
