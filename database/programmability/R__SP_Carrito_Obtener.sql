-- RF-04, N-05: el carrito Activo de quien pregunta. Con sesión de Cliente, el suyo (@IDUsuarioActor) y la
-- cookie se ignora; sin sesión, el del invitado (@HashTokenInvitado). Sin carrito, ningún conjunto (la API
-- responde un carrito vacío). Dos conjuntos: las líneas (FU_Carrito_Lineas) y el resumen. Nunca devuelve
-- el ID del carrito.
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_Obtener
    @HashTokenInvitado BINARY(32)       = NULL,
    @IDUsuarioActor    INT              = NULL,
    @RolActor          VARCHAR(20)      = NULL,
    @RequestId         UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IDCliente INT = CASE WHEN @RolActor = 'Cliente' THEN @IDUsuarioActor END;

    DECLARE @IDCarrito INT =
    (
        SELECT c.IDCarrito
        FROM   dbo.Carrito AS c
        WHERE  c.Estado = 'Activo'
          AND  (   (@IDCliente IS NOT NULL AND c.IDUsuario = @IDCliente AND c.IDUsuario IS NOT NULL)
                OR (@IDCliente IS NULL AND c.HashTokenInvitado = @HashTokenInvitado
                    AND c.HashTokenInvitado IS NOT NULL))
    );

    IF @IDCarrito IS NULL
        RETURN;

    SELECT l.IDLineaCarrito, l.IDVariante, l.IDProducto, l.Producto, l.SKU, l.DescripcionAtributos, l.Imagen,
           l.Cantidad, l.PrecioUnitario, l.TotalLinea, l.Estado, l.AjustarA, l.EstadoExistencia,
           l.UnidadesRestantes
    FROM   dbo.FU_Carrito_Lineas(@IDCarrito) AS l
    ORDER BY l.FechaAgregado, l.IDLineaCarrito;

    -- El descuento es 0 hasta que el carrito tenga cupón (E4-H05).
    SELECT COUNT(*)                                                       AS Lineas,
           COALESCE(SUM(CONVERT(BIGINT, l.Cantidad)), 0)                  AS Unidades,
           CONVERT(DECIMAL(15,2), COALESCE(SUM(l.TotalLinea), 0))         AS Subtotal,
           CONVERT(DECIMAL(15,2), 0)                                      AS Descuento,
           CONVERT(DECIMAL(15,2), COALESCE(SUM(l.TotalLinea), 0))         AS Total,
           -- N-06: el checkout exige al menos una línea y que todas estén Disponible.
           CONVERT(BIT, CASE WHEN COUNT(*) > 0 AND COUNT(*) = COUNT(CASE WHEN l.Estado = 'Disponible' THEN 1 END)
                             THEN 1 ELSE 0 END)                           AS PuedePagar
    FROM   dbo.FU_Carrito_Lineas(@IDCarrito) AS l;
END
GO
