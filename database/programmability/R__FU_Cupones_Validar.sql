-- depende-de: R__FU_Carrito_Lineas.sql
-- N-12, RF-05: valida un cupón para un carrito. Una fila: NumeroError NULL si es válido; si no, el código de
-- la primera causa de rechazo (cada una con su número y su mensaje) y, para el mínimo, cuánto falta.
-- Orden: no existe, inactivo, aún no vigente, vencido, agotado, límite por cliente, mínimo no alcanzado
-- (sobre el subtotal comprable de todo el carrito, N-12) y sin productos comprables de la categoría.
-- El límite por cliente cuenta usos confirmados más reservados vigentes (@IDUsuario NULL = invitado: no
-- aplica; el checkout exige sesión). La reserva de la sesión de pago de este mismo carrito no cuenta como
-- otro uso, ni para el límite por cliente ni para el agotado: volver al carrito no quita el cupón.
CREATE OR ALTER FUNCTION dbo.FU_Cupones_Validar (@IDCupon INT, @IDUsuario INT, @IDCarrito INT)
RETURNS TABLE
AS
RETURN
    SELECT  n.NumeroError,
            CASE n.NumeroError
                WHEN 50501 THEN N'El cupón no existe.'
                WHEN 50502 THEN N'El cupón no está activo.'
                WHEN 50503 THEN N'El cupón todavía no es válido.'
                WHEN 50504 THEN N'El cupón ya venció.'
                WHEN 50505 THEN N'El cupón alcanzó su límite de usos.'
                WHEN 50506 THEN N'Ya usaste este cupón el máximo de veces permitido.'
                WHEN 50507 THEN N'El carrito no alcanza la compra mínima del cupón.'
                WHEN 50508 THEN N'El carrito no tiene productos de la categoría del cupón.'
            END AS Mensaje,
            CASE WHEN n.NumeroError = 50507 THEN m.Faltante END AS Faltante
    FROM    (VALUES (1)) AS base (Uno)
    LEFT JOIN dbo.Cupon AS c ON c.IDCupon = @IDCupon
    OUTER APPLY (SELECT CONVERT(DECIMAL(15,2), SUM(l.TotalComprable)) AS Subtotal,
                        COUNT(CASE WHEN p.IDCategoria = cc.IDCategoria AND l.TotalComprable > 0 THEN 1 END) AS LineasCategoria
                 FROM   dbo.FU_Carrito_Lineas(@IDCarrito) AS l
                 JOIN   dbo.Producto AS p ON p.IDProducto = l.IDProducto
                 LEFT JOIN dbo.Cupon AS cc ON cc.IDCupon = @IDCupon) AS t
    OUTER APPLY (SELECT COUNT(CASE WHEN s.IDCarrito = @IDCarrito THEN 1 END) AS DeEsteCarrito,
                        COUNT(CASE WHEN u.IDUsuario = @IDUsuario AND s.IDCarrito <> @IDCarrito THEN 1 END) AS DelCliente
                 FROM   dbo.UsoCupon AS u
                 JOIN   dbo.SesionCheckout AS s ON s.IDSesionCheckout = u.IDSesionCheckout
                 WHERE  u.IDCupon = @IDCupon
                   AND  u.Estado = 'Reservado'
                   AND  s.Estado = 'Activa'
                   AND  s.FechaExpiracion > SYSUTCDATETIME()) AS reservados
    OUTER APPLY (SELECT COUNT(*) AS Usos
                 FROM   dbo.UsoCupon AS u
                 WHERE  u.IDCupon = @IDCupon AND u.IDUsuario = @IDUsuario AND u.Estado = 'Confirmado') AS confirmados
    CROSS APPLY (SELECT c.MontoMinimoCompra - COALESCE(t.Subtotal, 0) AS Faltante) AS m
    CROSS APPLY (SELECT CASE
                     WHEN c.IDCupon IS NULL                                     THEN 50501
                     WHEN c.Activo = 0                                          THEN 50502
                     WHEN SYSUTCDATETIME() < c.FechaInicio                      THEN 50503
                     WHEN SYSUTCDATETIME() >= c.FechaFin                        THEN 50504
                     WHEN c.UsosComprometidos - reservados.DeEsteCarrito >= c.LimiteUsosTotal
                                                                                THEN 50505
                     WHEN @IDUsuario IS NOT NULL
                          AND confirmados.Usos + reservados.DelCliente >= c.LimiteUsosPorCliente
                                                                                THEN 50506
                     WHEN m.Faltante > 0                                        THEN 50507
                     WHEN c.IDCategoria IS NOT NULL AND t.LineasCategoria = 0   THEN 50508
                 END AS NumeroError) AS n;
GO
