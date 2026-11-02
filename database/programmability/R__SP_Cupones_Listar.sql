-- RF-05: los cupones para el Admin, los más recientes primero, opcionalmente solo activos o inactivos.
-- Dos conjuntos (sqlserver-sp §5): la página y el total del filtro.
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_Listar
    @Activo         BIT              = NULL,
    @Pagina         INT              = 1,
    @Tamano         INT              = 20,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina < 1 OR @Tamano NOT BETWEEN 1 AND 100
        THROW 50003, N'Los parámetros de paginación no son válidos.', 1;

    SELECT c.IDCupon, c.Codigo, c.Descripcion, c.Tipo, c.Valor, c.MontoMaximoDescuento, c.MontoMinimoCompra,
           c.IDCategoria, c.Categoria, c.FechaInicio, c.FechaFin, c.LimiteUsosTotal, c.LimiteUsosPorCliente,
           c.UsosComprometidos, c.Usado, c.Activo
    FROM   dbo.VW_Cupones_Admin AS c
    WHERE  @Activo IS NULL OR c.Activo = @Activo
    ORDER BY c.FechaCreacion DESC, c.IDCupon DESC
    OFFSET (@Pagina - 1) * @Tamano ROWS
    FETCH NEXT @Tamano ROWS ONLY;

    SELECT COUNT(*) AS Total
    FROM   dbo.Cupon AS c
    WHERE  @Activo IS NULL OR c.Activo = @Activo;
END
GO
