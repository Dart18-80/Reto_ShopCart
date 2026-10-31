-- Solo existe en shopcart_test: aplica importes a un pedido dentro de una transacción que siempre se
-- revierte, para probar CK_Pedido_Descuento, CK_Pedido_Total y CK_Pedido_IVA sin dejar cambios.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_ProbarTotalesPedido
    @IDPedido       INT,
    @Subtotal       DECIMAL(12,2),
    @Descuento      DECIMAL(12,2),
    @CostoEnvio     DECIMAL(12,2),
    @Total          DECIMAL(12,2),
    @BaseImponible  DECIMAL(12,2),
    @IVA            DECIMAL(12,2),
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
        UPDATE dbo.Pedido
        SET    Subtotal = @Subtotal, Descuento = @Descuento, CostoEnvio = @CostoEnvio, Total = @Total,
               BaseImponible = @BaseImponible, IVA = @IVA
        WHERE  IDPedido = @IDPedido;
        ROLLBACK;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
