-- RF-08, N-11: los 10 productos más vendidos del periodo por unidades netas (desempate: ventas y ID), con el
-- nombre actual del producto.
CREATE OR ALTER PROCEDURE dbo.SP_Dashboard_TopProductos
    @Desde          DATE             = NULL,
    @Hasta          DATE             = NULL,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @RolActor IS NULL OR @RolActor <> 'Administrador'
        THROW 50005, N'Solo el Administrador consulta el dashboard.', 1;

    -- A-12: sin rango, los últimos 30 días de Guatemala (hoy incluido).
    SET @Hasta = COALESCE(@Hasta, (SELECT f.FechaLocal FROM dbo.FU_Sistema_FechaLocal(SYSUTCDATETIME()) AS f));
    SET @Desde = COALESCE(@Desde, DATEADD(DAY, -29, @Hasta));
    IF @Desde > @Hasta
        THROW 50003, N'La fecha inicial no puede ser posterior a la final.', 1;

    DECLARE @Top INT = 10;

    SELECT TOP (@Top) pr.IDProducto, pr.Nombre AS Producto, SUM(h.Unidades) AS Unidades,
           CONVERT(DECIMAL(15,2), SUM(h.Monto)) AS Ventas
    FROM   dbo.VW_Dashboard_HechosVenta AS h
    JOIN   dbo.Variante AS v  ON v.IDVariante = h.IDVariante
    JOIN   dbo.Producto AS pr ON pr.IDProducto = v.IDProducto
    WHERE  h.Fecha BETWEEN @Desde AND @Hasta
    GROUP BY pr.IDProducto, pr.Nombre
    ORDER BY Unidades DESC, Ventas DESC, pr.IDProducto;
END
GO
