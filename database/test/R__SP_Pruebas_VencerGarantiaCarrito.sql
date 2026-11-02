-- Solo existe en shopcart_test: vence la garantía de precio de una línea del carrito (N-02) para probar su
-- vencimiento sin esperar días. La hora la decide la base: la garantía termina un instante antes de ahora.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_VencerGarantiaCarrito
    @IDLineaCarrito INT,
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
        UPDATE dbo.LineaCarrito
        SET    FechaGarantiaHasta = DATEADD(MILLISECOND, -10, SYSUTCDATETIME())
        WHERE  IDLineaCarrito = @IDLineaCarrito;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
