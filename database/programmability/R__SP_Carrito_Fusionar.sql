-- N-05, N-02: al iniciar sesión, el carrito de invitado (@HashTokenInvitado) se fusiona con el carrito Activo
-- del cliente (@IDUsuarioActor), que se crea si no existe.
-- - Misma variante: se suman las cantidades con el disponible como tope (nunca por debajo de lo que el
--   cliente ya tenía) y se conserva la garantía vigente más favorable (la de menor precio garantizado).
-- - Variante nueva: la línea pasa con su cantidad, su precio garantizado y su alerta; si el carrito llegaría a
--   más de MaxLineasCarrito líneas, las más recientes del invitado no pasan.
-- - El carrito de invitado queda Fusionado y la sesión de checkout Activa del cliente se cancela.
-- Bloqueo (01 §6.6): los dos carritos en orden de IDCarrito y después las variantes en orden de IDVariante.
-- Devuelve un aviso por cada línea ajustada o que no pasó; sin carrito de invitado Activo, ninguna fila.
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_Fusionar
    @HashTokenInvitado BINARY(32),
    @IDUsuarioActor    INT              = NULL,
    @RolActor          VARCHAR(20)      = NULL,
    @RequestId         UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @IDCliente INT = CASE WHEN @RolActor = 'Cliente' THEN @IDUsuarioActor END;
    IF @IDCliente IS NULL
        THROW 50005, N'Solo un cliente puede fusionar un carrito de invitado.', 1;

    DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME();
    DECLARE @IDCarritoInvitado INT, @IDCarritoCliente INT, @MaxLineas SMALLINT, @ID INT, @Bloqueada INT;
    DECLARE @Plan TABLE (
        IDVariante              INT          NOT NULL PRIMARY KEY,
        IDLineaInvitado         INT          NOT NULL,
        IDLineaCliente          INT          NULL,
        CantidadSolicitada      INT          NOT NULL,
        CantidadFinal           INT          NULL,
        GarantiaInvitadoMejor   BIT          NOT NULL,
        Orden                   INT          NOT NULL);
    DECLARE @Avisos TABLE (IDVariante INT NOT NULL PRIMARY KEY, Tipo VARCHAR(20) NOT NULL,
                           CantidadSolicitada INT NOT NULL, CantidadFinal INT NOT NULL);

    BEGIN TRY
        BEGIN TRAN;

        SET @IDCarritoInvitado = (SELECT c.IDCarrito FROM dbo.Carrito AS c
                                  WHERE c.HashTokenInvitado = @HashTokenInvitado
                                    AND c.HashTokenInvitado IS NOT NULL AND c.Estado = 'Activo');
        SET @IDCarritoCliente  = (SELECT c.IDCarrito FROM dbo.Carrito AS c
                                  WHERE c.IDUsuario = @IDCliente AND c.IDUsuario IS NOT NULL
                                    AND c.Estado = 'Activo');

        -- 01 §6.6: los dos carritos en orden de IDCarrito. Uno nuevo del cliente tendrá un ID mayor.
        IF @IDCarritoCliente IS NOT NULL AND @IDCarritoCliente < @IDCarritoInvitado
        BEGIN
            EXEC dbo.SP_Carrito_BloquearActivo @IDCliente, NULL, @IDCarritoCliente OUTPUT;
            EXEC dbo.SP_Carrito_BloquearActivo NULL, @HashTokenInvitado, @IDCarritoInvitado OUTPUT;
        END
        ELSE
        BEGIN
            EXEC dbo.SP_Carrito_BloquearActivo NULL, @HashTokenInvitado, @IDCarritoInvitado OUTPUT;
            EXEC dbo.SP_Carrito_BloquearActivo @IDCliente, NULL, @IDCarritoCliente OUTPUT;
        END

        -- Sin carrito de invitado Activo (no existe, expiró o ya se fusionó en otra petición): nada que hacer.
        IF @IDCarritoInvitado IS NOT NULL
        BEGIN
            IF @IDCarritoCliente IS NULL
            BEGIN
                INSERT INTO dbo.Carrito (IDUsuario, Estado) VALUES (@IDCliente, 'Activo');
                SET @IDCarritoCliente = SCOPE_IDENTITY();
            END

            -- 01 §6.6: después de los carritos, las variantes del invitado en orden de IDVariante.
            SET @ID = (SELECT MIN(l.IDVariante) FROM dbo.LineaCarrito AS l WHERE l.IDCarrito = @IDCarritoInvitado);
            WHILE @ID IS NOT NULL
            BEGIN
                SELECT @Bloqueada = v.IDVariante FROM dbo.Variante AS v WITH (UPDLOCK, ROWLOCK) WHERE v.IDVariante = @ID;
                SET @ID = (SELECT MIN(l.IDVariante) FROM dbo.LineaCarrito AS l
                           WHERE l.IDCarrito = @IDCarritoInvitado AND l.IDVariante > @ID);
            END

            INSERT INTO @Plan (IDVariante, IDLineaInvitado, IDLineaCliente, CantidadSolicitada, CantidadFinal,
                               GarantiaInvitadoMejor, Orden)
            SELECT g.IDVariante, g.IDLineaCarrito, c.IDLineaCarrito,
                   COALESCE(c.Cantidad, 0) + g.Cantidad,
                   -- N-05: la suma tiene como tope el disponible, sin bajar lo que el cliente ya tenía.
                   CASE WHEN c.IDLineaCarrito IS NULL THEN g.Cantidad
                        WHEN c.Cantidad + g.Cantidad <= d.Disponible THEN c.Cantidad + g.Cantidad
                        WHEN d.Disponible > c.Cantidad THEN d.Disponible
                        ELSE c.Cantidad END,
                   -- N-02: la garantía vigente más favorable es la de menor precio garantizado.
                   CASE WHEN c.IDLineaCarrito IS NOT NULL AND g.FechaGarantiaHasta > @Ahora
                             AND (c.FechaGarantiaHasta <= @Ahora OR pgg.Precio < pgc.Precio)
                        THEN 1 ELSE 0 END,
                   ROW_NUMBER() OVER (ORDER BY g.FechaAgregado, g.IDLineaCarrito)
            FROM   dbo.LineaCarrito AS g
            JOIN   dbo.PrecioVariante AS pgg ON pgg.IDPrecioVariante = g.IDPrecioVarianteGarantizado
            LEFT JOIN dbo.LineaCarrito AS c
                   ON c.IDCarrito = @IDCarritoCliente AND c.IDVariante = g.IDVariante
            LEFT JOIN dbo.PrecioVariante AS pgc ON pgc.IDPrecioVariante = c.IDPrecioVarianteGarantizado
            CROSS APPLY dbo.FU_Carrito_Disponible(@IDCarritoCliente, g.IDVariante) AS d
            WHERE  g.IDCarrito = @IDCarritoInvitado;

            -- N-05: el carrito admite MaxLineasCarrito líneas; las variantes nuevas más recientes no pasan.
            SELECT TOP (1) @MaxLineas = ps.MaxLineasCarrito FROM dbo.ParametroSistema AS ps ORDER BY ps.IDParametroSistema;
            DECLARE @Libres INT = @MaxLineas - (SELECT COUNT(*) FROM dbo.LineaCarrito AS l
                                                WHERE l.IDCarrito = @IDCarritoCliente);

            UPDATE p
            SET    CantidadFinal = 0
            FROM   @Plan AS p
            WHERE  p.IDLineaCliente IS NULL
              AND  (SELECT COUNT(*) FROM @Plan AS n WHERE n.IDLineaCliente IS NULL AND n.Orden <= p.Orden) > @Libres;

            UPDATE c
            SET    Cantidad = p.CantidadFinal,
                   IDPrecioVarianteGarantizado = IIF(p.GarantiaInvitadoMejor = 1, g.IDPrecioVarianteGarantizado,
                                                     c.IDPrecioVarianteGarantizado),
                   FechaGarantiaHasta = IIF(p.GarantiaInvitadoMejor = 1, g.FechaGarantiaHasta, c.FechaGarantiaHasta),
                   FechaActualizacion = @Ahora
            FROM   dbo.LineaCarrito AS c
            JOIN   @Plan AS p ON p.IDLineaCliente = c.IDLineaCarrito
            JOIN   dbo.LineaCarrito AS g ON g.IDLineaCarrito = p.IDLineaInvitado;

            INSERT INTO dbo.LineaCarrito (IDCarrito, IDVariante, Cantidad, IDPrecioVarianteGarantizado,
                                          FechaGarantiaHasta, PrecioAnteriorAviso, FechaAgregado)
            SELECT @IDCarritoCliente, g.IDVariante, g.Cantidad, g.IDPrecioVarianteGarantizado,
                   g.FechaGarantiaHasta, g.PrecioAnteriorAviso, g.FechaAgregado
            FROM   @Plan AS p
            JOIN   dbo.LineaCarrito AS g ON g.IDLineaCarrito = p.IDLineaInvitado
            WHERE  p.IDLineaCliente IS NULL AND p.CantidadFinal > 0;

            INSERT INTO @Avisos (IDVariante, Tipo, CantidadSolicitada, CantidadFinal)
            SELECT p.IDVariante, IIF(p.CantidadFinal = 0, 'NoFusionada', 'CantidadAjustada'),
                   p.CantidadSolicitada, p.CantidadFinal
            FROM   @Plan AS p
            WHERE  p.CantidadFinal < p.CantidadSolicitada;

            UPDATE dbo.Carrito
            SET    Estado = 'Fusionado', FechaCierre = @Ahora
            WHERE  IDCarrito = @IDCarritoInvitado;

            -- N-12: el cupón del invitado pasa si el cliente no tenía uno; se revalida al consultar.
            UPDATE dbo.Carrito
            SET    FechaUltimaActividad = @Ahora,
                   IDCupon = COALESCE(IDCupon, (SELECT i.IDCupon FROM dbo.Carrito AS i
                                                WHERE i.IDCarrito = @IDCarritoInvitado))
            WHERE  IDCarrito = @IDCarritoCliente;

            -- N-05: el contenido del carrito cambió; un pago iniciado con el anterior ya no corresponde.
            EXEC dbo.SP_Checkout_CancelarSesionActiva @IDCliente;
        END

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT a.IDVariante, p.Nombre AS Producto, a.Tipo, a.CantidadSolicitada, a.CantidadFinal
    FROM   @Avisos AS a
    JOIN   dbo.Variante AS v ON v.IDVariante = a.IDVariante
    JOIN   dbo.Producto AS p ON p.IDProducto = v.IDProducto
    ORDER BY a.IDVariante;
END
GO
