-- RF-06, N-01, N-07, N-08, N-18 (01 §6.2, plan E5-H03 §5): la transacción atómica que crea el pedido de una
-- sesión pagada. Solo con el intento Autorizado (con su transacción de la pasarela) y del cliente de la
-- petición: nunca hay pedido sin autorización confirmada. Idempotente: si la sesión ya tiene pedido, lo
-- devuelve (UQ_Pedido_IDSesionCheckout es la autoridad).
-- Orden de bloqueo (01 §6.6): carrito → variantes por IDVariante → sesión → cupón → intento.
-- Fencing (N-03): solo la petición dueña del arrendamiento vigente (@TokenArrendamiento) crea el pedido; si otro
-- proceso lo retomó (la conciliación o un reintento), 50602 y nada se escribe.
-- La sesión debe estar Activa (si el job la expiró: 50601); una que venció durante este pago, con el
-- arrendamiento vivo, se acepta: una reserva vencida se vuelve a reservar con SP_Inventario_ReservarExistencia,
-- que valida bajo el bloqueo de la variante; si no alcanza, 50301 y nada se escribe.
-- Escribe en una sola transacción: pedido (copias de M-04, IVA de N-18, FechaPagoLocal de A-12), detalle,
-- SalidaVenta en el kardex (SP_Inventario_RegistrarMovimiento, N-07), reservas Consumida, uso del cupón
-- Confirmado, sesión Pagada, carrito Convertido e historial (ninguno) → Pagado. Devuelve el pedido.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_CrearPedido
    @IDIntentoPago      BIGINT,
    @TokenArrendamiento UNIQUEIDENTIFIER,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @IDCliente INT = CASE WHEN @RolActor = 'Cliente' THEN @IDUsuarioActor END;
    DECLARE @IDSesion INT, @Dueno INT, @IDCarrito INT, @ID INT, @Bloqueada INT, @EstadoSesion VARCHAR(10),
            @EstadoIntento VARCHAR(12), @IDTransaccion VARCHAR(64), @IDPedido INT, @IDCupon INT,
            @Ahora DATETIME2(3) = SYSUTCDATETIME(), @FechaLocal DATE, @IDEstadoPagado INT, @Numero VARCHAR(20),
            @Cantidad INT, @TokenVigente UNIQUEIDENTIFIER, @Vencidas NVARCHAR(MAX), @MinutosReserva SMALLINT,
            @Vence DATETIME2(3);

    SELECT @IDSesion = s.IDSesionCheckout, @Dueno = s.IDUsuario, @IDCarrito = s.IDCarrito
    FROM   dbo.IntentoPago AS i
    JOIN   dbo.SesionCheckout AS s ON s.IDSesionCheckout = i.IDSesionCheckout
    WHERE  i.IDIntentoPago = @IDIntentoPago;

    IF @IDCliente IS NULL OR @Dueno IS NULL OR @Dueno <> @IDCliente
        THROW 50005, N'El intento de pago no es del cliente de la petición.', 1;

    BEGIN TRY
        BEGIN TRAN;

        -- 01 §6.6: el carrito de la sesión, las variantes en orden, la sesión, el cupón y el intento.
        SELECT @Bloqueada = c.IDCarrito FROM dbo.Carrito AS c WITH (UPDLOCK, ROWLOCK) WHERE c.IDCarrito = @IDCarrito;

        SET @ID = (SELECT MIN(l.IDVariante) FROM dbo.LineaSesionCheckout AS l WHERE l.IDSesionCheckout = @IDSesion);
        WHILE @ID IS NOT NULL
        BEGIN
            SELECT @Bloqueada = v.IDVariante FROM dbo.Variante AS v WITH (UPDLOCK, ROWLOCK) WHERE v.IDVariante = @ID;
            SET @ID = (SELECT MIN(l.IDVariante) FROM dbo.LineaSesionCheckout AS l
                       WHERE l.IDSesionCheckout = @IDSesion AND l.IDVariante > @ID);
        END

        SELECT @EstadoSesion = s.Estado, @IDCupon = s.IDCupon
        FROM   dbo.SesionCheckout AS s WITH (UPDLOCK, ROWLOCK)
        WHERE  s.IDSesionCheckout = @IDSesion;

        -- Idempotencia: un pedido por sesión.
        SET @IDPedido = (SELECT p.IDPedido FROM dbo.Pedido AS p WHERE p.IDSesionCheckout = @IDSesion);

        IF @IDPedido IS NULL
        BEGIN
            IF @IDCupon IS NOT NULL
                SELECT @Bloqueada = c.IDCupon FROM dbo.Cupon AS c WITH (UPDLOCK, ROWLOCK) WHERE c.IDCupon = @IDCupon;

            SELECT @EstadoIntento = i.Estado, @IDTransaccion = i.IDTransaccionPasarela,
                   @TokenVigente = i.TokenArrendamiento
            FROM   dbo.IntentoPago AS i WITH (UPDLOCK, ROWLOCK)
            WHERE  i.IDIntentoPago = @IDIntentoPago;

            IF @TokenArrendamiento IS NULL OR @TokenVigente IS NULL OR @TokenVigente <> @TokenArrendamiento
                THROW 50602, N'Otro proceso tomó este pago. Reintenta con la misma llave.', 1;

            -- N-03: nunca un pedido sin una autorización confirmada.
            IF @EstadoIntento <> 'Autorizado' OR @IDTransaccion IS NULL
                THROW 50005, N'Solo se crea un pedido con el pago autorizado.', 1;
            IF @EstadoSesion <> 'Activa'
                THROW 50601, N'Tu sesión de pago venció. Vuelve a iniciar el pago.', 1;

            -- N-06: las líneas cuya reserva venció se vuelven a reservar bajo el bloqueo de la variante.
            SET @Vencidas = (SELECT l.IDVariante AS idVariante, l.Cantidad AS cantidad
                             FROM   dbo.LineaSesionCheckout AS l
                             WHERE  l.IDSesionCheckout = @IDSesion
                               AND  NOT EXISTS (SELECT 1 FROM dbo.Reserva AS r
                                                WHERE r.IDSesionCheckout = @IDSesion AND r.IDVariante = l.IDVariante
                                                  AND r.Estado = 'Activa' AND r.FechaExpiracion > @Ahora)
                             ORDER BY l.IDVariante FOR JSON PATH);
            IF @Vencidas IS NOT NULL
            BEGIN
                SELECT TOP (1) @MinutosReserva = ps.MinutosReserva FROM dbo.ParametroSistema AS ps
                ORDER BY ps.IDParametroSistema;
                SET @Vence = DATEADD(MINUTE, @MinutosReserva, @Ahora);
                EXEC dbo.SP_Inventario_ReservarExistencia @IDSesion, @Vencidas, @Vence,
                     N'Tu reserva venció y ya no hay existencia suficiente para algunos productos.';
            END

            SELECT @FechaLocal = f.FechaLocal FROM dbo.FU_Sistema_FechaLocal(@Ahora) AS f;
            SET @IDEstadoPagado = (SELECT e.IDEstadoPedido FROM dbo.EstadoPedido AS e WHERE e.Codigo = 'Pagado');

            -- M-04: copias de la sesión; N-18: IVA incluido, base = ROUND(Total / 1.12, 2).
            INSERT INTO dbo.Pedido (
                IDUsuario, IDSesionCheckout, IDIntentoPago, IDEstadoPedido, Subtotal, Descuento, CostoEnvio, Total,
                BaseImponible, IVA, IDCupon, CodigoCupon, IDMetodoEnvio, NombreMetodoEnvio, FechaEstimadaEntrega,
                NombreRecibe, TelefonoRecibe, IDMunicipio, Departamento, Municipio, DireccionLinea, Referencia,
                IDTransaccionPasarela, MarcaTarjeta, UltimosDigitos, FechaPago, FechaPagoLocal)
            SELECT s.IDUsuario, s.IDSesionCheckout, i.IDIntentoPago, @IDEstadoPagado, s.Subtotal, s.Descuento,
                   s.CostoEnvio, s.Total, iva.Base, s.Total - iva.Base, s.IDCupon, s.CodigoCupon, s.IDMetodoEnvio,
                   s.NombreMetodoEnvio, DATEADD(DAY, s.DiasMax, @FechaLocal), s.NombreRecibe, s.TelefonoRecibe,
                   s.IDMunicipio, s.Departamento, s.Municipio, s.DireccionLinea, s.Referencia,
                   i.IDTransaccionPasarela, i.MarcaTarjeta, i.UltimosDigitos, @Ahora, @FechaLocal
            FROM   dbo.SesionCheckout AS s
            JOIN   dbo.IntentoPago AS i ON i.IDIntentoPago = @IDIntentoPago
            CROSS APPLY (SELECT CONVERT(DECIMAL(12,2), ROUND(s.Total / 1.12, 2)) AS Base) AS iva
            WHERE  s.IDSesionCheckout = @IDSesion;
            SET @IDPedido = SCOPE_IDENTITY();
            SET @Numero = (SELECT p.NumeroPedido FROM dbo.Pedido AS p WHERE p.IDPedido = @IDPedido);

            INSERT INTO dbo.DetallePedido (IDPedido, IDVariante, IDPrecioVariante, SKU, NombreProducto,
                                           DescripcionVariante, IDCategoria, NombreCategoria, Cantidad,
                                           PrecioUnitario, DescuentoLinea, TotalLinea)
            SELECT @IDPedido, l.IDVariante, l.IDPrecioVariante, v.SKU, p.Nombre, v.DescripcionAtributos,
                   c.IDCategoria, c.Nombre, l.Cantidad, l.PrecioUnitario, l.DescuentoLinea, l.TotalLinea
            FROM   dbo.LineaSesionCheckout AS l
            JOIN   dbo.Variante  AS v ON v.IDVariante = l.IDVariante
            JOIN   dbo.Producto  AS p ON p.IDProducto = v.IDProducto
            JOIN   dbo.Categoria AS c ON c.IDCategoria = p.IDCategoria
            WHERE  l.IDSesionCheckout = @IDSesion;

            -- N-07: la salida en el kardex es la venta; solo SP_Inventario_RegistrarMovimiento la escribe.
            SET @ID = (SELECT MIN(l.IDVariante) FROM dbo.LineaSesionCheckout AS l WHERE l.IDSesionCheckout = @IDSesion);
            WHILE @ID IS NOT NULL
            BEGIN
                SET @Cantidad = (SELECT l.Cantidad FROM dbo.LineaSesionCheckout AS l
                                 WHERE l.IDSesionCheckout = @IDSesion AND l.IDVariante = @ID);
                EXEC dbo.SP_Inventario_RegistrarMovimiento
                     @IDVariante = @ID, @CodigoTipo = 'SalidaVenta', @Cantidad = @Cantidad, @Motivo = N'Venta',
                     @Referencia = @Numero, @IDPedido = @IDPedido, @IDDevolucion = NULL;
                SET @ID = (SELECT MIN(l.IDVariante) FROM dbo.LineaSesionCheckout AS l
                           WHERE l.IDSesionCheckout = @IDSesion AND l.IDVariante > @ID);
            END

            UPDATE dbo.Reserva SET Estado = 'Consumida', FechaCierre = @Ahora
            WHERE  IDSesionCheckout = @IDSesion AND Estado = 'Activa';

            UPDATE dbo.UsoCupon SET Estado = 'Confirmado', IDPedido = @IDPedido, FechaActualizacion = @Ahora
            WHERE  IDSesionCheckout = @IDSesion AND Estado = 'Reservado';

            UPDATE dbo.SesionCheckout SET Estado = 'Pagada', FechaCierre = @Ahora, FechaActualizacion = @Ahora
            WHERE  IDSesionCheckout = @IDSesion;

            UPDATE dbo.Carrito SET Estado = 'Convertido', FechaCierre = @Ahora WHERE IDCarrito = @IDCarrito;

            -- N-08: el primer estado lo registra el sistema al confirmar el pago.
            INSERT INTO dbo.HistorialEstadoPedido (IDPedido, IDEstadoAnterior, IDEstadoNuevo, IDUsuario, Motivo,
                                                   RequestId)
            VALUES (@IDPedido, NULL, @IDEstadoPagado, @IDCliente, N'Pago confirmado', @RequestId);
        END

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    EXEC dbo.SP_Pedidos_ObtenerDetalle @IDPedido = @IDPedido, @IDUsuarioActor = @IDUsuarioActor,
                                       @RolActor = @RolActor, @RequestId = @RequestId;
END
GO
