-- N-08, segunda capa: aunque alguien actualice Pedido sin pasar por el SP, un cambio de estado que no
-- está en TransicionEstadoPedido para el rol de SESSION_CONTEXT se rechaza y se revierte.
-- Sin rol en el contexto (por ejemplo, un job) no hay transición permitida.
-- Y, como SP_Pedidos_CambiarEstado, no deja avanzar desde Pagado sin el cobro Capturado (50710).
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

    -- Decisión del PO (E9-H04): salvo para cancelar, un pedido sale de Pagado solo con el cobro Capturado.
    IF EXISTS (
        SELECT 1
        FROM   inserted AS i
        JOIN   deleted  AS d ON d.IDPedido = i.IDPedido
        JOIN   dbo.EstadoPedido AS origen  ON origen.IDEstadoPedido  = d.IDEstadoPedido
        JOIN   dbo.EstadoPedido AS destino ON destino.IDEstadoPedido = i.IDEstadoPedido
        JOIN   dbo.IntentoPago  AS ip ON ip.IDIntentoPago = i.IDIntentoPago
        WHERE  origen.Codigo = 'Pagado'
          AND  destino.Codigo NOT IN ('Pagado', 'Cancelado')
          AND  ip.Estado <> 'Capturado')
        THROW 50710, N'El cobro de este pedido aún no se confirma.', 1;
END
GO
