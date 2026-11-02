-- N-13: carritos Activo con productos y sin cambios en HorasCarritoAbandonado (ParametroSistema), de invitado o
-- de cliente, con su monto potencial perdido a precio vigente. La actividad es FechaUltimaActividad, que solo
-- cambia cuando el carrito cambia. IX_Carrito_Abandono (Estado, FechaUltimaActividad).
CREATE OR ALTER VIEW dbo.VW_Carrito_Abandonados
AS
SELECT  c.IDCarrito,
        c.IDUsuario,
        c.FechaUltimaActividad,
        f.FechaLocal                              AS FechaLocalUltimaActividad,
        COUNT(*)                                  AS Lineas,
        SUM(l.Cantidad)                           AS Unidades,
        CONVERT(DECIMAL(15,2), SUM(l.Cantidad * pv.Precio)) AS MontoPotencial
FROM    dbo.Carrito AS c
JOIN    dbo.LineaCarrito AS l ON l.IDCarrito = c.IDCarrito
CROSS APPLY dbo.FU_Catalogo_PrecioVigente(l.IDVariante) AS pv
CROSS APPLY dbo.FU_Sistema_FechaLocal(c.FechaUltimaActividad) AS f
WHERE   c.Estado = 'Activo'
  AND   c.FechaUltimaActividad < DATEADD(HOUR, -(SELECT TOP (1) ps.HorasCarritoAbandonado
                                                FROM dbo.ParametroSistema AS ps
                                                ORDER BY ps.IDParametroSistema), SYSUTCDATETIME())
GROUP BY c.IDCarrito, c.IDUsuario, c.FechaUltimaActividad, f.FechaLocal;
GO
