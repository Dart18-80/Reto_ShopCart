-- Se ejecuta como sa en master, solo con --pruebas. Parámetro tipado: @Base.
-- Las tablas ledger (M-01) no admiten DELETE ni TRUNCATE: cada corrida de pruebas recrea la base.
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF @Base <> N'shopcart_test'
    THROW 50003, N'Solo se puede recrear la base de pruebas shopcart_test.', 1;

IF DB_ID(@Base) IS NOT NULL
BEGIN
    -- Un identificador no puede ir como parámetro: QUOTENAME lo delimita, igual que en CREATE DATABASE.
    DECLARE @sql NVARCHAR(MAX) =
        N'ALTER DATABASE ' + QUOTENAME(@Base) + N' SET SINGLE_USER WITH ROLLBACK IMMEDIATE; '
      + N'DROP DATABASE ' + QUOTENAME(@Base) + N';';
    EXEC sys.sp_executesql @sql;
END;
