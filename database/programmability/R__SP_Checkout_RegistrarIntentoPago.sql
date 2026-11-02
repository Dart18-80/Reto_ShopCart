-- RF-06, N-03 (01 §6.2, plan E5-H03): candado de idempotencia del pago. Devuelve una sola fila con la acción que
-- sigue el servicio:
--   Autorizar   llave nueva (intento Pendiente insertado con el arrendamiento tomado) o un Pendiente cuyo
--               arrendamiento venció y esta petición retomó (compare-and-set bajo UPDLOCK)
--   CrearPedido un Autorizado sin pedido retomado      Capturar  un Autorizado con pedido retomado
--   Cerrar      un intento retomado cuya sesión venció o se canceló: nunca se autoriza; el servicio consulta la
--               pasarela, anula si hay autorización y cierra el intento sin cobro (SESION_VENCIDA)
--   Pedido      ya pagado (la misma llave, o la sesión ya se pagó con cualquier llave): sin intento ni pasarela
--   EnCurso     la misma llave con el arrendamiento vivo (409 con Retry-After = SegundosParaReintentar)
--   Rechazado | Error   la respuesta que se dio entonces (Anulado, Fallido)
-- Cada toma del arrendamiento genera un TokenArrendamiento nuevo (fencing, N-03): el servicio lo pasa a los SPs
-- que escriben el intento o crean el pedido, que lo verifican bajo bloqueo.
-- El pago debe empezar dentro de la vigencia de la sesión: una llave nueva con la sesión vencida → 50601, aunque
-- el job todavía no la haya marcado.
-- HashSolicitud = SHA-256 de sesión, monto, marca y últimos 4 dígitos (nunca el número ni el CVV). La misma
-- llave de otro cliente, de otra sesión o con otro hash → 50603.
-- Orden de bloqueo (01 §6.6): carrito → sesión → intento.
CREATE OR ALTER PROCEDURE dbo.SP_Checkout_RegistrarIntentoPago
    @LlaveIdempotencia     UNIQUEIDENTIFIER,
    @MarcaTarjeta          VARCHAR(20),
    @UltimosDigitos        CHAR(4),
    @SegundosArrendamiento INT,
    @IDUsuarioActor        INT              = NULL,
    @RolActor              VARCHAR(20)      = NULL,
    @RequestId             UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @IDCliente INT = CASE WHEN @RolActor = 'Cliente' THEN @IDUsuarioActor END;
    IF @IDCliente IS NULL
        THROW 50005, N'Solo un cliente puede pagar.', 1;

    -- N-03: cuánto tiempo después de pagar una llave nueva todavía recibe el pedido existente (en vez de 404).
    DECLARE @MinutosVentanaYaPagada SMALLINT = 15;

    DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME(), @Token UNIQUEIDENTIFIER = NEWID();
    DECLARE @IDCarrito INT, @IDIntento BIGINT, @IDSesion INT, @Estado VARCHAR(12), @Arrendado DATETIME2(3),
            @HashGuardado BINARY(32), @Dueno INT, @IDPedido INT, @Accion VARCHAR(20), @Monto DECIMAL(12,2),
            @IDTransaccion VARCHAR(64), @Codigo VARCHAR(30), @Mensaje NVARCHAR(200), @Expira DATETIME2(3),
            @Rechazos TINYINT, @MaxRechazos TINYINT, @Bloqueada INT, @EstadoSesion VARCHAR(10);

    SELECT TOP (1) @MaxRechazos = ps.MaxIntentosPagoRechazados
    FROM   dbo.ParametroSistema AS ps ORDER BY ps.IDParametroSistema;

    BEGIN TRY
        BEGIN TRAN;

        -- 01 §6.6: primero el carrito (puede no haber: ya se convirtió en un pedido).
        EXEC dbo.SP_Carrito_BloquearActivo @IDCliente, NULL, @IDCarrito OUTPUT;

        -- La sesión de la llave, si existe; si no, la sesión Activa del cliente. Se bloquea antes que el intento.
        SET @IDSesion = (SELECT i.IDSesionCheckout FROM dbo.IntentoPago AS i
                         WHERE i.LlaveIdempotencia = @LlaveIdempotencia);
        IF @IDSesion IS NULL
            SET @IDSesion = (SELECT s.IDSesionCheckout FROM dbo.SesionCheckout AS s
                             WHERE s.IDUsuario = @IDCliente AND s.Estado = 'Activa');
        SELECT @Bloqueada = s.IDSesionCheckout, @Dueno = s.IDUsuario, @EstadoSesion = s.Estado,
               @Expira = s.FechaExpiracion, @Rechazos = s.IntentosRechazados, @Monto = s.Total
        FROM   dbo.SesionCheckout AS s WITH (UPDLOCK, ROWLOCK)
        WHERE  s.IDSesionCheckout = @IDSesion;

        -- sqlserver-sp §9.3: HOLDLOCK bloquea también el hueco de una llave nueva.
        SELECT @IDIntento = i.IDIntentoPago, @Estado = i.Estado, @Arrendado = i.ArrendadoHasta,
               @HashGuardado = i.HashSolicitud, @Monto = i.Monto, @IDTransaccion = i.IDTransaccionPasarela,
               @Codigo = i.CodigoRespuesta, @Mensaje = i.MensajeRespuesta
        FROM   dbo.IntentoPago AS i WITH (UPDLOCK, HOLDLOCK)
        WHERE  i.LlaveIdempotencia = @LlaveIdempotencia;

        IF @IDIntento IS NOT NULL
        BEGIN
            -- RF-01: la llave de otro cliente responde igual que una con otro contenido.
            IF @Dueno <> @IDCliente
               OR @HashGuardado <> HASHBYTES('SHA2_256', CONCAT_WS(N'|', @IDSesion, CONVERT(VARCHAR(20), @Monto),
                                                                    @MarcaTarjeta, @UltimosDigitos))
                THROW 50603, N'La llave de idempotencia ya se usó con otra solicitud.', 1;

            -- 01 §6.2: la llave es de una sesión anterior y el cliente ya inició otra (el carrito bloqueado
            -- serializa el inicio de sesiones): es otra solicitud, no un reintento.
            IF EXISTS (SELECT 1 FROM dbo.SesionCheckout AS s
                       WHERE s.IDUsuario = @IDCliente AND s.Estado = 'Activa' AND s.IDSesionCheckout <> @IDSesion)
                THROW 50603, N'La llave de idempotencia ya se usó con otra solicitud.', 1;

            SET @IDPedido = (SELECT p.IDPedido FROM dbo.Pedido AS p WHERE p.IDSesionCheckout = @IDSesion);

            IF @Estado = 'Capturado'
                SET @Accion = 'Pedido';
            ELSE IF @Estado IN ('Pendiente', 'Autorizado')
            BEGIN
                -- N-03: compare-and-set del arrendamiento con un token nuevo. Solo una petición retoma un intento
                -- vencido, y la que lo tenía antes ya no puede escribirlo (fencing).
                UPDATE dbo.IntentoPago
                SET    ArrendadoHasta = DATEADD(SECOND, @SegundosArrendamiento, @Ahora), TokenArrendamiento = @Token,
                       FechaActualizacion = @Ahora
                WHERE  IDIntentoPago = @IDIntento AND Estado = @Estado
                  AND  (ArrendadoHasta IS NULL OR ArrendadoHasta <= @Ahora);

                -- Una sesión vencida o cancelada nunca vuelve a autorizar ni crea el pedido: se cierra sin cobro.
                SET @Accion = CASE WHEN @@ROWCOUNT = 0 THEN 'EnCurso'
                                   WHEN @IDPedido IS NOT NULL THEN 'Capturar'
                                   WHEN @EstadoSesion <> 'Activa' OR @Expira <= @Ahora THEN 'Cerrar'
                                   WHEN @Estado = 'Pendiente' THEN 'Autorizar'
                                   ELSE 'CrearPedido' END;
            END
            -- Revisión de E6: un intento con pedido que ya no está en curso (por ejemplo, Anulado por la
            -- cancelación del pedido) responde el pedido, igual que uno Capturado.
            ELSE IF @IDPedido IS NOT NULL
                SET @Accion = 'Pedido';
            ELSE IF @Estado = 'Rechazado'
                SET @Accion = 'Rechazado';
            ELSE
                SET @Accion = 'Error';
        END
        ELSE IF @Bloqueada IS NULL
        BEGIN
            -- N-03: la sesión ya se pagó (con cualquier llave): el pedido existente, sin intento ni pasarela.
            SELECT TOP (1) @IDPedido = p.IDPedido
            FROM   dbo.SesionCheckout AS s
            JOIN   dbo.Pedido AS p ON p.IDSesionCheckout = s.IDSesionCheckout
            WHERE  s.IDUsuario = @IDCliente AND s.Estado = 'Pagada'
              AND  s.FechaCierre > DATEADD(MINUTE, -@MinutosVentanaYaPagada, @Ahora)
            ORDER BY s.FechaCierre DESC;

            -- Si el job ya expiró la sesión, el pago responde como con la sesión vencida sin marcar.
            IF @IDPedido IS NULL
               AND (SELECT TOP (1) s.Estado FROM dbo.SesionCheckout AS s WHERE s.IDUsuario = @IDCliente
                    ORDER BY s.FechaCreacion DESC, s.IDSesionCheckout DESC) = 'Expirada'
                THROW 50601, N'Tu sesión de pago venció. Vuelve a iniciar el pago.', 1;
            IF @IDPedido IS NULL
                THROW 50001, N'No tienes un pago en curso.', 1;
            SET @Accion = 'Pedido';
        END
        ELSE
        BEGIN
            IF @Expira <= @Ahora
                THROW 50601, N'Tu sesión de pago venció. Vuelve a iniciar el pago.', 1;
            IF @Rechazos >= @MaxRechazos
                THROW 50605, N'Se alcanzó el máximo de intentos de pago.', 1;
            IF EXISTS (SELECT 1 FROM dbo.IntentoPago AS i
                       WHERE i.IDSesionCheckout = @IDSesion AND i.Estado IN ('Pendiente', 'Autorizado'))
                THROW 50602, N'Hay otro pago en curso para esta compra.', 1;

            INSERT INTO dbo.IntentoPago (IDSesionCheckout, LlaveIdempotencia, HashSolicitud, Monto, Estado,
                                         MarcaTarjeta, UltimosDigitos, ArrendadoHasta, TokenArrendamiento)
            VALUES (@IDSesion, @LlaveIdempotencia,
                    HASHBYTES('SHA2_256', CONCAT_WS(N'|', @IDSesion, CONVERT(VARCHAR(20), @Monto), @MarcaTarjeta,
                                                    @UltimosDigitos)),
                    @Monto, 'Pendiente', @MarcaTarjeta, @UltimosDigitos,
                    DATEADD(SECOND, @SegundosArrendamiento, @Ahora), @Token);
            SET @IDIntento = SCOPE_IDENTITY();
            SET @Accion = 'Autorizar';
        END

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        -- UX_IntentoPago_EnCursoPorSesion y UQ_IntentoPago_LlaveIdempotencia son la última defensa.
        IF ERROR_NUMBER() IN (2601, 2627)
           AND (ERROR_MESSAGE() LIKE N'%UX_IntentoPago_EnCursoPorSesion%'
                OR ERROR_MESSAGE() LIKE N'%UQ_IntentoPago_LlaveIdempotencia%')
            THROW 50602, N'Hay otro pago en curso para esta compra.', 1;
        THROW;
    END CATCH

    SELECT @Accion AS Accion, @IDIntento AS IDIntentoPago, @Monto AS Monto, @IDTransaccion AS IDTransaccion,
           @IDPedido AS IDPedido, @Codigo AS CodigoRespuesta, @Mensaje AS MensajeRespuesta,
           CASE WHEN @Accion IN ('Autorizar', 'CrearPedido', 'Capturar', 'Cerrar') THEN @Token END
               AS TokenArrendamiento,
           CASE WHEN @Accion = 'EnCurso' THEN DATEDIFF(SECOND, @Ahora, @Arrendado) + 1 END AS SegundosParaReintentar,
           CONVERT(INT, @MaxRechazos) - COALESCE((SELECT s.IntentosRechazados FROM dbo.SesionCheckout AS s
                                                  WHERE s.IDSesionCheckout = @IDSesion), 0) AS IntentosRestantes;
END
GO
