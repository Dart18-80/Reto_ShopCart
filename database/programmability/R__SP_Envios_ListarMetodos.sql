-- N-04: los métodos de envío activos con su costo para el carrito de quien pide (resuelto como en
-- SP_Carrito_Obtener; sin carrito, el monto es 0). El envío gratis se evalúa sobre el subtotal comprable
-- después del cupón (N-12); un cupón que ya no es válido no cuenta (al consultar el carrito se quita). Dos
-- conjuntos: los métodos y el envío gratis (mínimo, cuánto falta y si se alcanzó). No escribe.
CREATE OR ALTER PROCEDURE dbo.SP_Envios_ListarMetodos
    @HashTokenInvitado BINARY(32)       = NULL,
    @IDUsuarioActor    INT              = NULL,
    @RolActor          VARCHAR(20)      = NULL,
    @RequestId         UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IDCliente      INT        = CASE WHEN @RolActor = 'Cliente' THEN @IDUsuarioActor END;
    DECLARE @HashDelCarrito BINARY(32) = CASE WHEN @IDCliente IS NULL THEN @HashTokenInvitado END;
    DECLARE @IDCarrito INT, @IDCupon INT, @Monto DECIMAL(15,2);

    SELECT @IDCarrito = a.IDCarrito, @IDCupon = a.IDCupon
    FROM   dbo.FU_Carrito_Activo(@IDCliente, @HashDelCarrito) AS a;

    IF EXISTS (SELECT 1 FROM dbo.FU_Cupones_Validar(@IDCupon, @IDCliente, @IDCarrito) AS v
               WHERE v.NumeroError IS NOT NULL)
        SET @IDCupon = NULL;

    SELECT @Monto = CONVERT(DECIMAL(15,2), COALESCE(SUM(l.TotalComprable - COALESCE(dc.DescuentoLinea, 0)), 0))
    FROM   dbo.FU_Carrito_Lineas(@IDCarrito) AS l
    LEFT JOIN dbo.FU_Cupones_CalculoDescuento(@IDCupon, @IDCarrito) AS dc
           ON dc.IDLineaCarrito = l.IDLineaCarrito;

    SELECT c.IDMetodoEnvio, c.Codigo, c.Nombre, c.DiasMin, c.DiasMax, c.Tarifa, c.Costo, c.EnvioGratis
    FROM   dbo.FU_Envios_Costos(@Monto) AS c
    ORDER BY c.Tarifa, c.IDMetodoEnvio;

    SELECT g.MontoMinimo, g.Faltante, g.Alcanzado
    FROM   dbo.FU_Envios_EnvioGratis(@Monto) AS g;
END
GO
