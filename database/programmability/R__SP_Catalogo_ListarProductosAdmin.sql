-- E3-H03: listado paginado de productos para el Admin, activos o no (M6-H01: @Orden nombre | categoria |
-- recientes y @Direccion; por defecto, por nombre), con filtros opcionales de categoría,
-- estado y texto (sin mayúsculas ni tildes, A-10). El texto del usuario se busca literal: sus comodines de
-- LIKE se escapan (FU_Catalogo_PatronBusqueda) y el patrón se aplica con ESCAPE, como parámetro.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ListarProductosAdmin
    @Pagina         INT,
    @Tamano         INT,
    @IDCategoria    INT,
    @Activo         BIT,
    @Texto          NVARCHAR(150),
    @Orden          VARCHAR(20)      = 'nombre',
    @Direccion      VARCHAR(4)       = 'asc',
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
       OR @Orden NOT IN ('nombre', 'categoria', 'recientes') OR @Direccion NOT IN ('asc', 'desc')
        THROW 50003, N'El ordenamiento no es válido.', 1;

    DECLARE @Patron NVARCHAR(400) = (SELECT f.Contiene FROM dbo.FU_Catalogo_PatronBusqueda(@Texto) AS f);

    -- sqlserver-sp §5: dos conjuntos, la página y el total del filtro. El total sale de su propia consulta,
    -- así es real aunque la página pedida esté vacía.
    SELECT p.IDProducto, p.Nombre, p.IDCategoria, c.Nombre AS Categoria, p.Activo,
           (SELECT COUNT(*) FROM dbo.Variante AS v WHERE v.IDProducto = p.IDProducto) AS Variantes,
           (SELECT COUNT(*) FROM dbo.Variante AS v
            WHERE v.IDProducto = p.IDProducto AND v.Activo = 1)                  AS VariantesActivas
    FROM   dbo.Producto  AS p
    JOIN   dbo.Categoria AS c ON c.IDCategoria = p.IDCategoria
    WHERE  (@IDCategoria IS NULL OR p.IDCategoria = @IDCategoria)
      AND  (@Activo IS NULL OR p.Activo = @Activo)
      AND  (@Texto IS NULL OR p.NombreBusqueda LIKE @Patron ESCAPE N'\')
    ORDER BY
        CASE WHEN @Orden = 'nombre' AND @Direccion = 'asc'  THEN p.Nombre END ASC,
        CASE WHEN @Orden = 'nombre' AND @Direccion = 'desc' THEN p.Nombre END DESC,
        CASE WHEN @Orden = 'categoria' AND @Direccion = 'asc'  THEN c.Nombre END ASC,
        CASE WHEN @Orden = 'categoria' AND @Direccion = 'desc' THEN c.Nombre END DESC,
        CASE WHEN @Orden = 'recientes' AND @Direccion = 'asc'  THEN p.FechaCreacion END ASC,
        CASE WHEN @Orden = 'recientes' AND @Direccion = 'desc' THEN p.FechaCreacion END DESC,
        -- Desempate estable por la PK: dos páginas nunca repiten ni saltan filas.
        CASE WHEN @Direccion = 'asc'  THEN p.IDProducto END ASC,
        CASE WHEN @Direccion = 'desc' THEN p.IDProducto END DESC
    OFFSET (@Pagina - 1) * @Tamano ROWS FETCH NEXT @Tamano ROWS ONLY
    -- Filtros opcionales: cada combinación merece su propio plan.
    OPTION (RECOMPILE);

    SELECT COUNT(*) AS Total
    FROM   dbo.Producto AS p
    WHERE  (@IDCategoria IS NULL OR p.IDCategoria = @IDCategoria)
      AND  (@Activo IS NULL OR p.Activo = @Activo)
      AND  (@Texto IS NULL OR p.NombreBusqueda LIKE @Patron ESCAPE N'\')
    OPTION (RECOMPILE);
END
GO
