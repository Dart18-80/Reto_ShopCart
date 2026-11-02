-- Solo existe en shopcart_test: deja en revisión manual (V019) el intento de pago de un pedido, como lo haría la
-- conciliación al encontrar su autorización anulada en la pasarela.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_PonerPagoEnRevision
    @IDPedido       INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    BEGIN TRY
        BEGIN TRAN;
        UPDATE i
        SET    Estado = 'EnRevision', ArrendadoHasta = NULL, FechaActualizacion = SYSUTCDATETIME()
        FROM   dbo.IntentoPago AS i
        JOIN   dbo.Pedido AS p ON p.IDIntentoPago = i.IDIntentoPago
        WHERE  p.IDPedido = @IDPedido;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
