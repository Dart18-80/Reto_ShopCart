-- N-14: una variante tiene historial si tiene ventas, movimientos de kardex, reservas o líneas de checkout.
-- Con historial no se borra (PRODUCTO_CON_HISTORIAL) ni cambia su combinación (VARIANTE_CON_HISTORIAL).
-- Es la prevalidación para el mensaje claro: al borrar, la autoridad son las FKs (547).
CREATE OR ALTER FUNCTION dbo.FU_Catalogo_HistorialVariante (@IDVariante INT)
RETURNS TABLE
AS
RETURN
    SELECT CONVERT(BIT, CASE
               WHEN EXISTS (SELECT 1 FROM dbo.DetallePedido       WHERE IDVariante = @IDVariante)
                 OR EXISTS (SELECT 1 FROM dbo.MovimientoKardex    WHERE IDVariante = @IDVariante)
                 OR EXISTS (SELECT 1 FROM dbo.Reserva             WHERE IDVariante = @IDVariante)
                 OR EXISTS (SELECT 1 FROM dbo.LineaSesionCheckout WHERE IDVariante = @IDVariante)
               THEN 1 ELSE 0 END) AS TieneHistorial;
GO
