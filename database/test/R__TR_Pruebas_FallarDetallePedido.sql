-- Solo existe en shopcart_test: hace fallar, dentro de SP_Pedidos_CrearPedido, el detalle de un pedido con una
-- variante de SKU 'FALLA-…', para probar la atomicidad de RF-06: no queda pedido, ni detalle, ni kardex, ni
-- cupón confirmado, y la autorización se anula.
CREATE OR ALTER TRIGGER dbo.TR_Pruebas_FallarDetallePedido
ON dbo.DetallePedido
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM inserted AS i WHERE i.SKU LIKE 'FALLA-%')
        THROW 59998, N'Falla simulada al crear el detalle del pedido.', 1;
END
GO
