-- Prueba de permisos (E0-H03): shopcart_app no puede leer una tabla directamente, solo ejecutar SPs.
SELECT TOP (1) IDRol FROM dbo.Rol;
