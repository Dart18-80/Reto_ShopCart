-- Solo existe en shopcart_test: las devoluciones de un pedido (fecha UTC, día de Guatemala y monto) y, en un
-- segundo conjunto, sus líneas con lo reembolsado, para comprobar N-10 y N-11 en la base.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_LeerDevoluciones
    @IDPedido       INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT d.IDDevolucion, d.IDUsuario, d.MontoReembolso, d.Fecha, CONVERT(VARCHAR(10), d.FechaLocal, 23) AS FechaLocal
    FROM   dbo.Devolucion AS d
    WHERE  d.IDPedido = @IDPedido
    ORDER BY d.IDDevolucion;

    SELECT dd.IDDevolucion, dd.IDDetallePedido, dd.Cantidad, dd.MontoReembolso
    FROM   dbo.DetalleDevolucion AS dd
    JOIN   dbo.Devolucion AS d ON d.IDDevolucion = dd.IDDevolucion
    WHERE  d.IDPedido = @IDPedido
    ORDER BY dd.IDDevolucion, dd.IDDetallePedido;
END
GO
