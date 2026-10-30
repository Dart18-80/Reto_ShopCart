-- RF-09: en Pedido solo se registra el cambio de estado (el detalle de cada cambio está en
-- HistorialEstadoPedido).
CREATE OR ALTER TRIGGER dbo.TR_Pedidos_Bitacora
ON dbo.Pedido
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT UPDATE(IDEstadoPedido) RETURN;

    DECLARE @IDUsuario INT              = TRY_CONVERT(INT, SESSION_CONTEXT(N'IDUsuario')),
            @RequestId UNIQUEIDENTIFIER = TRY_CONVERT(UNIQUEIDENTIFIER, SESSION_CONTEXT(N'RequestId'));

    INSERT INTO dbo.Bitacora (Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, IDUsuario, RequestId)
    SELECT  'Pedidos', 'Pedido', CONVERT(VARCHAR(50), i.IDPedido), 'CambioEstado',
            (SELECT d.IDEstadoPedido, ea.Codigo AS Estado FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            (SELECT i.IDEstadoPedido, en.Codigo AS Estado FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            @IDUsuario, @RequestId
    FROM    inserted AS i
    JOIN    deleted  AS d  ON d.IDPedido = i.IDPedido
    JOIN    dbo.EstadoPedido AS ea ON ea.IDEstadoPedido = d.IDEstadoPedido
    JOIN    dbo.EstadoPedido AS en ON en.IDEstadoPedido = i.IDEstadoPedido
    WHERE   i.IDEstadoPedido <> d.IDEstadoPedido;
END
GO
