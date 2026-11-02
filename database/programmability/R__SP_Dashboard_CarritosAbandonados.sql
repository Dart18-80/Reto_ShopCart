-- N-13: los carritos abandonados cuya última actividad cae en el periodo (días de Guatemala), del mayor monto
-- potencial perdido al menor, paginados. Dos conjuntos (sqlserver-sp §5): la página y el total.
CREATE OR ALTER PROCEDURE dbo.SP_Dashboard_CarritosAbandonados
    @Desde          DATE             = NULL,
    @Hasta          DATE             = NULL,
    @Pagina         INT              = 1,
    @Tamano         INT              = 20,
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

    IF @Pagina < 1 OR @Tamano NOT BETWEEN 1 AND 100
        THROW 50003, N'Los parámetros de paginación no son válidos.', 1;

    SELECT a.IDCarrito, a.IDUsuario AS IDCliente, u.Nombre AS NombreCliente, a.FechaUltimaActividad, a.Lineas,
           a.Unidades, a.MontoPotencial
    FROM   dbo.VW_Carrito_Abandonados AS a
    LEFT JOIN dbo.Usuario AS u ON u.IDUsuario = a.IDUsuario
    WHERE  a.FechaLocalUltimaActividad BETWEEN @Desde AND @Hasta
    ORDER BY a.MontoPotencial DESC, a.IDCarrito
    OFFSET (@Pagina - 1) * @Tamano ROWS
    FETCH NEXT @Tamano ROWS ONLY;

    SELECT COUNT(*) AS Total FROM dbo.VW_Carrito_Abandonados AS a
    WHERE  a.FechaLocalUltimaActividad BETWEEN @Desde AND @Hasta;
END
GO
