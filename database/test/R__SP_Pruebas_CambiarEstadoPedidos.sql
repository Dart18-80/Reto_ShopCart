-- Solo existe en shopcart_test: cambia el estado de dos pedidos en un solo UPDATE, para comprobar
-- que los triggers de Pedido tratan inserted/deleted como conjuntos (N-08, RF-09).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_CambiarEstadoPedidos
    @IDPedido1      INT,
    @CodigoEstado1  VARCHAR(20),
    @IDPedido2      INT,
    @CodigoEstado2  VARCHAR(20),
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
        UPDATE p
        SET    IDEstadoPedido = e.IDEstadoPedido, FechaActualizacion = SYSUTCDATETIME()
        FROM   dbo.Pedido AS p
        JOIN   (VALUES (@IDPedido1, @CodigoEstado1), (@IDPedido2, @CodigoEstado2)) AS c (IDPedido, Codigo)
               ON c.IDPedido = p.IDPedido
        JOIN   dbo.EstadoPedido AS e ON e.Codigo = c.Codigo;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
