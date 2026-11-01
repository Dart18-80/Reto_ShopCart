-- RF-03, N-07: los movimientos del kardex de una variante con su tipo y el usuario responsable, tal como los
-- muestra la API. La usan SP_Inventario_ObtenerKardex y los SPs de entrada y ajuste para devolver el
-- movimiento que registraron.
CREATE OR ALTER FUNCTION dbo.FU_Inventario_Movimientos (@IDVariante INT)
RETURNS TABLE
AS
RETURN
    SELECT m.IDMovimientoKardex, m.IDVariante, t.Codigo AS Tipo, m.Signo, m.Cantidad,
           m.ExistenciaAnterior, m.ExistenciaResultante, m.Motivo, m.Referencia, m.IDPedido,
           m.IDDevolucion, m.IDUsuario, u.Nombre AS Usuario, m.Fecha
    FROM   dbo.MovimientoKardex AS m
    JOIN   dbo.TipoMovimiento   AS t ON t.IDTipoMovimiento = m.IDTipoMovimiento
    JOIN   dbo.Usuario          AS u ON u.IDUsuario = m.IDUsuario
    WHERE  m.IDVariante = @IDVariante;
GO
