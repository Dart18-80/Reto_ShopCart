-- depende-de: R__SP_Pedidos_AplicarCancelacion.sql
-- E9-H04 (decisión del PO): el Admin resuelve un intento de pago EnRevision. El servicio ya consultó la pasarela
-- (fuera de toda transacción) y solo llama si la evidencia respalda la resolución:
--   CobroVerificado  con pedido: la pasarela tiene el cobro capturado. El intento queda Capturado con la
--                    transacción y el pedido sigue su flujo
--   SinCobro         con pedido: no hubo captura. El intento queda Anulado y el pedido se cancela por el mismo
--                    camino que cualquier cancelación (SP_Pedidos_AplicarCancelacion), con el motivo del Admin:
--                    con el intento ya Anulado no crea reembolso. Es la única vía que cancela un pedido EnRevision
--   Reembolsar       sin pedido: el cobro capturado se devuelve con un reembolso Pendiente por el monto del
--                    intento (UX_Reembolso_PorIntento: uno solo, nunca más de lo capturado), con una llave
--                    determinista; lo procesa el flujo de siempre. El intento queda Anulado: un reintento con su
--                    llave responde PAGO_NO_COMPLETADO
-- Bajo bloqueo, en el orden de la cancelación (pedido → intento): si ya no está EnRevision, 50707 (resolver dos
-- veces responde 409); si la resolución no corresponde a su caso, 50708. La resolución queda en el intento (quién,
-- cuándo y el motivo) y en la bitácora (TR_Pedidos_PagoBitacora). Solo el Administrador.
-- Devuelve el intento resuelto, su pedido y el reembolso creado.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_ResolverPagoEnRevision
    @IDIntentoPago  BIGINT,
    @Resolucion     VARCHAR(16),
    @Motivo         NVARCHAR(250),
    @IDTransaccion  VARCHAR(64)      = NULL,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @RolActor IS NULL OR @RolActor <> 'Administrador' OR @IDUsuarioActor IS NULL
        THROW 50005, N'Solo el Administrador resuelve un pago en revisión.', 1;
    IF @Resolucion IS NULL OR @Resolucion NOT IN ('CobroVerificado', 'SinCobro', 'Reembolsar')
        THROW 50003, N'La resolución no es válida.', 1;
    IF NULLIF(LTRIM(RTRIM(@Motivo)), N'') IS NULL
        THROW 50003, N'La resolución requiere un motivo.', 1;

    DECLARE @IDPedido INT, @Bloqueado INT, @Estado VARCHAR(12), @Monto DECIMAL(12,2), @IDReembolso INT,
            @Motivo250 NVARCHAR(250) = LTRIM(RTRIM(@Motivo));

    BEGIN TRY
        BEGIN TRAN;

        -- El pedido se bloquea antes que el intento, como en la cancelación: sin ciclos entre las dos.
        SET @IDPedido = (SELECT p.IDPedido FROM dbo.Pedido AS p WHERE p.IDIntentoPago = @IDIntentoPago);
        IF @IDPedido IS NOT NULL
            SELECT @Bloqueado = p.IDPedido
            FROM   dbo.Pedido AS p WITH (UPDLOCK, ROWLOCK)
            WHERE  p.IDPedido = @IDPedido;

        SELECT @Estado = i.Estado, @Monto = i.Monto
        FROM   dbo.IntentoPago AS i WITH (UPDLOCK, ROWLOCK)
        WHERE  i.IDIntentoPago = @IDIntentoPago;

        IF @Estado IS NULL
            THROW 50001, N'El intento de pago no existe.', 1;
        IF @Estado <> 'EnRevision'
            THROW 50707, N'Este pago ya no está en revisión: alguien lo resolvió antes.', 1;
        IF @Resolucion IN ('CobroVerificado', 'SinCobro') AND @IDPedido IS NULL
            THROW 50708, N'Este cobro no tiene pedido: solo se puede reembolsar.', 1;
        IF @Resolucion = 'Reembolsar' AND @IDPedido IS NOT NULL
            THROW 50708, N'Este pago tiene pedido: verifica el cobro o cancela el pedido sin cobro.', 1;

        -- El intento se cierra antes de cancelar: SP_Pedidos_AplicarCancelacion rechaza un pago EnRevision y no
        -- reembolsa uno Anulado.
        UPDATE dbo.IntentoPago
        SET    Estado = IIF(@Resolucion = 'CobroVerificado', 'Capturado', 'Anulado'),
               IDTransaccionPasarela = COALESCE(@IDTransaccion, IDTransaccionPasarela),
               CodigoRespuesta = IIF(@Resolucion = 'CobroVerificado', NULL, 'PAGO_NO_COMPLETADO'),
               MensajeRespuesta = NULL,
               ResolucionManual = @Resolucion, MotivoResolucion = @Motivo250,
               IDUsuarioResolucion = @IDUsuarioActor, FechaResolucion = SYSUTCDATETIME(),
               FechaActualizacion = SYSUTCDATETIME()
        WHERE  IDIntentoPago = @IDIntentoPago;

        IF @Resolucion = 'SinCobro'
            EXEC dbo.SP_Pedidos_AplicarCancelacion
                 @IDPedido = @IDPedido, @Motivo = @Motivo250, @IDUsuario = @IDUsuarioActor, @IDCliente = NULL,
                 @RequestId = @RequestId, @IDReembolso = @IDReembolso OUTPUT;

        IF @Resolucion = 'Reembolsar'
        BEGIN
            INSERT INTO dbo.Reembolso (IDPedido, IDIntentoPago, IDDevolucion, Origen, Monto, Estado,
                                       LlaveIdempotencia, FechaProximoIntento)
            VALUES (NULL, @IDIntentoPago, NULL, 'SinPedido', @Monto, 'Pendiente',
                    CONVERT(UNIQUEIDENTIFIER, HASHBYTES('MD5', CONCAT(N'Reembolso|Intento|', @IDIntentoPago))),
                    SYSUTCDATETIME());
            SET @IDReembolso = SCOPE_IDENTITY();
        END

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT i.IDIntentoPago, i.Estado, i.ResolucionManual, i.MotivoResolucion, i.FechaResolucion,
           @IDPedido AS IDPedido, @IDReembolso AS IDReembolso
    FROM   dbo.IntentoPago AS i
    WHERE  i.IDIntentoPago = @IDIntentoPago;
END
GO
