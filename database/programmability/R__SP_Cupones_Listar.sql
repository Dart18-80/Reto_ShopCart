-- RF-05: los cupones para el Admin (M6-H01: @Orden codigo | vigencia | usos y @Direccion; por defecto, los
-- que empiezan más tarde primero; vigencia es FechaInicio), opcionalmente solo activos o inactivos.
-- Dos conjuntos (sqlserver-sp §5): la página y el total del filtro.
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_Listar
    @Activo         BIT              = NULL,
    @Pagina         INT              = 1,
    @Tamano         INT              = 20,
    @Orden          VARCHAR(20)      = 'vigencia',
    @Direccion      VARCHAR(4)       = 'desc',
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina < 1 OR @Tamano NOT BETWEEN 1 AND 100
        THROW 50003, N'Los parámetros de paginación no son válidos.', 1;
    -- M6-H01 (A-10): el orden sale de una lista blanca; la API la valida con Zod y el SP la revalida (un NULL
    -- explícito no es «sin orden»).
    IF @Orden IS NULL OR @Direccion IS NULL
       OR @Orden NOT IN ('codigo', 'vigencia', 'usos') OR @Direccion NOT IN ('asc', 'desc')
        THROW 50003, N'El ordenamiento no es válido.', 1;

    SELECT c.IDCupon, c.Codigo, c.Descripcion, c.Tipo, c.Valor, c.MontoMaximoDescuento, c.MontoMinimoCompra,
           c.IDCategoria, c.Categoria, c.FechaInicio, c.FechaFin, c.LimiteUsosTotal, c.LimiteUsosPorCliente,
           c.UsosComprometidos, c.Usado, c.Activo
    FROM   dbo.VW_Cupones_Admin AS c
    WHERE  @Activo IS NULL OR c.Activo = @Activo
    ORDER BY
        CASE WHEN @Orden = 'codigo' AND @Direccion = 'asc'  THEN c.Codigo END ASC,
        CASE WHEN @Orden = 'codigo' AND @Direccion = 'desc' THEN c.Codigo END DESC,
        CASE WHEN @Orden = 'vigencia' AND @Direccion = 'asc'  THEN c.FechaInicio END ASC,
        CASE WHEN @Orden = 'vigencia' AND @Direccion = 'desc' THEN c.FechaInicio END DESC,
        CASE WHEN @Orden = 'usos' AND @Direccion = 'asc'  THEN c.UsosComprometidos END ASC,
        CASE WHEN @Orden = 'usos' AND @Direccion = 'desc' THEN c.UsosComprometidos END DESC,
        -- Desempate estable por la PK: dos páginas nunca repiten ni saltan filas.
        CASE WHEN @Direccion = 'asc'  THEN c.IDCupon END ASC,
        CASE WHEN @Direccion = 'desc' THEN c.IDCupon END DESC
    OFFSET (@Pagina - 1) * @Tamano ROWS
    FETCH NEXT @Tamano ROWS ONLY
    -- Con el orden como parámetro, cada combinación usa su propio plan (los CASE se resuelven al compilar).
    OPTION (RECOMPILE);

    SELECT COUNT(*) AS Total
    FROM   dbo.Cupon AS c
    WHERE  @Activo IS NULL OR c.Activo = @Activo;
END
GO
