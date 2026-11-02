-- depende-de: R__FU_Inventario_Disponible.sql
-- N-06, E5-H01: lo que un carrito puede tener de una variante. Las reservas vigentes de la sesión de pago
-- activa de ese mismo carrito son suyas: no le restan disponible. Si no, al iniciar el pago sus propias
-- líneas se verían agotadas y no podría cambiar su cantidad ni volver a agregarlas.
CREATE OR ALTER FUNCTION dbo.FU_Carrito_Disponible (@IDCarrito INT, @IDVariante INT)
RETURNS TABLE
AS
RETURN
    SELECT  inv.Disponible + propias.Cantidad AS Disponible
    FROM    dbo.FU_Inventario_Disponible(@IDVariante) AS inv
    CROSS APPLY (SELECT COALESCE(SUM(r.Cantidad), 0) AS Cantidad
                 FROM   dbo.Reserva AS r
                 JOIN   dbo.SesionCheckout AS s ON s.IDSesionCheckout = r.IDSesionCheckout
                 WHERE  s.IDCarrito = @IDCarrito AND s.Estado = 'Activa'
                   AND  r.IDVariante = @IDVariante AND r.Estado = 'Activa'
                   AND  r.FechaExpiracion > SYSUTCDATETIME()) AS propias;
GO
