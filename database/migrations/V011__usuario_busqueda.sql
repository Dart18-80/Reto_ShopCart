-- V011: A-23. Usuario sin login con el que corre el SQL dinámico de SP_Catalogo_BuscarProductos
-- (WITH EXECUTE AS). No tiene rol ni permisos aquí: su único permiso, SELECT sobre
-- VW_Catalogo_ProductosTienda, lo otorga el R__ de esa vista. shopcart_app conserva su DENY SELECT.
CREATE USER shopcart_busqueda WITHOUT LOGIN;
GO
