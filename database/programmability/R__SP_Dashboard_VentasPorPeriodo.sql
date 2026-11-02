-- RF-08, N-11: ventas netas (en quetzales) y número de pedidos por día, semana (que empieza el lunes) o mes de
-- Guatemala, sobre la definición única de venta. @Agrupacion sale de una lista blanca (sin SQL dinámico).
CREATE OR ALTER PROCEDURE dbo.SP_Dashboard_VentasPorPeriodo
    @Desde          DATE             = NULL,
    @Hasta          DATE             = NULL,
    @Agrupacion     VARCHAR(6),
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

    IF @Agrupacion IS NULL OR @Agrupacion NOT IN ('dia', 'semana', 'mes')
        THROW 50003, N'La agrupación debe ser dia, semana o mes.', 1;

    -- 1900-01-01 fue lunes: la semana empieza el lunes sin depender de @@DATEFIRST.
    SELECT p.Periodo,
           CONVERT(DECIMAL(15,2), SUM(p.Monto))                              AS Ventas,
           COUNT(DISTINCT CASE WHEN p.Tipo = 'Venta' THEN p.IDPedido END)    AS Pedidos
    FROM  (SELECT CASE @Agrupacion
                      WHEN 'dia'    THEN h.Fecha
                      WHEN 'semana' THEN DATEADD(DAY, -(DATEDIFF(DAY, '19000101', h.Fecha) % 7), h.Fecha)
                      ELSE DATEFROMPARTS(YEAR(h.Fecha), MONTH(h.Fecha), 1)
                  END AS Periodo, h.Tipo, h.IDPedido, h.Monto
           FROM   dbo.VW_Dashboard_HechosVenta AS h
           WHERE  h.Fecha BETWEEN @Desde AND @Hasta) AS p
    GROUP BY p.Periodo
    ORDER BY p.Periodo;
END
GO
