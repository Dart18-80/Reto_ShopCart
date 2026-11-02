-- RF-04, N-05: el carrito Activo de quien pregunta. Con sesión de Cliente, el suyo (@IDUsuarioActor) y la
-- cookie se ignora; sin sesión, el del invitado (@HashTokenInvitado). Sin carrito, ningún conjunto (la API
-- responde un carrito vacío). Dos conjuntos: las líneas (FU_Carrito_Lineas, con su descuento) y el resumen.
-- Nunca devuelve el ID del carrito.
-- 01 §6.5, N-02: antes de leer, las líneas con la garantía vencida se re-anclan a la versión de precio
-- vigente; si el precio subió respecto del último que vio el cliente, queda la alerta "cambió de Q… a Q…"
-- (PrecioAnteriorAviso) hasta que la marque como vista. La garantía no se renueva.
-- N-12: el cupón se revalida en cada consulta; si dejó de ser válido se quita y el resumen trae el motivo
-- (solo en esa respuesta). El descuento se reparte por línea con FU_Cupones_CalculoDescuento.
-- N-04: el resumen indica cuánto falta para el envío gratis, sobre el total después del cupón.
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
    DECLARE @IDCarrito INT, @IDCupon INT, @RetiradoNumero INT, @RetiradoMensaje NVARCHAR(200),
            @RetiradoCodigo VARCHAR(30);

    SELECT @IDCarrito = a.IDCarrito, @IDCupon = a.IDCupon
    FROM   dbo.FU_Carrito_Activo(@IDCliente, @HashDelCarrito) AS a;

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

    IF @IDCupon IS NOT NULL
        SELECT @RetiradoNumero = v.NumeroError, @RetiradoMensaje = v.Mensaje
        FROM   dbo.FU_Cupones_Validar(@IDCupon, @IDCliente, @IDCarrito) AS v;

    IF @RetiradoNumero IS NOT NULL
    BEGIN
        BEGIN TRY
            BEGIN TRAN;

            EXEC dbo.SP_Carrito_BloquearActivo @IDCliente, @HashDelCarrito, @IDCarrito OUTPUT;

            -- Solo si sigue siendo el mismo cupón: otra petición pudo cambiarlo mientras tanto.
            UPDATE dbo.Carrito SET IDCupon = NULL WHERE IDCarrito = @IDCarrito AND IDCupon = @IDCupon;

            COMMIT;
        END TRY
        BEGIN CATCH
            IF @@TRANCOUNT > 0 ROLLBACK;
            THROW;
        END CATCH

        IF @IDCarrito IS NULL
            RETURN;
        SELECT @RetiradoCodigo = cu.Codigo FROM dbo.Cupon AS cu WHERE cu.IDCupon = @IDCupon;
        SET @IDCupon = (SELECT c.IDCupon FROM dbo.Carrito AS c WHERE c.IDCarrito = @IDCarrito);
    END

    DECLARE @Lineas TABLE (
        IDLineaCarrito INT PRIMARY KEY, IDVariante INT, IDProducto INT, Producto NVARCHAR(150), SKU VARCHAR(50),
        DescripcionAtributos NVARCHAR(200), Imagen NVARCHAR(500), Cantidad INT, PrecioUnitario DECIMAL(12,2),
        TotalLinea DECIMAL(15,2), DescuentoLinea DECIMAL(15,2), Estado VARCHAR(20), AjustarA INT,
        EstadoExistencia VARCHAR(20), UnidadesRestantes INT, FechaGarantiaHasta DATETIME2(3), Aviso VARCHAR(20),
        AvisoPrecioAnterior DECIMAL(12,2), FechaAgregado DATETIME2(3));

    INSERT INTO @Lineas
    SELECT l.IDLineaCarrito, l.IDVariante, l.IDProducto, l.Producto, l.SKU, l.DescripcionAtributos, l.Imagen,
           l.Cantidad, l.PrecioUnitario, l.TotalLinea, COALESCE(dc.DescuentoLinea, 0), l.Estado, l.AjustarA,
           l.EstadoExistencia, l.UnidadesRestantes, l.FechaGarantiaHasta, l.Aviso, l.AvisoPrecioAnterior,
           l.FechaAgregado
    FROM   dbo.FU_Carrito_Lineas(@IDCarrito) AS l
    LEFT JOIN dbo.FU_Cupones_CalculoDescuento(@IDCupon, @IDCarrito) AS dc ON dc.IDLineaCarrito = l.IDLineaCarrito;

    SELECT l.IDLineaCarrito, l.IDVariante, l.IDProducto, l.Producto, l.SKU, l.DescripcionAtributos, l.Imagen,
           l.Cantidad, l.PrecioUnitario, l.TotalLinea, l.DescuentoLinea, l.Estado, l.AjustarA, l.EstadoExistencia,
           l.UnidadesRestantes, l.FechaGarantiaHasta, l.Aviso, l.AvisoPrecioAnterior
    FROM   @Lineas AS l
    ORDER BY l.FechaAgregado, l.IDLineaCarrito;

    DECLARE @Total DECIMAL(15,2) = (SELECT CONVERT(DECIMAL(15,2), COALESCE(SUM(l.TotalLinea - l.DescuentoLinea), 0))
                                    FROM @Lineas AS l);
    DECLARE @EnvioMinimo DECIMAL(12,2), @EnvioFaltante DECIMAL(15,2), @EnvioAlcanzado BIT;
    SELECT @EnvioMinimo = g.MontoMinimo, @EnvioFaltante = g.Faltante, @EnvioAlcanzado = g.Alcanzado
    FROM   dbo.FU_Envios_EnvioGratis(@Total) AS g;

    SELECT COUNT(*)                                                       AS Lineas,
           COALESCE(SUM(CONVERT(BIGINT, l.Cantidad)), 0)                  AS Unidades,
           CONVERT(DECIMAL(15,2), COALESCE(SUM(l.TotalLinea), 0))         AS Subtotal,
           CONVERT(DECIMAL(15,2), COALESCE(SUM(l.DescuentoLinea), 0))     AS Descuento,
           @Total                                                         AS Total,
           -- N-06: el checkout exige al menos una línea y que todas estén Disponible.
           CONVERT(BIT, CASE WHEN COUNT(*) > 0 AND COUNT(*) = COUNT(CASE WHEN l.Estado = 'Disponible' THEN 1 END)
                             THEN 1 ELSE 0 END)                           AS PuedePagar,
           (SELECT cu.Codigo FROM dbo.Cupon AS cu WHERE cu.IDCupon = @IDCupon)      AS CodigoCupon,
           (SELECT cu.Descripcion FROM dbo.Cupon AS cu WHERE cu.IDCupon = @IDCupon) AS DescripcionCupon,
           @RetiradoCodigo                                                AS CuponRetiradoCodigo,
           @RetiradoNumero                                                AS CuponRetiradoNumero,
           @RetiradoMensaje                                               AS CuponRetiradoMensaje,
           @EnvioMinimo                                                   AS EnvioGratisMinimo,
           @EnvioFaltante                                                 AS EnvioGratisFaltante,
           @EnvioAlcanzado                                                AS EnvioGratisAlcanzado
    FROM   @Lineas AS l;
END
GO
