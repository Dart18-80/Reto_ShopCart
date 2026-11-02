-- Job de conciliación (N-03, 01 §6.2): toma UN intento de pago en curso (Pendiente o Autorizado) cuyo
-- arrendamiento venció hace más de @SegundosGracia, y lo arrienda @SegundosArrendamiento para la conciliación:
-- mientras tanto, un reintento con la misma llave recibe 409 y la expiración no vence su sesión. La toma genera
-- un TokenArrendamiento nuevo (fencing, N-03): la petición que lo tenía ya no puede crear el pedido ni escribir
-- el intento.
-- READPAST salta el intento que una petición tiene bloqueado en ese momento. La API lo llama en un ciclo hasta
-- que no quede ninguno; cada intento lo toma una sola réplica.
-- Devuelve una fila: Ejecutada = 0 si la otra réplica tiene el sp_getapplock; IDIntentoPago NULL si no hay
-- nada que conciliar. IDPedido es el pedido creado con ese intento (UQ_Pedido_IDIntentoPago), si existe.
CREATE OR ALTER PROCEDURE dbo.SP_Checkout_TomarIntentosPorConciliar
    @SegundosGracia        INT,
    @SegundosArrendamiento INT,
    @IDUsuarioActor        INT              = NULL,
    @RolActor              VARCHAR(20)      = NULL,
    @RequestId             UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @RolActor IS NULL OR @RolActor <> 'Sistema'
        THROW 50005, N'Solo los jobs ejecutan esta tarea.', 1;

    IF @SegundosGracia IS NULL OR @SegundosGracia < 0 OR @SegundosArrendamiento IS NULL OR @SegundosArrendamiento <= 0
        THROW 50005, N'SP_Checkout_TomarIntentosPorConciliar recibió una gracia o un arrendamiento inválidos.', 1;

    DECLARE @Bloqueo INT, @IDIntento BIGINT, @Estado VARCHAR(12), @Token UNIQUEIDENTIFIER = NEWID();

    BEGIN TRY
        BEGIN TRAN;

        EXEC @Bloqueo = sys.sp_getapplock @Resource = N'Job_Checkout_Conciliar', @LockMode = N'Exclusive',
                                          @LockOwner = N'Transaction', @LockTimeout = 0;
        IF @Bloqueo < 0
        BEGIN
            ROLLBACK;
            SELECT CONVERT(BIT, 0) AS Ejecutada, CONVERT(BIGINT, NULL) AS IDIntentoPago,
                   CONVERT(VARCHAR(12), NULL) AS Estado, CONVERT(UNIQUEIDENTIFIER, NULL) AS LlaveIdempotencia,
                   CONVERT(VARCHAR(64), NULL) AS IDTransaccion, CONVERT(INT, NULL) AS IDPedido,
                   CONVERT(UNIQUEIDENTIFIER, NULL) AS TokenArrendamiento;
            RETURN;
        END

        -- IX_IntentoPago_PorConciliar: el filtro por Estado es el del índice.
        SELECT TOP (1) @IDIntento = i.IDIntentoPago, @Estado = i.Estado
        FROM   dbo.IntentoPago AS i WITH (UPDLOCK, ROWLOCK, READPAST)
        WHERE  i.Estado IN ('Pendiente', 'Autorizado')
          AND  i.ArrendadoHasta < DATEADD(SECOND, -@SegundosGracia, SYSUTCDATETIME())
        ORDER BY i.ArrendadoHasta, i.IDIntentoPago;

        IF @IDIntento IS NOT NULL
            UPDATE dbo.IntentoPago
            SET    ArrendadoHasta = DATEADD(SECOND, @SegundosArrendamiento, SYSUTCDATETIME()),
                   TokenArrendamiento = @Token, FechaActualizacion = SYSUTCDATETIME()
            WHERE  IDIntentoPago = @IDIntento;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT CONVERT(BIT, 1) AS Ejecutada, i.IDIntentoPago, i.Estado, i.LlaveIdempotencia,
           i.IDTransaccionPasarela AS IDTransaccion, p.IDPedido, i.TokenArrendamiento
    FROM   (SELECT 1 AS Uno) AS f
    LEFT JOIN dbo.IntentoPago AS i ON i.IDIntentoPago = @IDIntento
    LEFT JOIN dbo.Pedido      AS p ON p.IDIntentoPago = i.IDIntentoPago;
END
GO
