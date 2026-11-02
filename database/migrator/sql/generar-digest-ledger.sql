-- M-01: el digest del ledger de la base (último bloque, su hash y su hora), para guardarlo fuera de ella. Lo
-- ejecuta `pnpm ledger:verificar` como sa. También devuelve cuándo se creó la base: los digests de una base
-- anterior (recreada con docker compose down -v) no sirven para verificar esta.
EXEC sys.sp_generate_database_ledger_digest;

SELECT CONVERT(VARCHAR(23), d.create_date, 126) AS CreadaEn
FROM   sys.databases AS d
WHERE  d.database_id = DB_ID();
