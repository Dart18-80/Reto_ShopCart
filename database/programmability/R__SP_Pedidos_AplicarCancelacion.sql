-- N-09, RF-07 (plan E6-H03 §2) · interno: cancela el pedido completo dentro de la transacción del llamador. Lo
-- usan SP_Pedidos_Cancelar y la resolución SinCobro de un pago en revisión (E9-H04): un solo camino.
-- @IDCliente: el dueño que exige la cancelación del cliente (uno ajeno responde 50001, igual que uno inexistente);
-- NULL en la gestión. Solo desde Pagado o EnPreparacion (50702 en otro estado, también una segunda cancelación).
--   estado Cancelado + historial · ReingresoCancelacion por línea (SP_Inventario_RegistrarMovimiento) ·
--   UsoCupon Revertido (SP_Cupones_RevertirUso) · si el cobro todavía no se capturó (captura pendiente de la
--   conciliación), el intento pasa a Anulado con un token nuevo (fencing): la conciliación nunca captura el cobro
--   de un pedido cancelado · Reembolso Pendiente por lo que falta reembolsar (total con envío), con una llave
--   determinista · Pedido.MontoReembolsado += monto (CHECK ≤ Total, A-13). Con el pago en revisión no hay cobro
--   que devolver: ningún reembolso (@IDReembolso NULL).
-- Orden de bloqueo: pedido → variantes (por IDVariante, dentro de SP_Inventario_RegistrarMovimiento) → cupón →
-- intento.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_AplicarCancelacion
    @IDPedido    INT,
    @Motivo      NVARCHAR(250),
    @IDUsuario   INT,
    @IDCliente   INT,
    @RequestId   UNIQUEIDENTIFIER,
    @IDReembolso INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    IF @@TRANCOUNT = 0
        THROW 50005, N'SP_Pedidos_AplicarCancelacion debe ejecutarse dentro de una transacción.', 1;

    DECLARE @IDEstado INT, @Dueno INT, @Total DECIMAL(12,2), @Reembolsado DECIMAL(12,2), @IDIntento BIGINT,
            @EstadoIntento VARCHAR(12), @ID INT, @Cantidad INT, @Numero VARCHAR(20), @Bloqueado BIGINT,
            @IDPagado INT        = (SELECT e.IDEstadoPedido FROM dbo.EstadoPedido AS e WHERE e.Codigo = 'Pagado'),
            @IDEnPreparacion INT = (SELECT e.IDEstadoPedido FROM dbo.EstadoPedido AS e WHERE e.Codigo = 'EnPreparacion'),
            @IDCancelado INT     = (SELECT e.IDEstadoPedido FROM dbo.EstadoPedido AS e WHERE e.Codigo = 'Cancelado');
    SET @IDReembolso = NULL;

    SELECT @IDEstado = p.IDEstadoPedido, @Dueno = p.IDUsuario, @Total = p.Total,
           @Reembolsado = p.MontoReembolsado, @IDIntento = p.IDIntentoPago, @Numero = p.NumeroPedido
    FROM   dbo.Pedido AS p WITH (UPDLOCK, ROWLOCK)
    WHERE  p.IDPedido = @IDPedido;

    -- RF-01: el pedido de otro cliente responde igual que uno inexistente.
    IF @IDEstado IS NULL OR (@IDCliente IS NOT NULL AND @Dueno <> @IDCliente)
        THROW 50001, N'El pedido no existe.', 1;
    IF @IDEstado NOT IN (@IDPagado, @IDEnPreparacion)
        THROW 50702, N'El pedido ya no se puede cancelar: solo se cancela antes de despacharlo.', 1;

    UPDATE dbo.Pedido
    SET    IDEstadoPedido = @IDCancelado, FechaActualizacion = SYSUTCDATETIME()
    WHERE  IDPedido = @IDPedido;

    INSERT INTO dbo.HistorialEstadoPedido (IDPedido, IDEstadoAnterior, IDEstadoNuevo, IDUsuario, Motivo, RequestId)
    VALUES (@IDPedido, @IDEstado, @IDCancelado, @IDUsuario, LTRIM(RTRIM(@Motivo)), @RequestId);

    -- N-07, N-09: el producto vuelve al inventario, línea por línea en orden de IDVariante.
    SET @ID = (SELECT MIN(d.IDVariante) FROM dbo.DetallePedido AS d WHERE d.IDPedido = @IDPedido);
    WHILE @ID IS NOT NULL
    BEGIN
        SET @Cantidad = (SELECT d.Cantidad FROM dbo.DetallePedido AS d
                         WHERE d.IDPedido = @IDPedido AND d.IDVariante = @ID);
        EXEC dbo.SP_Inventario_RegistrarMovimiento
             @IDVariante = @ID, @CodigoTipo = 'ReingresoCancelacion', @Cantidad = @Cantidad,
             @Motivo = N'Cancelación del pedido', @Referencia = @Numero, @IDPedido = @IDPedido,
             @IDDevolucion = NULL;
        SET @ID = (SELECT MIN(d.IDVariante) FROM dbo.DetallePedido AS d
                   WHERE d.IDPedido = @IDPedido AND d.IDVariante > @ID);
    END

    EXEC dbo.SP_Cupones_RevertirUso @IDPedido;

    -- Plan E6-H03 §2.6: un cobro todavía sin capturar no se reembolsa, se anula. El intento deja de estar en
    -- curso con un token nuevo: la conciliación ya no lo toma, y si lo tenía tomado su compare-and-set falla.
    SELECT @Bloqueado = i.IDIntentoPago, @EstadoIntento = i.Estado
    FROM   dbo.IntentoPago AS i WITH (UPDLOCK, ROWLOCK)
    WHERE  i.IDIntentoPago = @IDIntento;

    IF @EstadoIntento = 'Autorizado'
        UPDATE dbo.IntentoPago
        SET    Estado = 'Anulado', CodigoRespuesta = 'PEDIDO_CANCELADO', ArrendadoHasta = NULL,
               TokenArrendamiento = NEWID(), FechaActualizacion = SYSUTCDATETIME()
        WHERE  IDIntentoPago = @IDIntento;

    -- Decisión del PO (cierre de la Fase 1): con el pago en revisión (V019) la autorización ya no existe en la
    -- pasarela: no hay cobro que devolver, así que no se crea reembolso.
    IF @EstadoIntento <> 'EnRevision'
    BEGIN
        -- N-09: un reembolso por cancelación por pedido (UX_Reembolso_CancelacionPorPedido); su llave es
        -- determinista, así la petición, el Admin y el job envían siempre la misma a la pasarela.
        INSERT INTO dbo.Reembolso (IDPedido, IDDevolucion, Origen, Monto, Estado, LlaveIdempotencia,
                                   FechaProximoIntento)
        VALUES (@IDPedido, NULL, 'Cancelacion', @Total - @Reembolsado, 'Pendiente',
                CONVERT(UNIQUEIDENTIFIER, HASHBYTES('MD5', CONCAT(N'Reembolso|', @IDPedido, N'|Cancelacion'))),
                SYSUTCDATETIME());
        SET @IDReembolso = SCOPE_IDENTITY();

        -- A-13: el contador con CHECK (MontoReembolsado BETWEEN 0 AND Total) es la última defensa.
        UPDATE dbo.Pedido
        SET    MontoReembolsado = MontoReembolsado + (@Total - @Reembolsado)
        WHERE  IDPedido = @IDPedido;
    END
END
GO
