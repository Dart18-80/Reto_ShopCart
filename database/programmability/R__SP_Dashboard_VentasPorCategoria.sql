-- RF-08, N-11: ventas netas y unidades por categoría en el periodo (VW_Dashboard_VentasPorCategoria), de mayor a
-- menor monto.
CREATE OR ALTER PROCEDURE dbo.SP_Dashboard_VentasPorCategoria
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

    SELECT v.IDCategoria, v.Categoria, SUM(v.Unidades) AS Unidades,
           CONVERT(DECIMAL(15,2), SUM(v.Monto)) AS Ventas
    FROM   dbo.VW_Dashboard_VentasPorCategoria AS v
    WHERE  v.Fecha BETWEEN @Desde AND @Hasta
    GROUP BY v.IDCategoria, v.Categoria
    ORDER BY Ventas DESC, v.IDCategoria;
END
GO
