-- Solo existe en shopcart_test: llama a SP_Inventario_RegistrarMovimiento sin abrir una transacción,
-- para comprobar que el SP interno lo rechaza.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_RegistrarMovimientoSinTransaccion
    @IDVariante     INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    EXEC dbo.SP_Inventario_RegistrarMovimiento
         @IDVariante = @IDVariante, @CodigoTipo = 'EntradaCompra', @Cantidad = 5,
         @Motivo = N'Movimiento de prueba', @Referencia = NULL, @IDPedido = NULL, @IDDevolucion = NULL;
END
GO
