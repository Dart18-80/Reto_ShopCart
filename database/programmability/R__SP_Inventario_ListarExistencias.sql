-- RF-03: existencias por variante (Operador): física, reservada vigente y disponible
-- (FU_Inventario_Disponible), paginadas (M6-H01: @Orden sku | producto | disponible y @Direccion; por
-- defecto, lo menos disponible primero); con @IDVariante, solo esa variante.
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_ListarExistencias
    @IDVariante     INT,
    @Pagina         INT,
    @Tamano         INT,
    @Orden          VARCHAR(20)      = 'disponible',
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
       OR @Orden NOT IN ('sku', 'producto', 'disponible') OR @Direccion NOT IN ('asc', 'desc')
        THROW 50003, N'El ordenamiento no es válido.', 1;

    -- sqlserver-sp §5: dos conjuntos, la página y el total del filtro. El total sale de su propia consulta,
    -- así es real aunque la página pedida esté vacía.
    SELECT v.IDVariante, v.SKU, p.IDProducto, p.Nombre AS Producto, v.DescripcionAtributos, v.Activo,
           d.ExistenciaFisica, d.Reservado, d.Disponible
    FROM   dbo.Variante AS v
    JOIN   dbo.Producto AS p ON p.IDProducto = v.IDProducto
    CROSS APPLY dbo.FU_Inventario_Disponible(v.IDVariante) AS d
    WHERE  @IDVariante IS NULL OR v.IDVariante = @IDVariante
    ORDER BY
        CASE WHEN @Orden = 'sku' AND @Direccion = 'asc'  THEN v.SKU END ASC,
        CASE WHEN @Orden = 'sku' AND @Direccion = 'desc' THEN v.SKU END DESC,
        CASE WHEN @Orden = 'producto' AND @Direccion = 'asc'  THEN p.Nombre END ASC,
        CASE WHEN @Orden = 'producto' AND @Direccion = 'desc' THEN p.Nombre END DESC,
        CASE WHEN @Orden = 'disponible' AND @Direccion = 'asc'  THEN d.Disponible END ASC,
        CASE WHEN @Orden = 'disponible' AND @Direccion = 'desc' THEN d.Disponible END DESC,
        -- Desempate estable por la PK: dos páginas nunca repiten ni saltan filas.
        CASE WHEN @Direccion = 'asc'  THEN v.IDVariante END ASC,
        CASE WHEN @Direccion = 'desc' THEN v.IDVariante END DESC
    OFFSET (@Pagina - 1) * @Tamano ROWS FETCH NEXT @Tamano ROWS ONLY
    OPTION (RECOMPILE);

    SELECT COUNT(*) AS Total FROM dbo.Variante AS v WHERE @IDVariante IS NULL OR v.IDVariante = @IDVariante
    OPTION (RECOMPILE);
END
GO
