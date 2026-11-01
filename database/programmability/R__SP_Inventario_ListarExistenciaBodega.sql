-- N-07 (Could de E3-H06): para el conteo físico, la existencia de cada variante más las unidades de pedidos
-- pagados aún no despachados (VW_Inventario_ExistenciaBodega), paginada; con @IDVariante, solo esa.
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_ListarExistenciaBodega
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

    -- sqlserver-sp §5: dos conjuntos, la página y el total del filtro. El total sale de su propia consulta,
    -- así es real aunque la página pedida esté vacía.
    SELECT b.IDVariante, b.SKU, b.ExistenciaFisica, b.UnidadesPorDespachar, b.ExistenciaBodega
    FROM   dbo.VW_Inventario_ExistenciaBodega AS b
    WHERE  @IDVariante IS NULL OR b.IDVariante = @IDVariante
    ORDER BY b.SKU, b.IDVariante
    OFFSET (@Pagina - 1) * @Tamano ROWS FETCH NEXT @Tamano ROWS ONLY
    OPTION (RECOMPILE);

    SELECT COUNT(*) AS Total FROM dbo.Variante AS v WHERE @IDVariante IS NULL OR v.IDVariante = @IDVariante
    OPTION (RECOMPILE);
END
GO
