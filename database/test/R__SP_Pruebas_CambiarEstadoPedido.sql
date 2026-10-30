-- Solo existe en shopcart_test: hace un UPDATE directo del estado del pedido con el actor de la
-- petición, sin las validaciones del SP real, para comprobar TR_Pedidos_ValidarTransicion (N-08).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_CambiarEstadoPedido
    @IDPedido       INT,
    @CodigoEstado   VARCHAR(20),
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
        SET    IDEstadoPedido = (SELECT IDEstadoPedido FROM dbo.EstadoPedido WHERE Codigo = @CodigoEstado),
               FechaActualizacion = SYSUTCDATETIME()
        WHERE  IDPedido = @IDPedido;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
