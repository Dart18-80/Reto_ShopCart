-- RF-07: la gestión de pedidos para el Operador y el Admin (por defecto, los más recientes primero; M6-H01:
-- @Orden fecha | total | numero | estado y @Direccion), con filtros opcionales
-- por estado, cliente y rango de fechas. Las fechas son días de Guatemala sobre FechaPagoLocal (A-12), igual
-- que los reportes (N-11). Dos conjuntos (sqlserver-sp §5): la página y el total del filtro.
-- Cada filtro tiene su índice: IX_Pedido_Gestion (estado), IX_Pedido_Cliente (cliente), IX_Pedido_Reportes
-- (FechaPagoLocal) e IX_Pedido_FechaPago (sin filtros). OPTION (RECOMPILE): con filtros opcionales, cada
-- combinación usa el plan de su índice en lugar de uno genérico (la consulta es barata de compilar).
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_Listar
    @Estado         VARCHAR(20)      = NULL,
    @IDClienteFiltro INT             = NULL,
    @Desde          DATE             = NULL,
    @Hasta          DATE             = NULL,
    @Pagina         INT              = 1,
    @Tamano         INT              = 20,
    @Orden          VARCHAR(20)      = 'fecha',
    @Direccion      VARCHAR(4)       = 'desc',
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @RolActor IS NULL OR @RolActor NOT IN ('Operador', 'Administrador')
        THROW 50005, N'Solo el Operador y el Administrador gestionan pedidos.', 1;
    IF @Pagina < 1 OR @Tamano NOT BETWEEN 1 AND 100
        THROW 50003, N'Los parámetros de paginación no son válidos.', 1;
    -- M6-H01 (A-10): el orden sale de una lista blanca; la API la valida con Zod y el SP la revalida (un NULL
    -- explícito no es «sin orden»).
    IF @Orden IS NULL OR @Direccion IS NULL
       OR @Orden NOT IN ('fecha', 'total', 'numero', 'estado') OR @Direccion NOT IN ('asc', 'desc')
        THROW 50003, N'El ordenamiento no es válido.', 1;
    IF @Desde > @Hasta
        THROW 50003, N'La fecha inicial no puede ser posterior a la final.', 1;

    DECLARE @IDEstado INT = (SELECT e.IDEstadoPedido FROM dbo.EstadoPedido AS e WHERE e.Codigo = @Estado);
    IF @Estado IS NOT NULL AND @IDEstado IS NULL
        THROW 50003, N'El estado no es válido.', 1;

    SELECT p.IDPedido, p.NumeroPedido, e.Codigo AS Estado, p.Total, p.FechaPago, p.FechaPagoLocal,
           (SELECT SUM(d.Cantidad) FROM dbo.DetallePedido AS d WHERE d.IDPedido = p.IDPedido) AS Articulos,
           u.IDUsuario AS IDCliente, u.Nombre AS NombreCliente, u.Correo AS CorreoCliente,
           IIF(EXISTS (SELECT 1 FROM dbo.IntentoPago AS i WHERE i.IDIntentoPago = p.IDIntentoPago AND i.Estado = 'EnRevision'),
               'EnVerificacion', 'Confirmado') AS EstadoPago
    FROM   dbo.Pedido AS p
    JOIN   dbo.EstadoPedido AS e ON e.IDEstadoPedido = p.IDEstadoPedido
    JOIN   dbo.Usuario AS u ON u.IDUsuario = p.IDUsuario
    WHERE  (@IDEstado IS NULL OR p.IDEstadoPedido = @IDEstado)
      AND  (@IDClienteFiltro IS NULL OR p.IDUsuario = @IDClienteFiltro)
      AND  (@Desde IS NULL OR p.FechaPagoLocal >= @Desde)
      AND  (@Hasta IS NULL OR p.FechaPagoLocal <= @Hasta)
    ORDER BY
        CASE WHEN @Orden = 'fecha' AND @Direccion = 'asc'  THEN p.FechaPago END ASC,
        CASE WHEN @Orden = 'fecha' AND @Direccion = 'desc' THEN p.FechaPago END DESC,
        CASE WHEN @Orden = 'total' AND @Direccion = 'asc'  THEN p.Total END ASC,
        CASE WHEN @Orden = 'total' AND @Direccion = 'desc' THEN p.Total END DESC,
        CASE WHEN @Orden = 'estado' AND @Direccion = 'asc'  THEN e.Orden END ASC,
        CASE WHEN @Orden = 'estado' AND @Direccion = 'desc' THEN e.Orden END DESC,
        -- numero es el IDPedido (NumeroPedido = 'SC-' + IDPedido): lo resuelve el desempate.
        -- Desempate estable por la PK: dos páginas nunca repiten ni saltan filas.
        CASE WHEN @Direccion = 'asc'  THEN p.IDPedido END ASC,
        CASE WHEN @Direccion = 'desc' THEN p.IDPedido END DESC
    OFFSET (@Pagina - 1) * @Tamano ROWS
    FETCH NEXT @Tamano ROWS ONLY
    OPTION (RECOMPILE);

    SELECT COUNT(*) AS Total
    FROM   dbo.Pedido AS p
    WHERE  (@IDEstado IS NULL OR p.IDEstadoPedido = @IDEstado)
      AND  (@IDClienteFiltro IS NULL OR p.IDUsuario = @IDClienteFiltro)
      AND  (@Desde IS NULL OR p.FechaPagoLocal >= @Desde)
      AND  (@Hasta IS NULL OR p.FechaPagoLocal <= @Hasta)
    OPTION (RECOMPILE);
END
GO
