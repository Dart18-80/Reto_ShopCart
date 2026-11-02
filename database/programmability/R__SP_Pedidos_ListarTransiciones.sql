-- N-08: las transiciones permitidas del pedido (origen, destino y rol) tal como las hace cumplir
-- TR_Pedidos_ValidarTransicion. La usa la prueba que verifica que el mapa del servicio coincide con la tabla.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_ListarTransiciones
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT eo.Codigo AS Origen, ed.Codigo AS Destino, r.Codigo AS Rol
    FROM   dbo.TransicionEstadoPedido AS t
    JOIN   dbo.EstadoPedido AS eo ON eo.IDEstadoPedido = t.IDEstadoOrigen
    JOIN   dbo.EstadoPedido AS ed ON ed.IDEstadoPedido = t.IDEstadoDestino
    JOIN   dbo.Rol          AS r  ON r.IDRol = t.IDRol
    ORDER BY eo.Codigo, ed.Codigo, r.Codigo;
END
GO
