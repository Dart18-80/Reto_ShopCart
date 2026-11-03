-- Solo existe en shopcart_test: un intento EnRevision sin pedido con la llave y la transacción que la prueba ya
-- autorizó y capturó en la pasarela simulada, como lo dejaría la conciliación al encontrar un cobro capturado
-- que no llegó a ser pedido (E9-H04). Devuelve el intento.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_CrearCobroSinPedido
    @IDSesionCheckout  INT,
    @LlaveIdempotencia UNIQUEIDENTIFIER,
    @Monto             DECIMAL(12,2),
    @IDTransaccion     VARCHAR(64),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Rol VARCHAR(20) = COALESCE(@RolActor, 'Sistema');
    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @Rol, @RequestId;

    BEGIN TRY
        BEGIN TRAN;
        INSERT INTO dbo.IntentoPago (IDSesionCheckout, LlaveIdempotencia, HashSolicitud, Monto, Estado,
                                     IDTransaccionPasarela, CodigoRespuesta)
        VALUES (@IDSesionCheckout, @LlaveIdempotencia, HASHBYTES('SHA2_256', CONVERT(NVARCHAR(36), NEWID())),
                @Monto, 'EnRevision', @IDTransaccion, 'PAGO_EN_REVISION');
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT i.IDIntentoPago FROM dbo.IntentoPago AS i WHERE i.LlaveIdempotencia = @LlaveIdempotencia;
END
GO
