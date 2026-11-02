-- RF-05, N-12: los cupones como los ve el Admin, con su categoría y si ya se usaron. "Usado" = tiene al
-- menos un uso registrado (reservado, confirmado, liberado o revertido): desde ahí su tipo y su valor no
-- cambian. La lectura usa IX_UsoCupon_PorCliente (IDCupon primero).
CREATE OR ALTER VIEW dbo.VW_Cupones_Admin
AS
SELECT c.IDCupon,
       c.Codigo,
       c.Descripcion,
       c.Tipo,
       c.Valor,
       c.MontoMaximoDescuento,
       c.MontoMinimoCompra,
       c.IDCategoria,
       cat.Nombre AS Categoria,
       c.FechaInicio,
       c.FechaFin,
       c.LimiteUsosTotal,
       c.LimiteUsosPorCliente,
       c.UsosComprometidos,
       CONVERT(BIT, CASE WHEN EXISTS (SELECT 1 FROM dbo.UsoCupon AS u WHERE u.IDCupon = c.IDCupon)
                         THEN 1 ELSE 0 END) AS Usado,
       c.Activo,
       c.FechaCreacion
FROM   dbo.Cupon AS c
LEFT JOIN dbo.Categoria AS cat ON cat.IDCategoria = c.IDCategoria;
GO
