-- Solo existe en shopcart_test: agrega al historial (ledger, solo se inserta) una entrega del pedido de hace
-- @DiasAtras días, para probar el plazo de devolución (N-10) sin esperar. El plazo cuenta desde la primera vez
-- que el pedido pasó a Entregado. La hora la decide la base.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_EntregaAntigua
    @IDPedido       INT,
    @DiasAtras      INT,
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
        INSERT INTO dbo.HistorialEstadoPedido (IDPedido, IDEstadoAnterior, IDEstadoNuevo, IDUsuario, Motivo, RequestId,
                                               Fecha)
        SELECT @IDPedido, ea.IDEstadoPedido, en.IDEstadoPedido, p.IDUsuario, N'Entrega antigua de prueba', @RequestId,
               DATEADD(DAY, -@DiasAtras, SYSUTCDATETIME())
        FROM   dbo.Pedido AS p
        CROSS JOIN dbo.EstadoPedido AS ea
        CROSS JOIN dbo.EstadoPedido AS en
        WHERE  p.IDPedido = @IDPedido AND ea.Codigo = 'Despachado' AND en.Codigo = 'Entregado';
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
