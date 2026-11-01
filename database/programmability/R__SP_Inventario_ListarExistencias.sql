-- RF-03: existencias por variante (Operador): física, reservada vigente y disponible
-- (FU_Inventario_Disponible), paginadas por producto y SKU; con @IDVariante, solo esa variante.
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_ListarExistencias
    @IDVariante     INT,
    @Pagina         INT,
    @Tamano         INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina < 1 OR @Tamano NOT BETWEEN 1 AND 100
        THROW 50003, N'Los parámetros de paginación no son válidos.', 1;

    SELECT v.IDVariante, v.SKU, p.IDProducto, p.Nombre AS Producto, v.DescripcionAtributos, v.Activo,
           d.ExistenciaFisica, d.Reservado, d.Disponible, COUNT(*) OVER () AS TotalFilas
    FROM   dbo.Variante AS v
    JOIN   dbo.Producto AS p ON p.IDProducto = v.IDProducto
    CROSS APPLY dbo.FU_Inventario_Disponible(v.IDVariante) AS d
    WHERE  @IDVariante IS NULL OR v.IDVariante = @IDVariante
    ORDER BY p.Nombre, v.SKU, v.IDVariante
    OFFSET (@Pagina - 1) * @Tamano ROWS FETCH NEXT @Tamano ROWS ONLY
    OPTION (RECOMPILE);
END
GO
