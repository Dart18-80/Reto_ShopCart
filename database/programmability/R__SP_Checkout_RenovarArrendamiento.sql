-- N-03 (fencing, revisión de E6): antes de tocar el cobro en la pasarela (anular tras una falla de CrearPedido),
-- la petición renueva su arrendamiento solo si el token sigue siendo el vigente. Si otro proceso lo retomó (un
-- reintento o la conciliación), Vigente = 0 y la petición no toca el cobro: lo resuelve quien lo tiene. Mientras
-- el arrendamiento renovado esté vivo, nadie más puede retomar el intento ni crear su pedido.
-- Solo el cliente dueño del intento.
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

    DECLARE @Vigente BIT = 0;

    BEGIN TRY
        BEGIN TRAN;

        UPDATE i
        SET    ArrendadoHasta = DATEADD(SECOND, @SegundosArrendamiento, SYSUTCDATETIME()),
               FechaActualizacion = SYSUTCDATETIME()
        FROM   dbo.IntentoPago AS i WITH (UPDLOCK, ROWLOCK)
        JOIN   dbo.SesionCheckout AS s ON s.IDSesionCheckout = i.IDSesionCheckout
        WHERE  i.IDIntentoPago = @IDIntentoPago AND i.TokenArrendamiento = @TokenArrendamiento
          AND  i.Estado IN ('Pendiente', 'Autorizado')
          AND  s.IDUsuario = @IDUsuarioActor AND @RolActor = 'Cliente';
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
