-- Solo existe en shopcart_test: registra en el historial (ledger) el alta de un pedido como Pagado,
-- como lo hará SP_Pedidos_CrearPedido, y devuelve lo que muestra VW_Pedidos_Historial.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_RegistrarHistorialPedido
    @IDPedido       INT,
    @IDUsuario      INT,
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
        INSERT INTO dbo.HistorialEstadoPedido (IDPedido, IDEstadoAnterior, IDEstadoNuevo, IDUsuario, Motivo, RequestId, Fecha)
        SELECT @IDPedido, NULL, IDEstadoPedido, @IDUsuario, NULL, @RequestId, SYSUTCDATETIME()
        FROM   dbo.EstadoPedido
        WHERE  Codigo = 'Pagado';

        SELECT h.NumeroPedido, h.CodigoEstadoAnterior, h.EstadoAnterior, h.CodigoEstadoNuevo, h.EstadoNuevo,
               h.IDUsuario, h.RolUsuario, h.Motivo
        FROM   dbo.VW_Pedidos_Historial AS h
        WHERE  h.IDPedido = @IDPedido;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
