-- N-08, segunda capa: aunque alguien actualice Pedido sin pasar por el SP, un cambio de estado que no
-- está en TransicionEstadoPedido para el rol de SESSION_CONTEXT se rechaza y se revierte.
-- Sin rol en el contexto (por ejemplo, un job) no hay transición permitida.
CREATE OR ALTER TRIGGER dbo.TR_Pedidos_ValidarTransicion
ON dbo.Pedido
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT UPDATE(IDEstadoPedido) RETURN;

    DECLARE @Rol VARCHAR(20) = TRY_CONVERT(VARCHAR(20), SESSION_CONTEXT(N'Rol'));

    IF EXISTS (
        SELECT 1
        FROM   inserted AS i
        JOIN   deleted  AS d ON d.IDPedido = i.IDPedido
        WHERE  i.IDEstadoPedido <> d.IDEstadoPedido
          AND  NOT EXISTS (
                   SELECT 1
                   FROM   dbo.TransicionEstadoPedido AS t
                   JOIN   dbo.Rol                    AS r ON r.IDRol = t.IDRol
                   WHERE  t.IDEstadoOrigen  = d.IDEstadoPedido
                     AND  t.IDEstadoDestino = i.IDEstadoPedido
                     AND  r.Codigo          = @Rol))
        THROW 50701, N'El pedido no puede pasar a ese estado.', 1;
END
GO
