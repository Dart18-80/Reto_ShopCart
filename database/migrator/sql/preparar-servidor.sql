-- Se ejecuta como sa en master. Parámetros tipados: @Base, @ContrasenaApp, @ContrasenaMigrador.
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @sql NVARCHAR(MAX);

IF DB_ID(@Base) IS NULL
BEGIN
    SET @sql = N'CREATE DATABASE ' + QUOTENAME(@Base) + N';';
    EXEC sys.sp_executesql @sql;
END;

-- A-05: con RCSI los lectores no bloquean a los escritores. El cambio exige acceso exclusivo a la base,
-- por eso solo se aplica la primera vez.
IF EXISTS (SELECT 1 FROM sys.databases WHERE name = @Base AND is_read_committed_snapshot_on = 0)
BEGIN
    SET @sql = N'ALTER DATABASE ' + QUOTENAME(@Base) + N' SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;';
    EXEC sys.sp_executesql @sql;
END;

-- CREATE/ALTER LOGIN no aceptan la contraseña como parámetro: QUOTENAME(..., '''') la convierte en un literal
-- seguro duplicando las comillas. Devuelve NULL con más de 128 caracteres, y un @sql NULL no ejecutaría nada.
IF QUOTENAME(@ContrasenaApp, '''') IS NULL OR QUOTENAME(@ContrasenaMigrador, '''') IS NULL
    THROW 50003, N'Las contraseñas de los logins no pueden exceder 128 caracteres.', 1;

-- La contraseña se reasigna en cada ejecución: .env es la fuente de verdad.
SET @sql = CASE WHEN EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'shopcart_app')
                THEN N'ALTER' ELSE N'CREATE' END
    + N' LOGIN shopcart_app WITH PASSWORD = ' + QUOTENAME(@ContrasenaApp, '''') + N';';
EXEC sys.sp_executesql @sql;

SET @sql = CASE WHEN EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'shopcart_migrator')
                THEN N'ALTER' ELSE N'CREATE' END
    + N' LOGIN shopcart_migrator WITH PASSWORD = ' + QUOTENAME(@ContrasenaMigrador, '''') + N';';
EXEC sys.sp_executesql @sql;
