-- V001: permisos base de la API (01-arquitectura.md §10, mínimo privilegio).
-- La base, RCSI, los logins y los usuarios los crea el migrador como administrador antes de este script.

-- La API solo ejecuta stored procedures del esquema dbo.
GRANT EXECUTE ON SCHEMA::dbo TO shopcart_app;

-- Y nunca toca una tabla directamente, aunque hubiera una inyección. Los SPs siguen funcionando por
-- ownership chaining: el SP y las tablas pertenecen a dbo, así que SQL Server no revisa permisos de tabla.
DENY SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dbo TO shopcart_app;
