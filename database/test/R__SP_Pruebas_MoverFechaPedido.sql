-- Solo existe en shopcart_test: lleva un pedido a un día de pago de Guatemala dado (FechaPago a las 12:00 de
-- ese día, FechaPagoLocal ese día), para probar los filtros de fecha de la gestión y de los reportes sin esperar.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_MoverFechaPedido
    @IDPedido       INT,
    @FechaLocal     DATE,
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
        -- 18:00 UTC = 12:00 en Guatemala (UTC−6).
        UPDATE dbo.Pedido
        SET    FechaPago = DATEADD(HOUR, 18, CONVERT(DATETIME2(3), @FechaLocal)), FechaPagoLocal = @FechaLocal
        WHERE  IDPedido = @IDPedido;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
