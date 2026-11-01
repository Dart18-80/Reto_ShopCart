-- Prueba de permisos (A-23): como shopcart_busqueda, puede leer la vista de la tienda.
-- Se ejecuta como el migrador (db_owner, que puede suplantar); REVERT siempre, aun con error.
EXECUTE AS USER = N'shopcart_busqueda';
BEGIN TRY
    SELECT TOP (1) IDProducto FROM dbo.VW_Catalogo_ProductosTienda;
    REVERT;
END TRY
BEGIN CATCH
    REVERT;
    THROW;
END CATCH;
