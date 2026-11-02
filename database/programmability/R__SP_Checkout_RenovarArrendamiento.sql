-- N-03 (fencing, revisión de E6): antes de tocar el cobro en la pasarela (anular tras una falla de CrearPedido),
-- la petición renueva su arrendamiento solo si el token sigue siendo el vigente. Si otro proceso lo retomó (un
-- reintento o la conciliación), Vigente = 0 y la petición no toca el cobro: lo resuelve quien lo tiene. Mientras
-- el arrendamiento renovado esté vivo, nadie más puede retomar el intento ni crear su pedido.
-- Solo el cliente dueño del intento: otro rol o un intento ajeno es una invariante rota (50005), no un
-- arrendamiento perdido.
CREATE OR ALTER PROCEDURE dbo.SP_Checkout_RenovarArrendamiento
    @IDIntentoPago         BIGINT,
    @TokenArrendamiento    UNIQUEIDENTIFIER,
    @SegundosArrendamiento INT,
    @IDUsuarioActor        INT              = NULL,
    @RolActor              VARCHAR(20)      = NULL,
    @RequestId             UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @SegundosArrendamiento IS NULL OR @SegundosArrendamiento <= 0
        THROW 50005, N'SP_Checkout_RenovarArrendamiento recibió un arrendamiento inválido.', 1;
    IF @RolActor IS NULL OR @RolActor <> 'Cliente'
        THROW 50005, N'Solo el cliente dueño renueva el arrendamiento de su pago.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.IntentoPago AS i
                   JOIN dbo.SesionCheckout AS s ON s.IDSesionCheckout = i.IDSesionCheckout
                   WHERE i.IDIntentoPago = @IDIntentoPago AND s.IDUsuario = @IDUsuarioActor)
        THROW 50005, N'El intento de pago no es del cliente.', 1;

    DECLARE @Vigente BIT = 0;

    BEGIN TRY
        BEGIN TRAN;

        UPDATE dbo.IntentoPago
        SET    ArrendadoHasta = DATEADD(SECOND, @SegundosArrendamiento, SYSUTCDATETIME()),
               FechaActualizacion = SYSUTCDATETIME()
        WHERE  IDIntentoPago = @IDIntentoPago AND TokenArrendamiento = @TokenArrendamiento
          AND  Estado IN ('Pendiente', 'Autorizado');
        SET @Vigente = IIF(@@ROWCOUNT = 1, 1, 0);

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT @Vigente AS Vigente;
END
GO
