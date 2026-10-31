-- Solo existe en shopcart_test: fija MontoReembolsado de un pedido dentro de una transacción que
-- siempre se revierte, para probar CK_Pedido_MontoReembolsado en sus límites (A-13).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_ProbarMontoReembolsado
    @IDPedido         INT,
    @MontoReembolsado DECIMAL(12,2),
    @IDUsuarioActor   INT              = NULL,
    @RolActor         VARCHAR(20)      = NULL,
    @RequestId        UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRAN;
        UPDATE dbo.Pedido SET MontoReembolsado = @MontoReembolsado WHERE IDPedido = @IDPedido;
        ROLLBACK;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
