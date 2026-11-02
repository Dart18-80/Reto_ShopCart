-- Job de conciliación (N-03, 01 §6.2): registra lo que la conciliación resolvió con la pasarela para un
-- intento que tiene tomado (SP_Checkout_TomarIntentosPorConciliar):
--   Fallido     Pendiente → la pasarela nunca recibió la llave (sin cobro)
--   Rechazado   Pendiente → la pasarela lo rechazó; cuenta como rechazo de la sesión y, al llegar a
--               MaxIntentosPagoRechazados con la sesión Activa, la cancela y libera (como el pago)
--   Anulado     Pendiente o Autorizado sin pedido → se anuló la autorización
--   Capturado   Pendiente o Autorizado con su pedido → se capturó
--   EnRevision  Pago inconsistente con la pasarela, terminal y para revisión manual (V019): un pedido cuya
--               autorización ya no existe (anulada o desconocida), o un cobro capturado sin pedido. Un reintento
--               con la misma llave responde el pedido o, sin pedido, PAGO_EN_REVISION
-- Compare-and-set: si el intento ya no está en @EstadoEsperado o su arrendamiento ya no es el de esta toma
-- (@TokenArrendamiento: otro proceso lo retomó), no cambia nada y devuelve Resuelto = 0. Fallido y Anulado guardan PAGO_NO_COMPLETADO: es la respuesta que
-- recibe un reintento con la misma llave. Solo el rol Sistema (los jobs).
-- Orden de bloqueo (01 §6.6): carrito → sesión → intento (→ cupón al cancelar la sesión).
CREATE OR ALTER PROCEDURE dbo.SP_Checkout_ResolverIntentoConciliado
    @IDIntentoPago    BIGINT,
    @EstadoEsperado   VARCHAR(12),
    @Estado           VARCHAR(12),
    @IDTransaccion    VARCHAR(64)      = NULL,
    @CodigoRespuesta  VARCHAR(30)      = NULL,
    @MensajeRespuesta NVARCHAR(200)    = NULL,
    @TokenArrendamiento UNIQUEIDENTIFIER = NULL,
    @IDUsuarioActor   INT              = NULL,
    @RolActor         VARCHAR(20)      = NULL,
    @RequestId        UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @RolActor IS NULL OR @RolActor <> 'Sistema'
        THROW 50005, N'Solo la conciliación resuelve intentos de pago.', 1;

    IF NOT (   (@EstadoEsperado = 'Pendiente'  AND @Estado IN ('Fallido', 'Rechazado', 'Anulado', 'Capturado', 'EnRevision'))
            OR (@EstadoEsperado = 'Autorizado' AND @Estado IN ('Anulado', 'Capturado', 'EnRevision')))
        THROW 50005, N'Transición inválida del intento de pago en la conciliación.', 1;

    IF @Estado = 'Rechazado' AND (@CodigoRespuesta IS NULL OR @MensajeRespuesta IS NULL)
        THROW 50005, N'Un rechazo conciliado requiere el código y el mensaje de la pasarela.', 1;

    DECLARE @IDSesion INT, @Dueno INT, @Actual VARCHAR(12), @EstadoSesion VARCHAR(10), @IDCarrito INT,
            @MaxRechazos TINYINT, @Resuelto BIT = 0, @TokenVigente UNIQUEIDENTIFIER;

    SELECT @IDSesion = s.IDSesionCheckout, @Dueno = s.IDUsuario
    FROM   dbo.IntentoPago AS i
    JOIN   dbo.SesionCheckout AS s ON s.IDSesionCheckout = i.IDSesionCheckout
    WHERE  i.IDIntentoPago = @IDIntentoPago;

    IF @IDSesion IS NULL
        THROW 50005, N'El intento de pago a conciliar no existe.', 1;

    SELECT TOP (1) @MaxRechazos = ps.MaxIntentosPagoRechazados FROM dbo.ParametroSistema AS ps
    ORDER BY ps.IDParametroSistema;

    BEGIN TRY
        BEGIN TRAN;

        EXEC dbo.SP_Carrito_BloquearActivo @Dueno, NULL, @IDCarrito OUTPUT;
        SELECT @EstadoSesion = s.Estado FROM dbo.SesionCheckout AS s WITH (UPDLOCK, ROWLOCK)
        WHERE  s.IDSesionCheckout = @IDSesion;
        SELECT @Actual = i.Estado, @TokenVigente = i.TokenArrendamiento FROM dbo.IntentoPago AS i WITH (UPDLOCK, ROWLOCK)
        WHERE  i.IDIntentoPago = @IDIntentoPago;

        IF @Actual = @EstadoEsperado AND @TokenVigente = @TokenArrendamiento
        BEGIN
            DECLARE @TienePedido BIT =
                IIF(EXISTS (SELECT 1 FROM dbo.Pedido AS p WHERE p.IDIntentoPago = @IDIntentoPago), 1, 0);

            -- RF-06: se captura solo lo que tiene pedido y se anula solo lo que no lo tiene.
            IF @Estado = 'Capturado' AND @TienePedido = 0
                THROW 50005, N'No se captura un intento de pago sin pedido.', 1;
            -- Plan E6-H03 §2.6: el cobro de un pedido cancelado nunca se captura (la cancelación ya cercó el
            -- intento; esto es la última defensa).
            IF @Estado = 'Capturado' AND EXISTS (SELECT 1 FROM dbo.Pedido AS p
                                                 JOIN dbo.EstadoPedido AS e ON e.IDEstadoPedido = p.IDEstadoPedido
                                                 WHERE p.IDIntentoPago = @IDIntentoPago AND e.Codigo = 'Cancelado')
                THROW 50005, N'No se captura el cobro de un pedido cancelado.', 1;
            IF @Estado IN ('Anulado', 'Fallido', 'Rechazado') AND @TienePedido = 1
                THROW 50005, N'No se anula un intento de pago con pedido.', 1;

            UPDATE dbo.IntentoPago
            SET    Estado                = @Estado,
                   IDTransaccionPasarela = COALESCE(@IDTransaccion, IDTransaccionPasarela),
                   CodigoRespuesta       = CASE WHEN @Estado IN ('Fallido', 'Anulado') THEN 'PAGO_NO_COMPLETADO'
                                                WHEN @Estado = 'Rechazado' THEN @CodigoRespuesta
                                                WHEN @Estado = 'EnRevision' THEN 'PAGO_EN_REVISION'
                                                ELSE CodigoRespuesta END,
                   MensajeRespuesta      = CASE WHEN @Estado IN ('Fallido', 'Anulado') THEN NULL
                                                WHEN @Estado = 'Rechazado' THEN @MensajeRespuesta
                                                WHEN @Estado = 'EnRevision'
                                                THEN N'Tu pago está en verificación: no vuelvas a pagar. Te contactaremos para resolverlo.'
                                                ELSE MensajeRespuesta END,
                   ArrendadoHasta        = NULL,
                   FechaActualizacion    = SYSUTCDATETIME()
            WHERE  IDIntentoPago = @IDIntentoPago;

            IF @Estado = 'Rechazado'
            BEGIN
                UPDATE dbo.SesionCheckout
                SET    IntentosRechazados = IntentosRechazados + 1, FechaActualizacion = SYSUTCDATETIME()
                WHERE  IDSesionCheckout = @IDSesion;

                -- N-03: la sesión Activa del cliente es esta (una sola por cliente).
                IF @EstadoSesion = 'Activa'
                   AND (SELECT s.IntentosRechazados FROM dbo.SesionCheckout AS s
                        WHERE s.IDSesionCheckout = @IDSesion) >= @MaxRechazos
                    EXEC dbo.SP_Checkout_CancelarSesionActiva @Dueno;
            END

            SET @Resuelto = 1;
        END

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT @Resuelto AS Resuelto;
END
GO
