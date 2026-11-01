-- E3-H03: listado paginado de productos para el Admin, activos o no, con filtros opcionales de categoría,
-- estado y texto (sin mayúsculas ni tildes, A-10). El texto del usuario se busca literal: sus comodines de
-- LIKE (%, _ y [) se escapan y el patrón se aplica con ESCAPE, como parámetro, nunca como SQL.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ListarProductosAdmin
    @Pagina         INT,
    @Tamano         INT,
    @IDCategoria    INT,
    @Activo         BIT,
    @Texto          NVARCHAR(150),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina < 1 OR @Tamano NOT BETWEEN 1 AND 100
        THROW 50003, N'Los parámetros de paginación no son válidos.', 1;

    DECLARE @Patron NVARCHAR(400) =
        N'%' + REPLACE(REPLACE(REPLACE(REPLACE(@Texto, N'\', N'\\'), N'%', N'\%'), N'_', N'\_'), N'[', N'\[') + N'%';

    SELECT p.IDProducto, p.Nombre, p.IDCategoria, c.Nombre AS Categoria, p.Activo,
           (SELECT COUNT(*) FROM dbo.Variante AS v WHERE v.IDProducto = p.IDProducto) AS Variantes,
           (SELECT COUNT(*) FROM dbo.Variante AS v
            WHERE v.IDProducto = p.IDProducto AND v.Activo = 1)                  AS VariantesActivas,
           COUNT(*) OVER () AS TotalFilas
    FROM   dbo.Producto  AS p
    JOIN   dbo.Categoria AS c ON c.IDCategoria = p.IDCategoria
    WHERE  (@IDCategoria IS NULL OR p.IDCategoria = @IDCategoria)
      AND  (@Activo IS NULL OR p.Activo = @Activo)
      AND  (@Texto IS NULL OR p.NombreBusqueda LIKE @Patron ESCAPE N'\')
    ORDER BY p.Nombre, p.IDProducto
    OFFSET (@Pagina - 1) * @Tamano ROWS FETCH NEXT @Tamano ROWS ONLY
    -- Filtros opcionales: cada combinación merece su propio plan.
    OPTION (RECOMPILE);
END
GO
