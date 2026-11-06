-- N-13: los carritos abandonados cuya última actividad cae en el periodo (días de Guatemala), paginados. Por
-- defecto, del mayor monto potencial perdido al menor (lo supone la exportación). M6-H01: @Orden inactividad |
-- total y @Direccion; más inactividad es una última actividad más antigua. Dos conjuntos (sqlserver-sp §5): la página y el total.
CREATE OR ALTER PROCEDURE dbo.SP_Dashboard_CarritosAbandonados
    @Desde          DATE             = NULL,
    @Hasta          DATE             = NULL,
    @Pagina         INT              = 1,
    @Tamano         INT              = 20,
    @Orden          VARCHAR(20)      = 'total',
    @Direccion      VARCHAR(4)       = 'desc',
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
    -- M6-H01 (A-10): el orden sale de una lista blanca; la API la valida con Zod y el SP la revalida (un NULL
    -- explícito no es «sin orden»).
    IF @Orden IS NULL OR @Direccion IS NULL
       OR @Orden NOT IN ('inactividad', 'total') OR @Direccion NOT IN ('asc', 'desc')
        THROW 50003, N'El ordenamiento no es válido.', 1;

    SELECT a.IDCarrito, a.IDUsuario AS IDCliente, u.Nombre AS NombreCliente, a.FechaUltimaActividad, a.Lineas,
           a.Unidades, a.MontoPotencial
    FROM   dbo.VW_Carrito_Abandonados AS a
    LEFT JOIN dbo.Usuario AS u ON u.IDUsuario = a.IDUsuario
    WHERE  a.FechaLocalUltimaActividad BETWEEN @Desde AND @Hasta
    ORDER BY
        CASE WHEN @Orden = 'inactividad' AND @Direccion = 'asc'  THEN a.FechaUltimaActividad END DESC,
        CASE WHEN @Orden = 'inactividad' AND @Direccion = 'desc' THEN a.FechaUltimaActividad END ASC,
        CASE WHEN @Orden = 'total' AND @Direccion = 'asc'  THEN a.MontoPotencial END ASC,
        CASE WHEN @Orden = 'total' AND @Direccion = 'desc' THEN a.MontoPotencial END DESC,
        -- Desempate estable por la PK (dos páginas nunca repiten ni saltan filas), siempre ascendente como antes de
        -- M6-H01: la exportación conserva el mismo orden entre carritos del mismo monto.
        a.IDCarrito
    OFFSET (@Pagina - 1) * @Tamano ROWS
    FETCH NEXT @Tamano ROWS ONLY
    -- Con el orden como parámetro, cada combinación usa su propio plan (los CASE se resuelven al compilar).
    OPTION (RECOMPILE);

    SELECT COUNT(*) AS Total FROM dbo.VW_Carrito_Abandonados AS a
    WHERE  a.FechaLocalUltimaActividad BETWEEN @Desde AND @Hasta;
END
GO
