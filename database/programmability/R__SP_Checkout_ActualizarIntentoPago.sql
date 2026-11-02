-- RF-06, N-03 (01 §6.2): el servicio registra el resultado de la pasarela en el intento que tiene arrendado.
--   Autorizado  Pendiente → Autorizado con la transacción (sigue arrendado: falta crear el pedido y capturar)
--   Rechazado   Pendiente → Rechazado; la sesión suma un rechazo y, al llegar a MaxIntentosPagoRechazados,
--               se cancela y libera reservas y cupón (SP_Checkout_CancelarSesionActiva)
--   Anulado     Pendiente o Autorizado → Anulado con el código del error que hizo fallar el pedido
--   Capturado   Autorizado → Capturado
-- Repetir el mismo estado no cambia nada. Solo el cliente dueño del intento (otro caso es un error de
-- programación: 50005). Orden de bloqueo (01 §6.6): carrito → sesión → intento.
-- Devuelve los intentos que le quedan a la sesión y si se canceló.
CREATE OR ALTER PROCEDURE dbo.SP_Checkout_ActualizarIntentoPago
    @IDIntentoPago    BIGINT,
    @Estado           VARCHAR(12),
    @IDTransaccion    VARCHAR(64)      = NULL,
    @CodigoRespuesta  VARCHAR(30)      = NULL,
    @MensajeRespuesta NVARCHAR(200)    = NULL,
    @IDUsuarioActor   INT              = NULL,
    @RolActor         VARCHAR(20)      = NULL,
    @RequestId        UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @IDCliente INT = CASE WHEN @RolActor = 'Cliente' THEN @IDUsuarioActor END;
    DECLARE @IDSesion INT, @Dueno INT, @Actual VARCHAR(12), @IDCarrito INT, @Rechazos TINYINT,
            @MaxRechazos TINYINT, @Cancelada BIT = 0, @Bloqueada INT;

    SELECT @IDSesion = s.IDSesionCheckout, @Dueno = s.IDUsuario
    FROM   dbo.IntentoPago AS i
    JOIN   dbo.SesionCheckout AS s ON s.IDSesionCheckout = i.IDSesionCheckout
    WHERE  i.IDIntentoPago = @IDIntentoPago;

    IF @IDCliente IS NULL OR @Dueno IS NULL OR @Dueno <> @IDCliente
        THROW 50005, N'El intento de pago no es del cliente de la petición.', 1;

    SELECT TOP (1) @MaxRechazos = ps.MaxIntentosPagoRechazados FROM dbo.ParametroSistema AS ps
    ORDER BY ps.IDParametroSistema;

    BEGIN TRY
        BEGIN TRAN;

        EXEC dbo.SP_Carrito_BloquearActivo @IDCliente, NULL, @IDCarrito OUTPUT;
        SELECT @Bloqueada = s.IDSesionCheckout FROM dbo.SesionCheckout AS s WITH (UPDLOCK, ROWLOCK)
        WHERE  s.IDSesionCheckout = @IDSesion;
        SELECT @Actual = i.Estado FROM dbo.IntentoPago AS i WITH (UPDLOCK, ROWLOCK)
        WHERE  i.IDIntentoPago = @IDIntentoPago;

        IF @Actual <> @Estado
        BEGIN
            IF NOT (   (@Estado = 'Autorizado' AND @Actual = 'Pendiente')
                    OR (@Estado = 'Rechazado'  AND @Actual = 'Pendiente')
                    OR (@Estado = 'Anulado'    AND @Actual IN ('Pendiente', 'Autorizado'))
                    OR (@Estado = 'Capturado'  AND @Actual = 'Autorizado'))
                THROW 50005, N'Transición inválida del intento de pago.', 1;

            -- RF-06: un intento con pedido nunca se anula (su cobro es el del pedido).
            IF @Estado = 'Anulado' AND EXISTS (SELECT 1 FROM dbo.Pedido AS p WHERE p.IDIntentoPago = @IDIntentoPago)
                THROW 50005, N'No se anula un intento de pago con pedido.', 1;

            UPDATE dbo.IntentoPago
            SET    Estado                = @Estado,
                   IDTransaccionPasarela = COALESCE(@IDTransaccion, IDTransaccionPasarela),
                   CodigoRespuesta       = COALESCE(@CodigoRespuesta, CodigoRespuesta),
                   MensajeRespuesta      = COALESCE(@MensajeRespuesta, MensajeRespuesta),
                   -- Fuera de curso ya no tiene arrendamiento; Autorizado lo conserva hasta capturar.
                   ArrendadoHasta        = IIF(@Estado = 'Autorizado', ArrendadoHasta, NULL),
                   FechaActualizacion    = SYSUTCDATETIME()
            WHERE  IDIntentoPago = @IDIntentoPago;

            IF @Estado = 'Rechazado'
            BEGIN
                UPDATE dbo.SesionCheckout
                SET    IntentosRechazados = IntentosRechazados + 1, FechaActualizacion = SYSUTCDATETIME()
                WHERE  IDSesionCheckout = @IDSesion;

                -- N-03: al llegar al máximo, la sesión se cancela y libera reservas y cupón.
                IF (SELECT s.IntentosRechazados FROM dbo.SesionCheckout AS s WHERE s.IDSesionCheckout = @IDSesion)
                   >= @MaxRechazos
                BEGIN
                    EXEC dbo.SP_Checkout_CancelarSesionActiva @IDCliente;
                    SET @Cancelada = 1;
                END
            END
        END

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT @Rechazos = s.IntentosRechazados FROM dbo.SesionCheckout AS s WHERE s.IDSesionCheckout = @IDSesion;
    SELECT CONVERT(INT, @MaxRechazos) - @Rechazos AS IntentosRestantes,
           CONVERT(BIT, IIF(@Cancelada = 1 OR (SELECT s.Estado FROM dbo.SesionCheckout AS s
                                               WHERE s.IDSesionCheckout = @IDSesion) = 'Cancelada', 1, 0))
               AS SesionCancelada;
END
GO
