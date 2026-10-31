-- Solo existe en shopcart_test: fija CantidadDevuelta de una línea dentro de una transacción que
-- siempre se revierte, para probar CK_DetallePedido_CantidadDevuelta en sus límites (N-10).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_ProbarCantidadDevuelta
    @IDPedido         INT,
    @IDVariante       INT,
    @CantidadDevuelta INT,
    @IDUsuarioActor   INT              = NULL,
    @RolActor         VARCHAR(20)      = NULL,
    @RequestId        UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    BEGIN TRY
        BEGIN TRAN;
        UPDATE dbo.DetallePedido
        SET    CantidadDevuelta = @CantidadDevuelta
        WHERE  IDPedido = @IDPedido AND IDVariante = @IDVariante;
        ROLLBACK;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
