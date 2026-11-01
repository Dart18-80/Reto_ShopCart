-- Prueba de permisos (A-23): como shopcart_busqueda, no puede leer las tablas que la vista usa.
-- Se ejecuta como el migrador (db_owner, que puede suplantar); REVERT siempre, aun con error.
EXECUTE AS USER = N'shopcart_busqueda';
BEGIN TRY
    SELECT TOP (1) IDProducto FROM dbo.Producto;
    REVERT;
END TRY
BEGIN CATCH
    REVERT;
    THROW;
END CATCH;
