-- Prueba de permisos (A-23): shopcart_app tampoco lee la vista de la tienda directamente.
SELECT TOP (1) IDProducto FROM dbo.VW_Catalogo_ProductosTienda;
