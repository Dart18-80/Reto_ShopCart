-- RF-04, N-05: el carrito Activo de quien pregunta. Con sesión de Cliente, el suyo (@IDUsuarioActor) y la
-- cookie se ignora; sin sesión, el del invitado (@HashTokenInvitado). Sin carrito, ningún conjunto (la API
-- responde un carrito vacío). Dos conjuntos: las líneas (FU_Carrito_Lineas) y el resumen. Nunca devuelve
-- el ID del carrito.
-- 01 §6.5, N-02: antes de leer, las líneas con la garantía vencida se re-anclan a la versión de precio
-- vigente; si el precio subió respecto del último que vio el cliente, queda la alerta "cambió de Q… a Q…"
-- (PrecioAnteriorAviso) hasta que la marque como vista. La garantía no se renueva.
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_Obtener
    @HashTokenInvitado BINARY(32)       = NULL,
    @IDUsuarioActor    INT              = NULL,
    @RolActor          VARCHAR(20)      = NULL,
    @RequestId         UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @IDCliente      INT        = CASE WHEN @RolActor = 'Cliente' THEN @IDUsuarioActor END;
    DECLARE @HashDelCarrito BINARY(32) = CASE WHEN @IDCliente IS NULL THEN @HashTokenInvitado END;
    DECLARE @IDCarrito INT;

    SELECT @IDCarrito = c.IDCarrito
    FROM   dbo.Carrito AS c
    WHERE  c.Estado = 'Activo'
      AND  (   (@IDCliente IS NOT NULL AND c.IDUsuario = @IDCliente AND c.IDUsuario IS NOT NULL)
            OR (@IDCliente IS NULL AND c.HashTokenInvitado = @HashDelCarrito
                AND c.HashTokenInvitado IS NOT NULL));

    IF @IDCarrito IS NULL
        RETURN;

    -- Sin bloqueos en la consulta normal: solo se escribe si alguna garantía vencida quedó sin re-anclar.
    IF EXISTS (SELECT 1
               FROM   dbo.LineaCarrito AS l
               CROSS APPLY dbo.FU_Catalogo_PrecioVigente(l.IDVariante) AS pv
               WHERE  l.IDCarrito = @IDCarrito
                 AND  l.FechaGarantiaHasta <= SYSUTCDATETIME()
                 AND  l.IDPrecioVarianteGarantizado <> pv.IDPrecioVariante)
    BEGIN
        BEGIN TRY
            BEGIN TRAN;

            -- 01 §6.6: primero el carrito.
            EXEC dbo.SP_Carrito_BloquearActivo @IDCliente, @HashDelCarrito, @IDCarrito OUTPUT;

            UPDATE l
            SET    PrecioAnteriorAviso = CASE WHEN visto.Precio < pv.Precio THEN visto.Precio END,
                   IDPrecioVarianteGarantizado = pv.IDPrecioVariante,
                   FechaActualizacion = SYSUTCDATETIME()
            FROM   dbo.LineaCarrito AS l
            JOIN   dbo.PrecioVariante AS pg ON pg.IDPrecioVariante = l.IDPrecioVarianteGarantizado
            CROSS APPLY dbo.FU_Catalogo_PrecioVigente(l.IDVariante) AS pv
            -- El último precio que vio el cliente: el de una alerta que aún no vio o el anclado.
            CROSS APPLY (SELECT COALESCE(l.PrecioAnteriorAviso, pg.Precio) AS Precio) AS visto
            WHERE  l.IDCarrito = @IDCarrito
              AND  l.FechaGarantiaHasta <= SYSUTCDATETIME()
              AND  l.IDPrecioVarianteGarantizado <> pv.IDPrecioVariante;

            COMMIT;
        END TRY
        BEGIN CATCH
            IF @@TRANCOUNT > 0 ROLLBACK;
            THROW;
        END CATCH

        -- El carrito dejó de estar Activo mientras se esperaba el bloqueo (por ejemplo, se convirtió).
        IF @IDCarrito IS NULL
            RETURN;
    END

    SELECT l.IDLineaCarrito, l.IDVariante, l.IDProducto, l.Producto, l.SKU, l.DescripcionAtributos, l.Imagen,
           l.Cantidad, l.PrecioUnitario, l.TotalLinea, l.Estado, l.AjustarA, l.EstadoExistencia,
           l.UnidadesRestantes, l.FechaGarantiaHasta, l.Aviso, l.AvisoPrecioAnterior
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
