-- Solo existe en shopcart_test: hace fallar, dentro de SP_Pedidos_CrearPedido, el paso del carrito a Convertido
-- cuando tiene una variante de SKU 'FALLAFIN-…'. Ese paso va después del pedido, el detalle, la salida del
-- kardex, las reservas Consumida, el uso del cupón Confirmado y la sesión Pagada: la prueba demuestra que todo
-- eso se revierte (RF-06).
CREATE OR ALTER TRIGGER dbo.TR_Pruebas_FallarCierreDeCarrito
ON dbo.Carrito
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1
               FROM   inserted AS i
               JOIN   deleted  AS d ON d.IDCarrito = i.IDCarrito
               JOIN   dbo.LineaCarrito AS l ON l.IDCarrito = i.IDCarrito
               JOIN   dbo.Variante     AS v ON v.IDVariante = l.IDVariante
               WHERE  i.Estado = 'Convertido' AND d.Estado <> 'Convertido' AND v.SKU LIKE 'FALLAFIN-%')
        THROW 59996, N'Falla simulada al cerrar el carrito del pedido.', 1;
END
GO
