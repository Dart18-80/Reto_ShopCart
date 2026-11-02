-- Solo existe en shopcart_test: el historial de estados de un pedido con el usuario de cada cambio, para
-- comprobar que se registra quién, cuándo, el estado anterior, el nuevo y el motivo (RF-07, N-08).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_LeerHistorialPedido
    @IDPedido       INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT h.CodigoEstadoAnterior, h.CodigoEstadoNuevo, h.IDUsuario, h.RolUsuario, h.Motivo, h.Fecha
    FROM   dbo.VW_Pedidos_Historial AS h
    WHERE  h.IDPedido = @IDPedido
    ORDER BY h.Fecha, h.IDHistorialEstadoPedido;
END
GO
